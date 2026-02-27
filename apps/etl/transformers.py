import sys
import pandas as pd
from io import StringIO
import re
from db import get_connection, release_connection

# Expected DB columns exactly matching the schema of `lca_raw`
# Total: 96 columns (excluding id, created_at)
LCA_COLUMNS = [
    "fiscal_year", "case_number", "case_status", "received_date", "decision_date", 
    "original_cert_date", "visa_class", "job_title", "soc_code", "soc_title", 
    "full_time_position", "begin_date", "end_date", "total_worker_positions", 
    "new_employment", "continued_employment", "change_previous_employment", 
    "new_concurrent_employment", "change_employer", "amended_petition", "employer_name", 
    "trade_name_dba", "employer_address1", "employer_address2", "employer_city", 
    "employer_state", "employer_postal_code", "employer_country", "employer_province", 
    "employer_phone", "employer_phone_ext", "naics_code", "employer_poc_last_name", 
    "employer_poc_first_name", "employer_poc_middle_name", "employer_poc_job_title", 
    "employer_poc_address1", "employer_poc_address2", "employer_poc_city", 
    "employer_poc_state", "employer_poc_postal_code", "employer_poc_country", 
    "employer_poc_province", "employer_poc_phone", "employer_poc_phone_ext", 
    "employer_poc_email", "agent_representing_employer", "agent_attorney_last_name", 
    "agent_attorney_first_name", "agent_attorney_middle_name", "agent_attorney_address1", 
    "agent_attorney_address2", "agent_attorney_city", "agent_attorney_state", 
    "agent_attorney_postal_code", "agent_attorney_country", "agent_attorney_province", 
    "agent_attorney_phone", "agent_attorney_phone_ext", "agent_attorney_email_address", 
    "lawfirm_name_business_name", "state_of_highest_court", "name_of_highest_state_court", 
    "worksite_workers", "secondary_entity", "secondary_entity_business_name", 
    "worksite_address1", "worksite_address2", "worksite_city", "worksite_county", 
    "worksite_state", "worksite_postal_code", "wage_rate_of_pay_from", "wage_rate_of_pay_to", 
    "wage_unit_of_pay", "prevailing_wage", "pw_unit_of_pay", "pw_tracking_number", 
    "pw_wage_level", "pw_oes_year", "pw_other_source", "pw_other_year", "pw_survey_publisher", 
    "pw_survey_name", "total_worksite_locations", "agree_to_lc_statement", "h_1b_dependent", 
    "willful_violator", "support_h1b", "statutory_basis", "appendix_a_attached", 
    "public_disclosure", "preparer_last_name", "preparer_first_name", "preparer_middle_initial", 
    "preparer_business_name", "preparer_email", "employer_name_normalized"
]

def clean_salary(val, unit=None):
    """
    Strips non-numeric characters (like $ and ,) and ensures the value is > 0.
    Normalizes the returned float to an ANNUAL salary based on the 'unit'.
    """
    if pd.isna(val):
        return None
    s = str(val).strip()
    if not s:
        return None
    s = re.sub(r'[^\d\.]', '', s)
    try:
        num = float(s)
        if num <= 0:
            return None
            
        # Normalize to Annual Salary based on the Unit
        unit_str = str(unit).upper().strip() if not pd.isna(unit) else "YEAR"
        
        # Heuristics: Sometimes companies enter their ANNUAL salary e.g. 90000 
        # but accidentally select 'Week' as the unit in the DOL form.
        # This causes the DB to record $4.6M/year. 
        # So we cap maximum realistically scaled salaries to prevent this.
        
        if unit_str == "HOUR":
            # Roughly 2080 hours a year
            if num > 500: # Nobody makes $500/hr on typical H1Bs (that'd be > $1M/yr)
                pass # Already looks like an annual or monthly figure inputted wrongly, don't scale
            else:
                num = num * 2080
        elif unit_str == "WEEK":
            if num > 20000: # Already looks annual, skip multiplying
                pass 
            else:
                num = num * 52
        elif unit_str == "BI-WEEKLY":
            if num > 30000:
                pass
            else:
                num = num * 26
        elif unit_str == "MONTH":
            if num > 50000:
                pass
            else:
                num = num * 12
                
        return round(num, 2)
    except ValueError:
        return None

