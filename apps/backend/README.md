# Backend API (Fastify)

This is a high-performance REST API built with Fastify and Node.js, designed to handle large-scale analytical queries against millions of H1B records.

## ⚡️ Performance Features

- **LRU In-Memory Cache**: Implements an elastic caching layer to prevent CPU exhaustion on small instances.
  - Sub-millisecond response times for cached queries.
  - Configurable TTL and cache size in `server.ts`.
- **Query Optimization**: Leverages PostgreSQL 16 **Covering Indexes** for Index-Only Scans.
- **Zod Validation**: Strict schema validation for all incoming query parameters.

## Setup

1. Copy the `.env.example` file:

   ```bash
   cp .env.example .env
   ```

   Provide your actual database credentials inside `.env`.

   For chatbot support, also set:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (default: `gemini-2.5-flash`)
   - `CHAT_RATE_LIMIT_PER_MIN` (default: `20`)

2. Install dependencies:
   ```bash
   npm install
   ```

## Running Locally

To run the backend independently (without Docker Compose):

```bash
npm run dev
```

The server will listen on port `8089` by default.

To apply the SQL migrations in `migrations/` manually:

```bash
npm run build
npm run migrate
```

The root `docker-compose.yml` also runs this migration step automatically before starting `backend`.

## API Endpoints

- `GET /health`: Healthcheck.
- `GET /api/v1/chat/status`: Returns whether chat is enabled plus the configured Gemini model and rate limit.
- `GET /api/v1/meta/years`: Retrieve available fiscal years.
- `GET /api/v1/companies`: Paginated company list and search.
- `GET /api/v1/companies/slug/:slug`: Fetch company details by SEO-friendly slug.
- `GET /api/v1/rankings/summary`: aggregate statistics for rankings.
- `GET /api/v1/debug/cache`: Monitor LRU cache usage and hits.
- `POST /api/v1/chat`: Gemini-powered H1B chatbot endpoint with database-grounded RAG context. Upstream quota/model errors are returned in the response message for easier debugging.

## Observability

You can monitor the internal state of the cache at:
`http://localhost:8089/api/v1/debug/cache`
