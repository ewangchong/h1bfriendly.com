import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
const { Pool } = pg;
import { z } from 'zod';
import { LRUCache } from 'lru-cache';


const envSchema = z.object({
  PORT: z.coerce.number().default(8089),
  DATABASE_URL: z.string().default('postgres://h1b:postgres@127.0.0.1:5432/h1bfriend'),
});

const env = envSchema.parse({
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
});

const pool = new Pool({ connectionString: env.DATABASE_URL });

const ANNUAL_WAGE_SQL = `
  CASE 
    WHEN wage_rate_of_pay_from ~ '^[0-9]+(\\.[0-9]+)?$' THEN 
      CAST(wage_rate_of_pay_from AS NUMERIC) * 
      CASE 
        WHEN wage_unit_of_pay ILIKE 'Year' THEN 1 
        WHEN wage_unit_of_pay ILIKE 'Month' THEN 12 
        WHEN wage_unit_of_pay ILIKE 'Bi-Weekly' THEN 26 
        WHEN wage_unit_of_pay ILIKE 'Week' THEN 52 
        WHEN wage_unit_of_pay ILIKE 'Hour' THEN 2080 
        ELSE 1 
      END
    ELSE NULL 
  END
`;

const cache = new LRUCache<string, any>({
  max: 10000,
  ttl: 1000 * 60 * 60 * 24, // 24 hours (data changes quarterly)
});


const app = Fastify({ logger: true });

app.get('/api/v1/debug/cache', async () => {
  return {
    success: true,
    size: cache.size,
    max: cache.max,
    entry_keys: Array.from(cache.keys())
  };
});

await app.register(cors, { origin: true });

type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  total_elements: number;
  total_pages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

function ok<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

function page<T>(content: T[], pageNum: number, size: number, total: number): PageResponse<T> {
  const totalPages = Math.max(1, Math.ceil(total / size));
  return {
    content,
    page: pageNum,
    size,
    total_elements: total,
    total_pages: totalPages,
    first: pageNum === 0,
    last: pageNum >= totalPages - 1,
    empty: content.length === 0,
  };
}

app.get('/health', async () => ({ ok: true }));

app.get('/api/v1/meta/years', async (_req, reply) => {
  const res = await pool.query(
    'SELECT DISTINCT fiscal_year::int AS year FROM lca_raw ORDER BY year DESC'
  );
  return reply.send(ok(res.rows.map((r) => r.year)));
});