def normalize_job_title(title):
    if pd.isna(title):
        return ""
    t = str(title).strip().upper()
    t = re.sub(r'\s+', ' ', t) # collapse spaces
    
    if "SOFTWARE ENGINEER" in t or "SOFTWARE DEVELOPER" in t or "SDE " in t or "PROGRAMMER ANALYST" in t:
        return "SOFTWARE ENGINEER"
    elif "DATA SCIENTIST" in t:
        return "DATA SCIENTIST"
    elif "DATA ENGINEER" in t:
        return "DATA ENGINEER"
    elif "PRODUCT MANAGER" in t:
        return "PRODUCT MANAGER"
    elif "BUSINESS ANALYST" in t:
        return "BUSINESS ANALYST"
    elif "DATA ANALYST" in t:
        return "DATA ANALYST"
    elif "MACHINE LEARNING" in t or " MLE " in t:
        return "MACHINE LEARNING ENGINEER"
    elif "MECHANICAL ENGINEER" in t:
        return "MECHANICAL ENGINEER"
    elif "ELECTRICAL ENGINEER" in t:
        return "ELECTRICAL ENGINEER"
    elif "HARDWARE ENGINEER" in t:
        return "HARDWARE ENGINEER"
    else:
        # Strip all non-alphanumeric chars
        return re.sub(r'[^A-Z0-9]+', ' ', t).strip()

def drop_indexes(cur) -> None:
    print("Dropping indexes temporarily for bulk copy...")
    cur.execute("DROP INDEX IF EXISTS idx_lca_raw_year;")
    cur.execute("DROP INDEX IF EXISTS idx_lca_raw_employer;")
    cur.execute("DROP INDEX IF EXISTS idx_lca_raw_case_number;")

def recreate_indexes(cur) -> None:
    print("Recreating indexes...")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_lca_raw_year ON lca_raw (fiscal_year);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_lca_raw_employer ON lca_raw (employer_name);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_lca_raw_case_number ON lca_raw (case_number);")

