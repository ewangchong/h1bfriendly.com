import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
const { Pool } = pg;
import { z } from 'zod';
import { LRUCache } from 'lru-cache';
import { slugify } from './slug.js';


const envSchema = z.object({
  PORT: z.coerce.number().default(8089),
  DATABASE_URL: z.string().default('postgres://h1b:change_me@127.0.0.1:5432/h1bfriend'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  CHAT_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).max(120).default(20),
});

const env = envSchema.parse({
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  CHAT_RATE_LIMIT_PER_MIN: process.env.CHAT_RATE_LIMIT_PER_MIN,
});

const pool = new Pool({ connectionString: env.DATABASE_URL });

const ANNUAL_WAGE_SQL = `
  CASE 
    WHEN wage_rate_of_pay_from ~ '^[0-9]+(\\.[0-9]+)?$' THEN 
      (CAST(wage_rate_of_pay_from AS NUMERIC) * 
      CASE 
        WHEN wage_unit_of_pay ILIKE 'Year' THEN 1 
        WHEN wage_unit_of_pay ILIKE 'Month' THEN 12 
        WHEN wage_unit_of_pay ILIKE 'Bi-Weekly' THEN 26 
        WHEN wage_unit_of_pay ILIKE 'Week' THEN 52 
        WHEN wage_unit_of_pay ILIKE 'Hour' THEN 2080 
        ELSE 1 
      END)
    ELSE NULL 
  END
`;

// Purely for aggregate rankings/averages to avoid data-entry errors skewing results
const SANITY_WAGE_SQL = `
  CASE 
    WHEN (${ANNUAL_WAGE_SQL}) BETWEEN 10000 AND 5000000 THEN (${ANNUAL_WAGE_SQL})
    ELSE NULL
  END
`;

const cache = new LRUCache<string, any>({
  max: 10000,
  ttl: 1000 * 60 * 60 * 24, // 24 hours (data changes quarterly)
});

const SHARED_CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

const CHAT_WINDOW_MS = 60_000;
const chatRateLimiter = new Map<string, { count: number; windowStart: number }>();
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'what', 'when', 'where', 'which',
  'about', 'have', 'has', 'had', 'into', 'your', 'visa', 'h1b', 'sponsor', 'sponsorship',
  'companies', 'company', 'jobs', 'job', 'please', 'need', 'show', 'best', 'help'
]);

function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

function setCached<T>(key: string, value: T) {
  cache.set(key, value);
  return value;
}

function applySharedCacheHeaders(reply: any) {
  reply.header('Cache-Control', SHARED_CACHE_CONTROL);
}

function sendCachedOk<T>(reply: any, data: T, message?: string) {
  applySharedCacheHeaders(reply);
  return reply.send(ok(data, message));
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const record = chatRateLimiter.get(ip);

  if (!record || now - record.windowStart >= CHAT_WINDOW_MS) {
    chatRateLimiter.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (record.count >= env.CHAT_RATE_LIMIT_PER_MIN) return true;

  record.count += 1;
  chatRateLimiter.set(ip, record);
  return false;
}

function extractTokens(text: string) {
  return Array.from(new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
  )).slice(0, 8);
}