app.get('/api/v1/companies', async (req, reply) => {
  const q = z
    .object({
      page: z.coerce.number().int().min(0).default(0),
      size: z.coerce.number().int().min(1).max(100).default(20),
      keyword: z.string().trim().min(1).optional(),
      sortBy: z.enum(['filed', 'name']).default('filed'),
      sortDirection: z.enum(['ASC', 'DESC']).default('DESC'),
      year: z.coerce.number().int().min(2000).max(2100).optional(),
    })
    .parse(req.query);

  const offset = q.page * q.size;

  const where: string[] = [];
  const params: any[] = [];

  if (q.keyword) {
    params.push(`%${q.keyword}%`);
    where.push(`name ILIKE $${params.length}`);
  }

  if (q.year) {
    params.push(q.year);
    where.push(`last_h1b_filing_year = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM companies ${whereSql}`,
    params
  );
  const total = totalRes.rows[0]?.c ?? 0;

  const direction = q.sortDirection;
  const orderBy =
    q.sortBy === 'name'
      ? `name ${direction}`
      : `h1b_applications_filed ${direction} NULLS LAST, name ASC`;

  params.push(q.size, offset);

  const rowsRes = await pool.query(
    `SELECT * FROM companies ${whereSql} ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return reply.send(ok(page(rowsRes.rows, q.page, q.size, total)));
});

app.get('/api/v1/companies/:id', async (req, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const res = await pool.query('SELECT * FROM companies WHERE id=$1', [params.id]);
  if (res.rowCount === 0) return reply.code(404).send({ success: false, error: 'not_found' });
  return reply.send(ok(res.rows[0]));
});

app.get('/api/v1/companies/slug/:slug', async (req, reply) => {
  const params = z.object({ slug: z.string().min(1) }).parse(req.params);
  const res = await pool.query('SELECT * FROM companies WHERE slug=$1', [params.slug]);
  if (res.rowCount === 0) return reply.code(404).send({ success: false, error: 'not_found' });
  return reply.send(ok(res.rows[0]));
});

app.get('/api/v1/companies/slug/:slug/insights', async (req, reply) => {
  const params = z.object({ slug: z.string().min(1) }).parse(req.params);
  const q = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }).parse(req.query);

  const companyRes = await pool.query('SELECT employer_name_normalized, name, slug FROM companies WHERE slug=$1', [params.slug]);
  if (companyRes.rowCount === 0) return reply.code(404).send({ success: false, error: 'not_found' });

  const employerNorm = companyRes.rows[0].employer_name_normalized;
  const yearWhere = q.year ? 'AND fiscal_year = $2' : '';

  const sql = `
    WITH filtered AS (
      SELECT
        REGEXP_REPLACE(TRIM(job_title), '\\s+', ' ', 'g') AS job_title,
        TRIM(worksite_state) AS worksite_state,
        TRIM(worksite_city) AS worksite_city,
        case_status,
        fiscal_year
      FROM lca_raw
      WHERE employer_name_normalized = $1
        AND job_title IS NOT NULL AND job_title <> ''
    ), scoped AS (
      SELECT * FROM filtered
      WHERE 1=1
      ${yearWhere}
    ), top_titles AS (
      SELECT
        job_title AS title,
        LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(job_title, '[^A-Za-z0-9]+', '-', 'g'), '-+', '-', 'g'))) AS title_slug,
        COUNT(*)::int AS filings,
        SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals
      FROM scoped
      GROUP BY 1,2
      ORDER BY filings DESC
      LIMIT 10
    ), top_states AS (
      SELECT
        worksite_state AS state,
        COUNT(*)::int AS filings
      FROM scoped
      WHERE worksite_state IS NOT NULL AND worksite_state <> ''
      GROUP BY 1
      ORDER BY filings DESC
      LIMIT 10
    ), trend AS (
      SELECT
        fiscal_year AS year,
        COUNT(*)::int AS filings,
        SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals
      FROM filtered
      GROUP BY 1
      ORDER BY year ASC
    )
    SELECT
      (SELECT COALESCE(json_agg(top_titles), '[]'::json) FROM top_titles) AS top_titles,
      (SELECT COALESCE(json_agg(top_states), '[]'::json) FROM top_states) AS top_states,
      (SELECT COALESCE(json_agg(trend), '[]'::json) FROM trend) AS trend;
  `;

  const bind = q.year ? [employerNorm, q.year] : [employerNorm];
  const res = await pool.query(sql, bind);
  return reply.send(ok(res.rows[0]));
});

app.get('/api/v1/jobs', async (req, reply) => {
  const q = z
    .object({
      page: z.coerce.number().int().min(0).default(0),
      size: z.coerce.number().int().min(1).max(100).default(24),
      keyword: z.string().trim().min(1).optional(),
      state: z.string().trim().min(2).max(2).optional(),
      year: z.coerce.number().int().min(2000).max(2100).optional(),
      sortBy: z.enum(['year', 'title', 'company']).default('year'),
      sortDirection: z.enum(['ASC', 'DESC']).default('DESC'),
    })
    .parse(req.query);

  const offset = q.page * q.size;

  const where: string[] = [];
  const params: any[] = [];

  if (q.keyword) {
    params.push(`%${q.keyword}%`);
    where.push(`job_title ILIKE $${params.length}`);
  }

  if (q.state) {
    params.push(q.state.toUpperCase());
    where.push(`state = $${params.length}`);
  }

  if (q.year) {
    params.push(q.year);
    where.push(`EXTRACT(YEAR FROM posted_date)::int = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS c FROM jobs ${whereSql}`, params);
  const total = totalRes.rows[0]?.c ?? 0;

  const direction = q.sortDirection;
  const orderBy =
    q.sortBy === 'title'
      ? `title ${direction}`
      : q.sortBy === 'company'
        ? `company_name ${direction} NULLS LAST, title ASC`
        : `posted_date ${direction} NULLS LAST, title ASC`;

  params.push(q.size, offset);

  const rowsRes = await pool.query(
    `SELECT * FROM jobs ${whereSql} ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return reply.send(ok(page(rowsRes.rows, q.page, q.size, total)));
});

