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

## API Endpoints

- `GET /health`: Healthcheck.
- `GET /api/v1/meta/years`: Retrieve available fiscal years.
- `GET /api/v1/companies`: Paginated company list and search.
- `GET /api/v1/companies/slug/:slug`: Fetch company details by SEO-friendly slug.
- `GET /api/v1/rankings/summary`: aggregate statistics for rankings.
- `GET /api/v1/debug/cache`: Monitor LRU cache usage and hits.

## Observability

You can monitor the internal state of the cache at:
`http://localhost:8089/api/v1/debug/cache`