def load_excel_to_postgres(file_path: str, fiscal_year: int, cur=None) -> None:
    """Read DOL LCA xlsx file, align headers, drop PI, and stream dynamically to Postgres."""
    print(f"Reading {file_path} for fiscal year {fiscal_year}...")
    
    # Read the first row to determine actual columns
    df_head = pd.read_excel(file_path, nrows=0)
    source_cols = list(df_head.columns)
    
    # Columns typically containing PI that should not be saved or might break 
    cols_to_drop = [c for c in source_cols if c.upper() in ["EMPLOYER_FEIN"]]
    
    use_cols = [c for c in source_cols if c not in cols_to_drop]

    print(f"Identified {len(use_cols)} columns to import.")

    # We read chunk by chunk
    conn = None
    own_cur = False
    
    if cur is None:
        conn = get_connection()
        cur = conn.cursor()
        own_cur = True
        
    try:
        
        # We need to map the incoming DataFrame columns exactly to our LCA_COLUMNS order.
        # Ensure we have fiscal_year mapped manually.
        with pd.ExcelFile(file_path) as xls:
            df = pd.read_excel(xls, usecols=use_cols, dtype=str)

            print(f"Loaded {len(df)} rows into memory. Processing...")
            
            # Map Excel columns dynamically to db columns by explicit NAME matching.
            # This completely shields against upstream column insertions/deletions/shifts.
            final_df = pd.DataFrame()
            final_df['fiscal_year'] = [fiscal_year] * len(df)
            
            # Create a lookup of available upper-case columns for fast matching
            available_cols_upper = {c: c for c in df.columns}
            
            for expected_col in LCA_COLUMNS[1:]:
                # Handle specific DOL naming quirks
                target_search_name = expected_col.upper()
                if target_search_name == "H_1B_DEPENDENT":
                    target_search_name = "H-1B_DEPENDENT"
                    
                if target_search_name in available_cols_upper:
                    actual_col_name = available_cols_upper[target_search_name]
                    final_df[expected_col] = df[actual_col_name]
                else:
                    # If DOL randomly dropped this column this quarter, safely null/empty it
                    final_df[expected_col] = ""
                    
            # Basic validation: ensure salaries are valid numbers > 0 and normalize to annual.
            # If rate_of_pay_from or prevailing_wage is invalid, we drop the row entirely.
            # Converting to a list comprehension is order-of-magnitude faster than DataFrame.apply(axis=1)
            if 'wage_rate_of_pay_from' in final_df.columns:
                unit_arr = final_df['wage_unit_of_pay'].values if 'wage_unit_of_pay' in final_df.columns else [None]*len(final_df)
                val_arr = final_df['wage_rate_of_pay_from'].values
                final_df['wage_rate_of_pay_from'] = [clean_salary(v, u) for v, u in zip(val_arr, unit_arr)]
                    
            if 'wage_rate_of_pay_to' in final_df.columns:
                unit_arr = final_df['wage_unit_of_pay'].values if 'wage_unit_of_pay' in final_df.columns else [None]*len(final_df)
                val_arr = final_df['wage_rate_of_pay_to'].values
                final_df['wage_rate_of_pay_to'] = [clean_salary(v, u) for v, u in zip(val_arr, unit_arr)]

            if 'prevailing_wage' in final_df.columns:
                pw_unit_arr = final_df['pw_unit_of_pay'].values if 'pw_unit_of_pay' in final_df.columns else [None]*len(final_df)
                val_arr = final_df['prevailing_wage'].values
                final_df['prevailing_wage'] = [clean_salary(v, u) for v, u in zip(val_arr, pw_unit_arr)]
            
            # Since everything is now normalized to ANNUAL, we can also force the units to 'Year' 
            # so postgres downstream calculations don't try to multiply them again.
            if 'wage_unit_of_pay' in final_df.columns:
                final_df['wage_unit_of_pay'] = "Year"
            if 'pw_unit_of_pay' in final_df.columns:
                final_df['pw_unit_of_pay'] = "Year"
            
            # Drop rows where the base salary or prevailing wage could not be parsed
            initial_len = len(final_df)
            final_df = final_df.dropna(subset=['wage_rate_of_pay_from', 'prevailing_wage'])
            
            dropped_count = initial_len - len(final_df)
            if dropped_count > 0:
                print(f"Dropped {dropped_count} rows due to invalid or missing salary data.")
                
            # Clean completely NaN strings for all other columns
            final_df = final_df.fillna("")

            # Execute explicit string normalizations so the backend doesn't have to compute them
            if 'job_title' in final_df.columns:
                # Retains original data but strictly normalizes characters and common titles
                title_arr = final_df['job_title'].values
                final_df['job_title'] = [normalize_job_title(t) for t in title_arr]
                
            if 'employer_name' in final_df.columns:
                # Remove extra spaces like backend `UPPER(TRIM(employer_name))`
                final_df['employer_name'] = final_df['employer_name'].astype(str).str.strip().str.upper()
                # Create a normalized version for grouping and slugs
                final_df['employer_name_normalized'] = final_df['employer_name'].str.replace(r'[^A-Z0-9]+', ' ', regex=True).str.strip()
            else:
                final_df['employer_name_normalized'] = ""

            # Generate CSV in memory for fast copy_expert streaming
            csv_buffer = StringIO()
            final_df.to_csv(csv_buffer, index=False, header=False, sep='\t')
            csv_buffer.seek(0)
            
            print("Writing to PostgreSQL using high-speed COPY...")
            cur.copy_expert(f"""
                COPY lca_raw ({",".join(LCA_COLUMNS)}) FROM STDIN WITH (FORMAT csv, DELIMITER '\t')
            """, csv_buffer)

        if own_cur and conn:
            conn.commit()
        print(f"Successfully processed {file_path}.")
    except Exception as e:
        if own_cur and conn:
            conn.rollback()
        print(f"Error during Postgres insertion: {e}")
        raise
    finally:
        if own_cur:
            if cur:
                cur.close()
            if conn:
                release_connection(conn)