app.get('/api/v1/jobs/:id', async (req, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const res = await pool.query('SELECT * FROM jobs WHERE id=$1', [params.id]);
  if (res.rowCount === 0) return reply.code(404).send({ success: false, error: 'not_found' });
  return reply.send(ok(res.rows[0]));
});

// ----- Titles (role direction pages) -----

app.get('/api/v1/titles', async (req, reply) => {
  const cacheKey = `titles:${JSON.stringify(req.query)}`;
  const cached = cache.get(cacheKey);
  if (cached) return reply.send(ok(cached));

  const q = z

    .object({
      year: z.coerce.number().int().min(2000).max(2100).optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    })
    .parse(req.query);

  const params: any[] = [];
  const where = q.year ? 'WHERE fiscal_year = $1 AND' : 'WHERE';
  if (q.year) params.push(q.year);

  params.push(q.limit);

  const sql = `
    WITH base AS (
      SELECT
        job_title AS title_raw,
        job_title AS title_norm,
        fiscal_year
      FROM lca_raw
      ${where} job_title IS NOT NULL AND job_title <> ''
    ), agg AS (
      SELECT
        title_norm,
        title_norm AS title,
        COUNT(*)::int AS filings,
        MAX(fiscal_year)::int AS last_year
      FROM base
      GROUP BY title_norm
    )
    SELECT
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(title, '[^A-Za-z0-9]+', '-', 'g'), '-+', '-', 'g'))) AS slug,
      title,
      filings,
      last_year
    FROM agg
    ORDER BY filings DESC
    LIMIT $${params.length};
  `;

  console.log("SQL QUERY:", sql);

  const res = await pool.query(sql, params);
  cache.set(cacheKey, res.rows);
  return reply.send(ok(res.rows));
});

app.get('/api/v1/titles/:slug/summary', async (req, reply) => {
  const params = z.object({ slug: z.string().min(1) }).parse(req.params);
  const q = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }).parse(req.query);

  const yearWhere = q.year ? 'AND fiscal_year = $2' : '';
  const sql = `
    WITH base AS (
      SELECT
        job_title AS title_raw,
        job_title AS title_norm,
        LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(job_title), '\\s+', ' ', 'g'), '[^A-Za-z0-9]+', '-', 'g'), '-+', '-', 'g'))) AS slug,
        employer_name_normalized AS employer_norm,
        TRIM(worksite_state) AS worksite_state,
        TRIM(worksite_city) AS worksite_city,
        case_status,
        fiscal_year
      FROM lca_raw
      WHERE job_title IS NOT NULL AND job_title <> ''
        AND employer_name IS NOT NULL AND employer_name <> ''
    ), base_filtered AS (
      SELECT * FROM base
      WHERE slug = $1
    ), filtered AS (
      SELECT * FROM base_filtered
      WHERE 1=1
      ${yearWhere}
    ), totals AS (
      SELECT
        MAX(title_raw) AS title,
        COUNT(*)::int AS filings,
        SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals,
        MAX(fiscal_year)::int AS last_year
      FROM filtered
    ), top_companies AS (
      SELECT
        c.slug AS company_slug,
        COALESCE(c.name, f.employer_norm) AS company_name,
        COUNT(*)::int AS filings,
        SUM(CASE WHEN f.case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals
      FROM filtered f
      LEFT JOIN companies c ON c.employer_name_normalized = f.employer_norm
      GROUP BY 1,2
      ORDER BY filings DESC
      LIMIT 25
    ), top_states AS (
      SELECT
        worksite_state AS state,
        COUNT(*)::int AS filings
      FROM filtered
      WHERE worksite_state IS NOT NULL AND worksite_state <> ''
      GROUP BY 1
      ORDER BY filings DESC
      LIMIT 15
    ), top_cities AS (
      SELECT
        worksite_city AS city,
        worksite_state AS state,
        COUNT(*)::int AS filings
      FROM filtered
      WHERE worksite_city IS NOT NULL AND worksite_city <> ''
      GROUP BY 1,2
      ORDER BY filings DESC
      LIMIT 15
    ), trend AS (
      SELECT
        fiscal_year AS year,
        COUNT(*)::int AS filings,
        SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals
      FROM base_filtered
      GROUP BY 1
      ORDER BY year ASC
    )
    SELECT
      (SELECT row_to_json(totals) FROM totals) AS totals,
      (SELECT COALESCE(json_agg(top_companies), '[]'::json) FROM top_companies) AS top_companies,
      (SELECT COALESCE(json_agg(top_states), '[]'::json) FROM top_states) AS top_states,
      (SELECT COALESCE(json_agg(top_cities), '[]'::json) FROM top_cities) AS top_cities,
      (SELECT COALESCE(json_agg(trend), '[]'::json) FROM trend);
  `;

  const bind = q.year ? [params.slug, q.year] : [params.slug];
  const res = await pool.query(sql, bind);
  if (!res.rows?.[0]?.totals) return reply.code(404).send({ success: false, error: 'not_found' });
  return reply.send(ok(res.rows[0]));
});

