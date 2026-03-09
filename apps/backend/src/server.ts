import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
const { Pool } = pg;
import { z } from 'zod';
import { LRUCache } from 'lru-cache';
import { slugify } from './slug.js';
import { buildChatLogsWhereClause, extractUpstreamErrorMessage } from './chatUtils.js';
import { METRIC_DEFINITIONS, METRIC_CONTRACT_DOC_PATH } from './metricsContract.js';


const envSchema = z.object({
  PORT: z.coerce.number().default(8089),
  DATABASE_URL: z.string().default('postgres://h1b:change_me@127.0.0.1:5432/h1bfriend'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  CHAT_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).max(120).default(20),
  ADMIN_TOKEN: z.string().optional(),
});

const env = envSchema.parse({
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  CHAT_RATE_LIMIT_PER_MIN: process.env.CHAT_RATE_LIMIT_PER_MIN,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
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
    `WITH agg AS (
       SELECT
         employer_name_normalized AS employer_norm,
         COUNT(*)::int AS filings,
         SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals
       FROM lca_raw
       WHERE fiscal_year = $1
         AND employer_name_normalized IS NOT NULL
         AND employer_name_normalized <> ''
       GROUP BY 1
     )
     SELECT
       COALESCE(c.name, agg.employer_norm) AS name,
       agg.approvals AS h1b_applications_approved,
       agg.filings AS h1b_applications_filed
     FROM agg
     LEFT JOIN companies c ON c.employer_name_normalized = agg.employer_norm
     ORDER BY agg.approvals DESC NULLS LAST
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

function adminToken() {
  return env.ADMIN_TOKEN;
}

function hasValidAdminToken(req: any) {
  const token = adminToken();
  const providedToken = String(req.headers['x-admin-token'] || '');
  return Boolean(token) && providedToken === token;
}

async function logChatEvent(event: {
  clientIp: string;
  requestedYear?: number;
  model: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  latestUserPrompt: string;
  answer?: string;
  transcript: Array<{ role: 'user' | 'assistant'; text: string }>;
}) {
  try {
    await pool.query(
      `INSERT INTO chat_logs (
         client_ip,
         requested_year,
         model,
         success,
         error_code,
         error_message,
         latest_user_prompt,
         answer,
         transcript
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        event.clientIp,
        event.requestedYear ?? null,
        event.model,
        event.success,
        event.errorCode ?? null,
        event.errorMessage ?? null,
        event.latestUserPrompt,
        event.answer ?? null,
        JSON.stringify(event.transcript),
      ]
    );
  } catch (error) {
    app.log.error({ error }, 'Failed to persist chat log');
  }
}

app.get('/health', async () => ({ ok: true }));

app.get('/api/v1/chat/status', async () => {
  return ok({
    enabled: Boolean(env.GEMINI_API_KEY),
    model: env.GEMINI_MODEL,
    rate_limit_per_min: env.CHAT_RATE_LIMIT_PER_MIN,
  });
});

app.post('/api/v1/admin/login', async (req, reply) => {
  const token = adminToken();
  const body = z.object({
    token: z.string().min(1),
  }).parse(req.body ?? {});

  if (!token || body.token !== token) {
    return reply.code(401).send({ success: false, error: 'unauthorized', message: 'Invalid admin token.' });
  }

  return reply.send(ok({ authenticated: true }));
});

