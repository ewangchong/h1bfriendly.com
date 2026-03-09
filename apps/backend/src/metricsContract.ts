export const METRIC_CONTRACT_DOC_PATH = 'docs/metric-contract.md';

export const METRIC_DEFINITIONS = {
  filings: 'Count every LCA row in scope for the selected filter set/year.',
  approvals: "Count rows whose case_status matches 'CERTIFIED%'.",
  avg_salary: 'Average annualized wage using wage_unit_of_pay conversion, excluding values outside sanity bounds (10,000 to 5,000,000).',
  year_scope: 'All comparisons must use the exact same fiscal_year and user filters.',
} as const;

export type WageUnit = 'Year' | 'Month' | 'Bi-Weekly' | 'Week' | 'Hour' | string | null | undefined;

export type LcaLikeRow = {
  employer_name_normalized?: string | null;
  case_status?: string | null;
  wage_rate_of_pay_from?: string | number | null;
  wage_unit_of_pay?: WageUnit;
  fiscal_year?: number | null;
};

export function isCertifiedStatus(status?: string | null) {
  return (status || '').toUpperCase().startsWith('CERTIFIED');
}

export function annualizeWage(value: string | number | null | undefined, unit: WageUnit) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;

  const normalizedUnit = (unit || '').toString().toLowerCase();
  const multiplier = normalizedUnit === 'year'
    ? 1
    : normalizedUnit === 'month'
      ? 12
      : normalizedUnit === 'bi-weekly'
        ? 26
        : normalizedUnit === 'week'
          ? 52
          : normalizedUnit === 'hour'
            ? 2080
            : 1;

  return numeric * multiplier;
}

export function sanitizeAnnualizedWage(value: string | number | null | undefined, unit: WageUnit) {
  const annualized = annualizeWage(value, unit);
  if (annualized === null) return null;
  if (annualized < 10000 || annualized > 5000000) return null;
  return annualized;
}

export function aggregateRows(rows: LcaLikeRow[]) {
  const filings = rows.length;
  const approvals = rows.filter((row) => isCertifiedStatus(row.case_status)).length;
  const salaries = rows
    .map((row) => sanitizeAnnualizedWage(row.wage_rate_of_pay_from, row.wage_unit_of_pay))
    .filter((value): value is number => value !== null);

  const avg_salary = salaries.length > 0
    ? Number((salaries.reduce((sum, value) => sum + value, 0) / salaries.length).toFixed(2))
    : 0;

  return { filings, approvals, avg_salary };
}

export function aggregateByEmployer(rows: LcaLikeRow[]) {
  const groups = new Map<string, LcaLikeRow[]>();

  for (const row of rows) {
    const employer = row.employer_name_normalized?.trim();
    if (!employer) continue;
    const existing = groups.get(employer) || [];
    existing.push(row);
    groups.set(employer, existing);
  }

  return Array.from(groups.entries())
    .map(([employer_name_normalized, employerRows]) => ({
      employer_name_normalized,
      ...aggregateRows(employerRows),
    }))
    .sort((a, b) => b.approvals - a.approvals || b.filings - a.filings || a.employer_name_normalized.localeCompare(b.employer_name_normalized));
}
