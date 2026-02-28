# ETL Pipeline (Python)

This directory contains the Python-based ETL engine for ingesting DOL Combined LCA Disclosure Excel files natively into Postgres.

## Setup

1. Copy `.env.example` to `.env` and set your `DATABASE_URL`:

   ```bash
   cp .env.example .env
   ```

   **DO NOT** commit your `.env` file containing actual passwords.
   Ensure the database URL points to your host-mapped PostgreSQL port (default `127.0.0.1:5432` if using `docker compose` from root).

2. Create a virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

## Usage

Run the `main.py` script with the absolute or relative path to the official DOL `.xlsx` dataset:

```bash
python3 main.py <path_to_excel_file> <fiscal_year>
```

Example:

```bash
python3 main.py ../../h1b-data/LCA_Disclosure_Data_FY2025_Q1.xlsx 2025
```

The script will automatically migrate schemas, drop/recreated indexes for bulk COPY speed, and regenerate all the derived `companies` and `jobs` caches.

### Data Normalization

A key feature of the pipeline is the **Employer Normalization** engine, which consolidates varying name formats (e.g., "GOOGLE LLC" vs "GOOGLE INC") into a single consistent identifier. This enables accurate aggregate rankings and salary calculations across the entire dataset.