async function buildRagContext(question: string, year?: number) {
  const latestYearRes = await pool.query('SELECT MAX(fiscal_year)::int AS y FROM lca_raw');
  const selectedYear = year ?? latestYearRes.rows[0]?.y;

  if (!selectedYear) {
    return 'No data context available.';
  }

  const totalsRes = await pool.query(
    `SELECT
      COUNT(*)::int AS filings,
      SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals,
      ROUND(AVG(${SANITY_WAGE_SQL}), 2)::numeric AS avg_salary
     FROM lca_raw
     WHERE fiscal_year = $1`,
    [selectedYear]
  );

  const topCompaniesRes = await pool.query(
    `SELECT name, h1b_applications_approved, h1b_applications_filed
     FROM companies
     WHERE last_h1b_filing_year = $1
     ORDER BY h1b_applications_approved DESC NULLS LAST
     LIMIT 10`,
    [selectedYear]
  );

  const topTitlesRes = await pool.query(
    `SELECT job_title AS title, COUNT(*)::int AS filings
     FROM lca_raw
     WHERE fiscal_year = $1
       AND job_title IS NOT NULL
       AND job_title <> ''
     GROUP BY 1
     ORDER BY filings DESC
     LIMIT 10`,
    [selectedYear]
  );

  const tokens = extractTokens(question);
  let relevantCompanies: any[] = [];

  if (tokens.length > 0) {
    const patterns = tokens.map((t) => `%${t}%`);
    const relevantRes = await pool.query(
      `SELECT
         employer_name_normalized AS company,
         COUNT(*)::int AS filings,
         SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals,
         ROUND(AVG(${SANITY_WAGE_SQL}), 2)::numeric AS avg_salary
       FROM lca_raw
       WHERE fiscal_year = $1
         AND (
           employer_name_normalized ILIKE ANY($2::text[])
           OR job_title ILIKE ANY($2::text[])
         )
       GROUP BY 1
       ORDER BY approvals DESC
       LIMIT 8`,
      [selectedYear, patterns]
    );
    relevantCompanies = relevantRes.rows;
  }

  const totals = totalsRes.rows[0] || { filings: 0, approvals: 0, avg_salary: null };
  const topCompanies = topCompaniesRes.rows
    .map((r) => `${r.name} (approvals: ${r.h1b_applications_approved ?? 0}, filings: ${r.h1b_applications_filed ?? 0})`)
    .join('; ');
  const topTitles = topTitlesRes.rows
    .map((r) => `${r.title} (${r.filings})`)
    .join('; ');
  const relevant = relevantCompanies.length > 0
    ? relevantCompanies.map((r) => `${r.company} (approvals: ${r.approvals}, filings: ${r.filings}, avg_salary: ${r.avg_salary ?? 'N/A'})`).join('; ')
    : 'No highly relevant company matches found for the question tokens.';

  return [
    `Dataset year used: ${selectedYear}`,
    `Year totals — filings: ${totals.filings ?? 0}, approvals: ${totals.approvals ?? 0}, avg_salary: ${totals.avg_salary ?? 'N/A'}`,
    `Top companies (year): ${topCompanies || 'N/A'}`,
    `Top job titles (year): ${topTitles || 'N/A'}`,
    `Question-relevant slices: ${relevant}`,
  ].join('\n');
}

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

function extractUpstreamErrorMessage(raw: string) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const details = parsed?.error?.details;
    const quotaMessage = Array.isArray(details)
      ? details
          .flatMap((detail: any) => Array.isArray(detail?.violations) ? detail.violations : [])
          .map((violation: any) => {
            const metric = violation?.quotaMetric;
            const quotaId = violation?.quotaId;
            const model = violation?.quotaDimensions?.model;
            if (!metric && !quotaId && !model) return null;
            return [metric, quotaId, model ? `model=${model}` : null].filter(Boolean).join(' | ');
          })
          .filter(Boolean)
      : [];

    const message = parsed?.error?.message;
    if (quotaMessage.length > 0) {
      return `${message} (${quotaMessage.join('; ')})`;
    }
    return message || raw;
  } catch {
    return raw;
  }
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

app.get('/api/v1/chat/status', async () => {
  return ok({
    enabled: Boolean(env.GEMINI_API_KEY),
    model: env.GEMINI_MODEL,
    rate_limit_per_min: env.CHAT_RATE_LIMIT_PER_MIN,
  });
});

