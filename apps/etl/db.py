import os
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgres://h1b:postgres@127.0.0.1:5432/h1bfriend")

# Initialize a small connection pool
pool = SimpleConnectionPool(1, 10, DATABASE_URL)

def get_connection():
    return pool.getconn()

def release_connection(conn):
    pool.putconn(conn)

def migrate_if_needed():
    """Run table creation SQL if they don't exist yet."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. Create lca_raw table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS lca_raw (
                  id BIGSERIAL PRIMARY KEY,
                  fiscal_year INTEGER NOT NULL,
                  case_number TEXT,
                  case_status TEXT,
                  received_date TEXT,
                  decision_date TEXT,
                  original_cert_date TEXT,
                  visa_class TEXT,
                  job_title TEXT,
                  soc_code TEXT,
                  soc_title TEXT,
                  full_time_position TEXT,
                  begin_date TEXT,
                  end_date TEXT,
                  total_worker_positions TEXT,
                  new_employment TEXT,
                  continued_employment TEXT,
                  change_previous_employment TEXT,
                  new_concurrent_employment TEXT,
                  change_employer TEXT,
                  amended_petition TEXT,
                  employer_name TEXT,
                  trade_name_dba TEXT,
                  employer_address1 TEXT,
                  employer_address2 TEXT,
                  employer_city TEXT,
                  employer_state TEXT,
                  employer_postal_code TEXT,
                  employer_country TEXT,
                  employer_province TEXT,
                  employer_phone TEXT,
                  employer_phone_ext TEXT,
                  naics_code TEXT,
                  employer_poc_last_name TEXT,
                  employer_poc_first_name TEXT,
                  employer_poc_middle_name TEXT,
                  employer_poc_job_title TEXT,
                  employer_poc_address1 TEXT,
                  employer_poc_address2 TEXT,
                  employer_poc_city TEXT,
                  employer_poc_state TEXT,
                  employer_poc_postal_code TEXT,
                  employer_poc_country TEXT,
                  employer_poc_province TEXT,
                  employer_poc_phone TEXT,
                  employer_poc_phone_ext TEXT,
                  employer_poc_email TEXT,
                  agent_representing_employer TEXT,
                  agent_attorney_last_name TEXT,
                  agent_attorney_first_name TEXT,
                  agent_attorney_middle_name TEXT,
                  agent_attorney_address1 TEXT,
                  agent_attorney_address2 TEXT,
                  agent_attorney_city TEXT,
                  agent_attorney_state TEXT,
                  agent_attorney_postal_code TEXT,
                  agent_attorney_country TEXT,
                  agent_attorney_province TEXT,
                  agent_attorney_phone TEXT,
                  agent_attorney_phone_ext TEXT,
                  agent_attorney_email_address TEXT,
                  lawfirm_name_business_name TEXT,
                  state_of_highest_court TEXT,
                  name_of_highest_state_court TEXT,
                  worksite_workers TEXT,
                  secondary_entity TEXT,
                  secondary_entity_business_name TEXT,
                  worksite_address1 TEXT,
                  worksite_address2 TEXT,
                  worksite_city TEXT,
                  worksite_county TEXT,
                  worksite_state TEXT,
                  worksite_postal_code TEXT,
                  wage_rate_of_pay_from TEXT,
                  wage_rate_of_pay_to TEXT,
                  wage_unit_of_pay TEXT,
                  prevailing_wage TEXT,
                  pw_unit_of_pay TEXT,
                  pw_tracking_number TEXT,
                  pw_wage_level TEXT,
                  pw_oes_year TEXT,
                  pw_other_source TEXT,
                  pw_other_year TEXT,
                  pw_survey_publisher TEXT,
                  pw_survey_name TEXT,
                  total_worksite_locations TEXT,
                  agree_to_lc_statement TEXT,
                  h_1b_dependent TEXT,
                  willful_violator TEXT,
                  support_h1b TEXT,
                  statutory_basis TEXT,
                  appendix_a_attached TEXT,
                  public_disclosure TEXT,
                  preparer_last_name TEXT,
                  preparer_first_name TEXT,
                  preparer_middle_initial TEXT,
                  preparer_business_name TEXT,
                  preparer_email TEXT,
                  employer_name_normalized TEXT,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)
            # 2. Migration: Ensure column exists if table was already created
            cur.execute("ALTER TABLE lca_raw ADD COLUMN IF NOT EXISTS employer_name_normalized TEXT;")

            cur.execute("CREATE INDEX IF NOT EXISTS idx_lca_raw_year ON lca_raw (fiscal_year);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_lca_raw_employer ON lca_raw (employer_name);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_lca_raw_employer_norm ON lca_raw (employer_name_normalized);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_lca_raw_case_number ON lca_raw (case_number);")
            
            # Massive Covering Index to speed up production API Ranking aggregations (prevents Heap disk thrashing on low-RAM instances)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_lca_raw_covering_year 
                ON lca_raw (fiscal_year) 
                INCLUDE (employer_name, employer_name_normalized, case_status, wage_rate_of_pay_from, wage_unit_of_pay, worksite_state, worksite_city, job_title);
            """)

            # Extension for jobs schema
            cur.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

            # CREATE COMPANIES TABLE
            cur.execute("""
                CREATE TABLE IF NOT EXISTS companies (
                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                  employer_name_normalized TEXT UNIQUE,
                  slug TEXT,
                  name TEXT,
                  h1b_sponsorship_status TEXT,
                  h1b_sponsorship_confidence NUMERIC,
                  h1b_applications_filed INT,
                  h1b_applications_approved INT,
                  last_h1b_filing_year INT,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)

            # CREATE JOBS TABLE
            cur.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                  id UUID PRIMARY KEY,
                  company_id UUID REFERENCES companies(id),
                  company_name TEXT,
                  title TEXT,
                  location TEXT,
                  city TEXT,
                  state TEXT,
                  country TEXT,
                  posted_date DATE,
                  h1b_sponsorship_available BOOLEAN,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)

            # 3. Company schema modifications 
            cur.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT;")
            cur.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS employer_name_normalized TEXT;")
            
            # Create a unique index best effort
            cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_companies_employer_norm'
                ) THEN
                    CREATE UNIQUE INDEX idx_companies_employer_norm ON companies (employer_name_normalized);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_companies_slug'
                ) THEN
                    CREATE INDEX idx_companies_slug ON companies (slug);
                END IF;
            END $$;
            """)
            

        conn.commit()
        print("Database schema migration complete.")
    except Exception as e:
        conn.rollback()
        print(f"Migration error: {e}")
        raise
    finally:
        release_connection(conn)
