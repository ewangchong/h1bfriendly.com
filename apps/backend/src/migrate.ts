import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://h1b:change_me@127.0.0.1:5432/h1bfinder'),
});

const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
});

const pool = new Pool({ connectionString: env.DATABASE_URL });

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedVersions() {
  const res = await pool.query<{ version: string }>('SELECT version FROM schema_migrations');
  return new Set(res.rows.map((row) => row.version));
}

async function migrationFiles() {
  const dir = path.resolve(process.cwd(), 'migrations');
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

async function applyMigration(version: string) {
  const client = await pool.connect();
  try {
    const sql = await fs.readFile(path.resolve(process.cwd(), 'migrations', version), 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING', [version]);
    await client.query('COMMIT');
    console.log(`applied ${version}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  await ensureMigrationsTable();
  const applied = await appliedVersions();
  const files = await migrationFiles();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }
    await applyMigration(file);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