app.post('/api/v1/chat', async (req, reply) => {
  const ip = req.ip || 'unknown';
  if (isRateLimited(ip)) {
    return reply.code(429).send({ success: false, error: 'rate_limited', message: 'Too many chat requests. Please try again in a minute.' });
  }

  if (!env.GEMINI_API_KEY) {
    req.log.error('GEMINI_API_KEY is missing');
    return reply.code(500).send({ success: false, error: 'misconfigured', message: 'Chat is not configured on the server.' });
  }

  const body = z.object({
    messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(2000) })).min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }).parse(req.body ?? {});

  const latestUserPrompt = [...body.messages].reverse().find((m) => m.role === 'user')?.text;
  if (!latestUserPrompt) {
    return reply.code(400).send({ success: false, error: 'invalid_input', message: 'At least one user message is required.' });
  }

  const ragContext = await buildRagContext(latestUserPrompt, body.year);

  const systemInstruction = [
    'You are an H1B data assistant for h1bfriend.com.',
    'Always answer in English.',
    'Use ONLY the provided data context for factual claims about approvals, filings, and salary.',
    'If context is insufficient, clearly say what is missing and avoid making up numbers.',
    'Keep answers practical and concise.'
  ].join(' ');

  const promptTranscript = body.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join('\n');

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [{
          role: 'user',
          parts: [{
            text: `Data context:\n${ragContext}\n\nConversation:\n${promptTranscript}\n\nAnswer the latest user request.`
          }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
        },
      }),
    }
  );

  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text();
    req.log.error({ status: geminiResponse.status, body: errText }, 'Gemini API failed');
    const upstreamMessage = extractUpstreamErrorMessage(errText);
    return reply.code(502).send({
      success: false,
      error: 'llm_upstream_error',
      message: upstreamMessage || 'Gemini API request failed.',
    });
  }

  const geminiJson: any = await geminiResponse.json();
  const answer = geminiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('').trim();

  if (!answer) {
    return reply.code(502).send({ success: false, error: 'empty_llm_response', message: 'Gemini returned an empty response.' });
  }

  return reply.send(ok({
    answer,
    model: env.GEMINI_MODEL,
    rag_year: body.year ?? null,
  }));
});

app.get('/api/v1/meta/years', async (_req, reply) => {
  const cacheKey = 'meta:years';
  const cached = getCached<number[]>(cacheKey);
  if (cached) return sendCachedOk(reply, cached);

  const res = await pool.query(
    'SELECT DISTINCT fiscal_year::int AS year FROM lca_raw ORDER BY year DESC'
  );
  const years = res.rows.map((r) => r.year);
  return sendCachedOk(reply, setCached(cacheKey, years));
});

app.get('/api/v1/companies', async (req, reply) => {
  const cacheKey = `companies:${JSON.stringify(req.query)}`;
  const cached = getCached<PageResponse<any>>(cacheKey);
  if (cached) return sendCachedOk(reply, cached);

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

  const payload = page(rowsRes.rows, q.page, q.size, total);
  return sendCachedOk(reply, setCached(cacheKey, payload));
});

app.get('/api/v1/companies/:id', async (req, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const res = await pool.query('SELECT * FROM companies WHERE id=$1', [params.id]);
  if (res.rowCount === 0) return reply.code(404).send({ success: false, error: 'not_found' });
  return sendCachedOk(reply, res.rows[0]);
});

