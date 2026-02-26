# H1B Friendly

A unified monorepo containing the ETL pipeline, REST API backend, and Next.js frontend for analyzing H1B LCA data.

## Architecture

* **`apps/etl`**: A pure Python pipeline using `pandas` and `psycopg2` to ingest DOL combined LCA Excel files quickly and efficiently into PostgreSQL.
* **`apps/backend`**: A Node.js + Fastify backend that provides the REST API for query and search functionality.
* **`apps/web`**: A Next.js App Router application built for high SEO performance and dynamic data visualization. 

## Requirements

* Docker & Docker Compose
* Node.js 20+
* Python 3.9+ (for ETL only)

## Quick Start (Local Development)

1. Create a `.env` file for the necessary apps based on their respective `.env.example` files, setting up a secure `POSTGRES_PASSWORD`. **Important**: Never commit your `.env` files to git.
2. Run the full stack via Docker Compose from this root directory:
   ```bash
   docker compose up -d
   ```
3. To bootstrap the database with H1B data, head over to `apps/etl/README.md` and follow the Python pipeline instructions.

## Deployment

Refer to `infra/README.md` for our Terraform deployment approach on AWS.
