import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METRIC_CONTRACT_DOC_PATH,
  METRIC_DEFINITIONS,
  aggregateByEmployer,
  aggregateRows,
  annualizeWage,
  sanitizeAnnualizedWage,
} from './metricsContract.js';

const fixtureRows = [
  {
    employer_name_normalized: 'ACME INC',
    case_status: 'CERTIFIED',
    wage_rate_of_pay_from: '120000',
    wage_unit_of_pay: 'Year',
    fiscal_year: 2025,
  },
  {
    employer_name_normalized: 'ACME INC',
    case_status: 'CERTIFIED-WITHDRAWN',
    wage_rate_of_pay_from: '60',
    wage_unit_of_pay: 'Hour',
    fiscal_year: 2025,
  },
  {
    employer_name_normalized: 'BETA LLC',
    case_status: 'DENIED',
    wage_rate_of_pay_from: '10000',
    wage_unit_of_pay: 'Month',
    fiscal_year: 2025,
  },
  {
    employer_name_normalized: 'BETA LLC',
    case_status: 'CERTIFIED',
    wage_rate_of_pay_from: '1',
    wage_unit_of_pay: 'Hour',
    fiscal_year: 2025,
  },
  {
    employer_name_normalized: 'BETA LLC',
    case_status: 'CERTIFIED',
    wage_rate_of_pay_from: '9999999',
    wage_unit_of_pay: 'Year',
    fiscal_year: 2025,
  },
];

test('salary annualization follows documented conversion rules', () => {
  assert.equal(annualizeWage('10000', 'Month'), 120000);
  assert.equal(annualizeWage('60', 'Hour'), 124800);
  assert.equal(annualizeWage('2000', 'Bi-Weekly'), 52000);
});

test('salary sanity bounds exclude outliers from averages', () => {
  assert.equal(sanitizeAnnualizedWage('1', 'Hour'), null);
  assert.equal(sanitizeAnnualizedWage('9999999', 'Year'), null);
  assert.equal(sanitizeAnnualizedWage('10000', 'Month'), 120000);
});

test('rankings/company/chat aggregations stay consistent for the same filtered rows', () => {
  const companyAgg = aggregateByEmployer(fixtureRows);
  const summaryAgg = aggregateRows(fixtureRows);

  assert.deepEqual(companyAgg, [
    {
      employer_name_normalized: 'BETA LLC',
      filings: 3,
      approvals: 2,
      avg_salary: 120000,
    },
    {
      employer_name_normalized: 'ACME INC',
      filings: 2,
      approvals: 2,
      avg_salary: 122400,
    },
  ]);

  assert.equal(summaryAgg.filings, companyAgg.reduce((sum, row) => sum + row.filings, 0));
  assert.equal(summaryAgg.approvals, companyAgg.reduce((sum, row) => sum + row.approvals, 0));
  assert.equal(summaryAgg.avg_salary, 121600);
});

test('metric contract doc path and definitions are present for backend/frontend references', () => {
  assert.equal(METRIC_CONTRACT_DOC_PATH, 'local-notes/engineering/metrics-contract.md');
  assert.ok(METRIC_DEFINITIONS.filings.includes('Count every LCA row'));
  assert.ok(METRIC_DEFINITIONS.approvals.includes('CERTIFIED%'));
  assert.ok(METRIC_DEFINITIONS.avg_salary.includes('10,000 to 5,000,000'));
  assert.ok(METRIC_DEFINITIONS.year_scope.includes('fiscal_year'));
});