app.get('/api/v1/rankings', async (req, reply) => {
  const cacheKey = `rankings:${JSON.stringify(req.query)}`;
  const cached = cache.get(cacheKey);
  if (cached) return reply.send(ok(cached));

  const q = z
    .object({
      year: z.coerce.number().int().min(2000).max(2100).optional(),
      state: z.string().trim().toUpperCase().optional(),
      city: z.string().trim().toUpperCase().optional(),
      job_title: z.string().trim().optional(),
      company: z.string().trim().optional(),
      sortBy: z.enum(['approvals', 'salary']).default('approvals'),
      limit: z.coerce.number().int().min(1).max(500).default(50),
      minApprovals: z.coerce.number().int().min(0).optional(),
    })
    .parse(req.query);

  const where: string[] = ["employer_name IS NOT NULL AND employer_name <> ''"];
  const params: any[] = [];

  if (q.year) {
    params.push(q.year);
    where.push(`fiscal_year = $${params.length}`);
  }
  if (q.state) {
    params.push(q.state);
    where.push(`TRIM(UPPER(worksite_state)) = $${params.length}`);
  }
  if (q.city) {
    params.push(q.city);
    where.push(`TRIM(UPPER(worksite_city)) = $${params.length}`);
  }
  if (q.job_title) {
    params.push(`%${q.job_title}%`);
    where.push(`job_title ILIKE $${params.length}`);
  }
  if (q.company) {
    params.push(`%${q.company}%`);
    where.push(`employer_name ILIKE $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  
  // Default to min 100 approvals when sorting by salary to avoid outliers.
  let minApprovals = q.minApprovals ?? (q.sortBy === 'salary' ? 100 : 0);
  
  if (minApprovals > 0) {
    params.push(minApprovals);
  }

  const havingSql = minApprovals > 0 ? `HAVING SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END) >= $${params.length}` : '';
  
  params.push(q.limit);

  const sql = `
    WITH base AS (
      SELECT
        employer_name_normalized AS employer_norm,
        case_status,
        wage_rate_of_pay_from,
        wage_unit_of_pay
      FROM lca_raw
      ${whereSql}
    ), agg AS (
      SELECT
        employer_norm,
        COUNT(*)::int AS filings,
        SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals,
        AVG(${ANNUAL_WAGE_SQL}) AS avg_salary
      FROM base
      GROUP BY employer_norm
      ${havingSql}
    )
    SELECT
      a.employer_norm,
      COALESCE(c.name, a.employer_norm) AS company_name,
      c.slug AS company_slug,
      a.filings,
      a.approvals,
      ROUND(a.avg_salary, 2)::numeric AS avg_salary
    FROM agg a
    LEFT JOIN companies c ON c.employer_name_normalized = a.employer_norm
    ORDER BY ${q.sortBy === 'salary' ? 'a.avg_salary DESC NULLS LAST, a.approvals DESC' : 'a.approvals DESC'}
    LIMIT $${params.length};
  `;

  const res = await pool.query(sql, params);
  cache.set(cacheKey, res.rows);
  return reply.send(ok(res.rows));
});

app.get('/api/v1/rankings/summary', async (req, reply) => {
  const cacheKey = `summary:${JSON.stringify(req.query)}`;
  const cached = cache.get(cacheKey);
  if (cached) return reply.send(ok(cached));

  const q = z
    .object({
      year: z.coerce.number().int().min(2000).max(2100).optional(),
      state: z.string().trim().toUpperCase().optional(),
      city: z.string().trim().toUpperCase().optional(),
      job_title: z.string().trim().optional(),
      company: z.string().trim().optional(),
    })
    .parse(req.query);

  const exactWhere: string[] = ["employer_name IS NOT NULL AND employer_name <> ''"];
  const exactParams: any[] = [];

  const trendWhere: string[] = ["employer_name IS NOT NULL AND employer_name <> ''"];
  const trendParams: any[] = [];

  if (q.year) {
    exactParams.push(q.year);
    exactWhere.push(`fiscal_year = $${exactParams.length}`);
  }

  if (q.state) {
    const val = q.state;

    exactParams.push(val);
    exactWhere.push(`TRIM(UPPER(worksite_state)) = $${exactParams.length}`);

    trendParams.push(val);
    trendWhere.push(`TRIM(UPPER(worksite_state)) = $${trendParams.length}`);
  }

  if (q.city) {
    const val = q.city;

    exactParams.push(val);
    exactWhere.push(`TRIM(UPPER(worksite_city)) = $${exactParams.length}`);

    trendParams.push(val);
    trendWhere.push(`TRIM(UPPER(worksite_city)) = $${trendParams.length}`);
  }

  if (q.job_title) {
    const val = `%${q.job_title}%`;

    exactParams.push(val);
    exactWhere.push(`job_title ILIKE $${exactParams.length}`);

    trendParams.push(val);
    trendWhere.push(`job_title ILIKE $${trendParams.length}`);
  }

  if (q.company) {
    const val = `%${q.company}%`;

    exactParams.push(val);
    exactWhere.push(`employer_name ILIKE $${exactParams.length}`);

    trendParams.push(val);
    trendWhere.push(`employer_name ILIKE $${trendParams.length}`);
  }

  const exactWhereSql = exactWhere.length ? `WHERE ${exactWhere.join(' AND ')}` : '';
  const trendWhereSql = trendWhere.length ? `WHERE ${trendWhere.join(' AND ')}` : '';

  const exactSql = `
    SELECT
      COUNT(*)::int AS total_filings,
      COALESCE(SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END), 0)::int AS total_approvals,
      COALESCE(AVG(${ANNUAL_WAGE_SQL}), 0) AS avg_salary
    FROM lca_raw
    ${exactWhereSql}
  `;

  const trendSql = `
    SELECT
      fiscal_year AS year,
      COUNT(*)::int AS filings,
      COALESCE(SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END), 0)::int AS approvals,
      COALESCE(AVG(${ANNUAL_WAGE_SQL}), 0) AS avg_salary
    FROM lca_raw
    ${trendWhereSql}
    GROUP BY fiscal_year
    ORDER BY fiscal_year ASC
  `;

  const [exactRes, trendRes] = await Promise.all([
    pool.query(exactSql, exactParams),
    pool.query(trendSql, trendParams)
  ]);

  const finalData = {
    totals: exactRes.rows[0] || { total_filings: 0, total_approvals: 0, avg_salary: 0 },
    trend: trendRes.rows || []
  };

  cache.set(cacheKey, finalData);
  return reply.send(ok(finalData));
});


async function main() {
  // Verify DB connection early
  await pool.query('SELECT 1');

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
