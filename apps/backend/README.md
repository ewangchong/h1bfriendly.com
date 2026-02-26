# Backend API (Fastify)

This is the core REST API that serves data to the Next.js frontend. It connects to the shared PostgreSQL database populated by the `etl` pipeline.

## Setup

1. Copy the `.env.example` file:
   ```bash
   cp .env.example .env
   ```
   Provide your actual database credentials inside `.env`. Do not check this file into source control.

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
- `GET /api/v1/jobs`: Paginated individual LCA filings.
- `GET /api/v1/titles`: Job title summaries.