app.get('/api/v1/companies/slug/:slug', async (req, reply) => {
  const params = z.object({ slug: z.string().min(1) }).parse(req.params);
  const cacheKey = `company:slug:${params.slug}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return sendCachedOk(reply, cached);

  const res = await pool.query('SELECT * FROM companies WHERE slug=$1', [params.slug]);
  if (res.rowCount === 0) return reply.code(404).send({ success: false, error: 'not_found' });
  return sendCachedOk(reply, setCached(cacheKey, res.rows[0]));
});

app.get('/api/v1/companies/slug/:slug/insights', async (req, reply) => {
  const cacheKey = `company:insights:${JSON.stringify({ params: req.params, query: req.query })}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return sendCachedOk(reply, cached);

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
  return sendCachedOk(reply, setCached(cacheKey, res.rows[0]));
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
  const cached = getCached<any[]>(cacheKey);
  if (cached) return sendCachedOk(reply, cached);

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
    WITH agg AS (
      SELECT
        job_title AS title,
        COUNT(*)::int AS filings,
        MAX(fiscal_year)::int AS last_year
      FROM lca_raw
      ${where} job_title IS NOT NULL AND job_title <> ''
      GROUP BY job_title
    )
    SELECT
      title,
      filings,
      last_year
    FROM agg
    ORDER BY filings DESC
    LIMIT $${params.length};
  `;

  const res = await pool.query(sql, params);
  const rows = res.rows.map((row) => ({
    ...row,
    slug: slugify(row.title),
  }));
  return sendCachedOk(reply, setCached(cacheKey, rows));
});

app.get('/api/v1/titles/:slug/summary', async (req, reply) => {
  const cacheKey = `title:summary:${JSON.stringify({ params: req.params, query: req.query })}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return sendCachedOk(reply, cached);

  const params = z.object({ slug: z.string().min(1) }).parse(req.params);
  const q = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }).parse(req.query);
  const title = titleFromSlug(params.slug);
  const trendCacheKey = `title:trend:${params.slug}`;

  const yearWhere = q.year ? 'AND fiscal_year = $2' : '';
  const summarySql = `
    WITH filtered AS (
      SELECT
        job_title AS title,
        employer_name_normalized AS employer_norm,
        TRIM(worksite_state) AS worksite_state,
        case_status,
        fiscal_year
      FROM lca_raw
      WHERE job_title IS NOT NULL AND job_title <> ''
        AND job_title = $1
        ${yearWhere}
    ), totals AS (
      SELECT
        MAX(title) AS title,
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
    )
    SELECT
      (SELECT row_to_json(totals) FROM totals) AS totals,
      (SELECT COALESCE(json_agg(top_companies), '[]'::json) FROM top_companies) AS top_companies,
      (SELECT COALESCE(json_agg(top_states), '[]'::json) FROM top_states) AS top_states;
  `;

  const trendSql = `
    SELECT
      fiscal_year AS year,
      COUNT(*)::int AS filings,
      SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals
    FROM lca_raw
    WHERE job_title = $1
    GROUP BY fiscal_year
    ORDER BY fiscal_year ASC;
  `;

  const bind = q.year ? [title, q.year] : [title];
  const cachedTrend = getCached<any[]>(trendCacheKey);
  const [summaryRes, trend] = await Promise.all([
    pool.query(summarySql, bind),
    cachedTrend ? Promise.resolve(cachedTrend) : pool.query(trendSql, [title]).then((res) => setCached(trendCacheKey, res.rows)),
  ]);

  if (!summaryRes.rows?.[0]?.totals) return reply.code(404).send({ success: false, error: 'not_found' });

  const payload = {
    ...summaryRes.rows[0],
    trend,
  };

  return sendCachedOk(reply, setCached(cacheKey, payload));
});

app.get('/api/v1/rankings', async (req, reply) => {
  const cacheKey = `rankings:${JSON.stringify(req.query)}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return sendCachedOk(reply, cached);

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
  
  // Default to min 100 approvals when sorting by salary to avoid outliers,
  // BUT if searching for a specific company or job title, lower it to 1 to show niche results.
  const isSpecificSearch = !!(q.company || q.job_title);
  let minApprovals = q.minApprovals ?? (q.sortBy === 'salary' && !isSpecificSearch ? 100 : 0);
  
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
        AVG(${SANITY_WAGE_SQL}) AS avg_salary
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
  return sendCachedOk(reply, setCached(cacheKey, res.rows));
});

app.get('/api/v1/rankings/summary', async (req, reply) => {
  const cacheKey = `summary:${JSON.stringify(req.query)}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return sendCachedOk(reply, cached);

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
      COALESCE(AVG(${SANITY_WAGE_SQL}), 0) AS avg_salary
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

  return sendCachedOk(reply, setCached(cacheKey, finalData));
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