app.get('/api/v1/chat/logs', async (req, reply) => {
  if (!hasValidAdminToken(req)) {
    return reply.code(401).send({ success: false, error: 'unauthorized', message: 'Admin token required.' });
  }

  reply.header('Cache-Control', 'private, no-store, max-age=0');

  const q = z.object({
    page: z.coerce.number().int().min(0).default(0),
    size: z.coerce.number().int().min(1).max(200).default(50),
    success: z.coerce.boolean().optional(),
  }).parse(req.query ?? {});

  const { whereSql, params } = buildChatLogsWhereClause(q.success);

  const totalRes = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM chat_logs ${whereSql}`,
    params
  );

  params.push(q.size);
  const limitParam = `$${params.length}`;
  params.push(q.page * q.size);
  const offsetParam = `$${params.length}`;

  const rowsRes = await pool.query(
    `SELECT
       id,
       created_at,
       client_ip,
       requested_year,
       model,
       success,
       error_code,
       error_message,
       latest_user_prompt,
       answer,
       transcript
     FROM chat_logs
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    params
  );

  return reply.send(ok(
    page(rowsRes.rows, q.page, q.size, totalRes.rows[0]?.total ?? 0)
  ));
});

app.post('/api/v1/job-alert-subscriptions', async (req, reply) => {
  const body = z.object({
    email: z.string().trim().email().max(320),
    keywords: z.string().trim().max(120).optional().or(z.literal('')),
    state: z.string().trim().toUpperCase().max(2).optional().or(z.literal('')),
    title: z.string().trim().max(120).optional().or(z.literal('')),
    frequency: z.enum(['daily', 'weekly']).default('weekly'),
    source_page: z.string().trim().max(120).optional().or(z.literal('')),
  }).parse(req.body ?? {});

  const normalized = {
    email: body.email.toLowerCase(),
    keywords: body.keywords?.trim() || null,
    state: body.state?.trim() || null,
    title: body.title?.trim() || null,
    frequency: body.frequency,
    source_page: body.source_page?.trim() || null,
  };

  const existingRes = await pool.query(
    `SELECT id
     FROM job_alert_subscriptions
     WHERE lower(email) = lower($1)
       AND coalesce(lower(keywords), '') = coalesce(lower($2), '')
       AND coalesce(upper(state), '') = coalesce(upper($3), '')
       AND coalesce(lower(title), '') = coalesce(lower($4), '')
       AND frequency = $5
     LIMIT 1`,
    [
      normalized.email,
      normalized.keywords,
      normalized.state,
      normalized.title,
      normalized.frequency,
    ]
  );

  if (existingRes.rows[0]?.id) {
    await pool.query(
      `UPDATE job_alert_subscriptions
       SET active = true,
           source_page = coalesce($2, source_page),
           updated_at = now()
       WHERE id = $1`,
      [existingRes.rows[0].id, normalized.source_page]
    );

    return reply.send(ok({
      subscribed: true,
      existing: true,
      id: existingRes.rows[0].id,
    }, 'Subscription already existed and was reactivated.'));
  }

  const insertRes = await pool.query<{ id: string }>(
    `INSERT INTO job_alert_subscriptions (
       email, keywords, state, title, frequency, source_page
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      normalized.email,
      normalized.keywords,
      normalized.state,
      normalized.title,
      normalized.frequency,
      normalized.source_page,
    ]
  );

  return reply.send(ok({
    subscribed: true,
    existing: false,
    id: insertRes.rows[0]?.id ?? null,
  }, 'Subscription created.'));
});

app.get('/api/v1/admin/job-alert-subscriptions', async (req, reply) => {
  if (!hasValidAdminToken(req)) {
    return reply.code(401).send({ success: false, error: 'unauthorized', message: 'Admin token required.' });
  }

  reply.header('Cache-Control', 'private, no-store, max-age=0');

  const q = z.object({
    page: z.coerce.number().int().min(0).default(0),
    size: z.coerce.number().int().min(1).max(200).default(50),
    active: z.coerce.boolean().optional(),
  }).parse(req.query ?? {});

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (q.active !== undefined) {
    params.push(q.active);
    whereClauses.push(`active = $${params.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalRes = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM job_alert_subscriptions ${whereSql}`,
    params
  );

  params.push(q.size);
  const limitParam = `$${params.length}`;
  params.push(q.page * q.size);
  const offsetParam = `$${params.length}`;

  const rowsRes = await pool.query(
    `SELECT
       id,
       created_at,
       updated_at,
       email,
       keywords,
       state,
       title,
       frequency,
       active,
       source_page,
       last_sent_at
     FROM job_alert_subscriptions
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    params
  );

  return reply.send(ok(
    page(rowsRes.rows, q.page, q.size, totalRes.rows[0]?.total ?? 0)
  ));
});

app.post('/api/v1/chat', async (req, reply) => {
  const ip = req.ip || 'unknown';
  if (isRateLimited(ip)) {
    await logChatEvent({
      clientIp: ip,
      requestedYear: undefined,
      model: env.GEMINI_MODEL,
      success: false,
      errorCode: 'rate_limited',
      errorMessage: 'Too many chat requests. Please try again in a minute.',
      latestUserPrompt: '[rate limited before body parse]',
      transcript: [],
    });
    return reply.code(429).send({ success: false, error: 'rate_limited', message: 'Too many chat requests. Please try again in a minute.' });
  }

  if (!env.GEMINI_API_KEY) {
    req.log.error('GEMINI_API_KEY is missing');
    await logChatEvent({
      clientIp: ip,
      requestedYear: undefined,
      model: env.GEMINI_MODEL,
      success: false,
      errorCode: 'misconfigured',
      errorMessage: 'Chat is not configured on the server.',
      latestUserPrompt: '[chat misconfigured before body parse]',
      transcript: [],
    });
    return reply.code(500).send({ success: false, error: 'misconfigured', message: 'Chat is not configured on the server.' });
  }

  const body = z.object({
    messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(2000) })).min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }).parse(req.body ?? {});

  const latestUserPrompt = [...body.messages].reverse().find((m) => m.role === 'user')?.text;
  if (!latestUserPrompt) {
    await logChatEvent({
      clientIp: ip,
      requestedYear: body.year,
      model: env.GEMINI_MODEL,
      success: false,
      errorCode: 'invalid_input',
      errorMessage: 'At least one user message is required.',
      latestUserPrompt: '[missing user message]',
      transcript: body.messages,
    });
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
    await logChatEvent({
      clientIp: ip,
      requestedYear: body.year,
      model: env.GEMINI_MODEL,
      success: false,
      errorCode: 'llm_upstream_error',
      errorMessage: upstreamMessage || 'Gemini API request failed.',
      latestUserPrompt,
      transcript: body.messages,
    });
    return reply.code(502).send({
      success: false,
      error: 'llm_upstream_error',
      message: upstreamMessage || 'Gemini API request failed.',
    });
  }

  const geminiJson: any = await geminiResponse.json();
  const answer = geminiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('').trim();

  if (!answer) {
    await logChatEvent({
      clientIp: ip,
      requestedYear: body.year,
      model: env.GEMINI_MODEL,
      success: false,
      errorCode: 'empty_llm_response',
      errorMessage: 'Gemini returned an empty response.',
      latestUserPrompt,
      transcript: body.messages,
    });
    return reply.code(502).send({ success: false, error: 'empty_llm_response', message: 'Gemini returned an empty response.' });
  }

  await logChatEvent({
    clientIp: ip,
    requestedYear: body.year,
    model: env.GEMINI_MODEL,
    success: true,
    latestUserPrompt,
    answer,
    transcript: body.messages,
  });

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

  const latestYearRes = await pool.query('SELECT MAX(fiscal_year)::int AS y FROM lca_raw');
  const selectedYear = q.year ?? latestYearRes.rows[0]?.y;
  if (!selectedYear) {
    return sendCachedOk(reply, page([], q.page, q.size, 0));
  }

  const offset = q.page * q.size;
  const params: any[] = [selectedYear];
  const where: string[] = ['yr.fiscal_year = $1'];

  if (q.keyword) {
    params.push(`%${q.keyword}%`);
    where.push(`COALESCE(c.name, yr.employer_norm) ILIKE $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const totalRes = await pool.query(
    `WITH yr AS (
       SELECT
         employer_name_normalized AS employer_norm,
         COUNT(*)::int AS h1b_applications_filed,
         SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS h1b_applications_approved,
         fiscal_year
       FROM lca_raw
       WHERE fiscal_year = $1
         AND employer_name_normalized IS NOT NULL
         AND employer_name_normalized <> ''
       GROUP BY employer_name_normalized, fiscal_year
     )
     SELECT COUNT(*)::int AS c
     FROM yr
     LEFT JOIN companies c ON c.employer_name_normalized = yr.employer_norm
     ${whereSql}`,
    params
  );

  const total = totalRes.rows[0]?.c ?? 0;
  const direction = q.sortDirection;
  const orderBy = q.sortBy === 'name'
    ? `name ${direction}`
    : `h1b_applications_filed ${direction} NULLS LAST, name ASC`;

  params.push(q.size, offset);

  const rowsRes = await pool.query(
    `WITH yr AS (
       SELECT
         employer_name_normalized AS employer_norm,
         COUNT(*)::int AS h1b_applications_filed,
         SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS h1b_applications_approved,
         fiscal_year
       FROM lca_raw
       WHERE fiscal_year = $1
         AND employer_name_normalized IS NOT NULL
         AND employer_name_normalized <> ''
       GROUP BY employer_name_normalized, fiscal_year
     )
     SELECT
       c.id,
       c.slug,
       COALESCE(c.name, yr.employer_norm) AS name,
       COALESCE(c.h1b_sponsorship_status, 'active') AS h1b_sponsorship_status,
       c.h1b_sponsorship_confidence,
       yr.h1b_applications_filed,
       yr.h1b_applications_approved,
       yr.fiscal_year AS last_h1b_filing_year
     FROM yr
     LEFT JOIN companies c ON c.employer_name_normalized = yr.employer_norm
     ${whereSql}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
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
  const q = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }).parse(req.query ?? {});
  const cacheKey = `company:slug:${params.slug}:${q.year ?? 'latest'}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return sendCachedOk(reply, cached);

  const companyRes = await pool.query('SELECT * FROM companies WHERE slug=$1', [params.slug]);
  if (companyRes.rowCount === 0) return reply.code(404).send({ success: false, error: 'not_found' });

  const company = companyRes.rows[0];
  const latestYearRes = await pool.query('SELECT MAX(fiscal_year)::int AS y FROM lca_raw');
  const selectedYear = q.year ?? latestYearRes.rows[0]?.y ?? company.last_h1b_filing_year;

  const yearAggRes = await pool.query(
    `SELECT
       COUNT(*)::int AS filed,
       SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approved
     FROM lca_raw
     WHERE employer_name_normalized = $1
       AND fiscal_year = $2`,
    [company.employer_name_normalized, selectedYear]
  );

  const yearAgg = yearAggRes.rows[0] || { filed: 0, approved: 0 };
  const payload = {
    ...company,
    h1b_applications_filed: Number(yearAgg.filed ?? 0),
    h1b_applications_approved: Number(yearAgg.approved ?? 0),
    last_h1b_filing_year: selectedYear,
  };

  return sendCachedOk(reply, setCached(cacheKey, payload));
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

app.post('/api/v1/plan/generate', async (req, reply) => {
  const body = z.object({
    target_role: z.string().trim().min(2).max(120),
    target_state: z.string().trim().min(2).max(50).optional(),
    target_city: z.string().trim().min(2).max(80).optional(),
    years_experience: z.coerce.number().int().min(0).max(30).default(0),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }).parse(req.body ?? {});

  const latestYearRes = await pool.query('SELECT MAX(fiscal_year)::int AS y FROM lca_raw');
  const selectedYear = body.year ?? latestYearRes.rows[0]?.y;
  if (!selectedYear) {
    return reply.code(500).send({ success: false, error: 'no_data', message: 'No H1B dataset year available.' });
  }

  const params: any[] = [selectedYear, `%${body.target_role}%`];
  const where: string[] = [
    'fiscal_year = $1',
    'job_title ILIKE $2',
    "employer_name_normalized IS NOT NULL AND employer_name_normalized <> ''",
  ];

  if (body.target_state) {
    params.push(body.target_state.trim().toUpperCase());
    where.push(`TRIM(UPPER(worksite_state)) = $${params.length}`);
  }

  if (body.target_city) {
    params.push(body.target_city.trim().toUpperCase());
    where.push(`TRIM(UPPER(worksite_city)) = $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const topSponsorsRes = await pool.query(
    `WITH agg AS (
      SELECT
        employer_name_normalized AS employer_norm,
        COUNT(*)::int AS filings,
        SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals,
        ROUND(AVG(${SANITY_WAGE_SQL}), 0)::numeric AS avg_salary
      FROM lca_raw
      ${whereSql}
      GROUP BY employer_name_normalized
    )
    SELECT
      COALESCE(c.name, agg.employer_norm) AS company_name,
      c.slug AS company_slug,
      agg.filings,
      agg.approvals,
      COALESCE(agg.avg_salary, 0) AS avg_salary,
      CASE WHEN agg.filings > 0 THEN ROUND((agg.approvals::numeric / agg.filings) * 100, 1) ELSE 0 END AS approval_rate
    FROM agg
    LEFT JOIN companies c ON c.employer_name_normalized = agg.employer_norm
    ORDER BY agg.approvals DESC NULLS LAST, agg.filings DESC NULLS LAST
    LIMIT 20`,
    params
  );

  const suggestedTitlesRes = await pool.query(
    `SELECT
      REGEXP_REPLACE(TRIM(job_title), '\\s+', ' ', 'g') AS title,
      COUNT(*)::int AS filings,
      SUM(CASE WHEN case_status ILIKE 'CERTIFIED%' THEN 1 ELSE 0 END)::int AS approvals
    FROM lca_raw
    ${whereSql}
    GROUP BY 1
    ORDER BY approvals DESC NULLS LAST, filings DESC NULLS LAST
    LIMIT 8`,
    params
  );

  const sponsors = topSponsorsRes.rows.map((r: any) => ({
    company_name: r.company_name,
    company_slug: r.company_slug,
    approvals: Number(r.approvals ?? 0),
    filings: Number(r.filings ?? 0),
    avg_salary: Number(r.avg_salary ?? 0),
    approval_rate: Number(r.approval_rate ?? 0),
    explainability: [
      `${Number(r.approvals ?? 0).toLocaleString()} approvals in FY${selectedYear}`,
      `${Number(r.approval_rate ?? 0)}% approval rate for similar role filings`,
      body.target_state ? `Matches target state: ${body.target_state.toUpperCase()}` : 'Strong national sponsorship history',
    ],
  }));

  const titles = suggestedTitlesRes.rows.map((r: any) => ({
    title: r.title,
    filings: Number(r.filings ?? 0),
    approvals: Number(r.approvals ?? 0),
  }));

  const checklist = [
    `Day 1: Apply to top 5 sponsors for ${body.target_role}`,
    `Day 2: Tailor resume keywords to ${body.target_role} and target locations`,
    'Day 3: Submit 5-8 additional applications with strongest approval history',
    'Day 5: Follow up on submitted applications and recruiter outreach',
    'Day 7: Review response quality and rebalance sponsor/title targets',
  ];

  return reply.send(ok({
    year: selectedYear,
    profile: {
      target_role: body.target_role,
      target_state: body.target_state ?? null,
      target_city: body.target_city ?? null,
      years_experience: body.years_experience,
    },
    recommendations: sponsors,
    suggested_titles: titles,
    weekly_checklist: checklist,
    metric_definitions: {
      ...METRIC_DEFINITIONS,
      approval_rate: 'approvals / filings * 100',
      contract_doc: METRIC_CONTRACT_DOC_PATH,
    },
  }));
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
