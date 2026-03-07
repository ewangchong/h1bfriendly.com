import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatLogsWhereClause, extractUpstreamErrorMessage } from './chatUtils.js';

test('extractUpstreamErrorMessage returns raw text for non-JSON input', () => {
  assert.equal(extractUpstreamErrorMessage('plain upstream failure'), 'plain upstream failure');
});

test('extractUpstreamErrorMessage includes quota details when present', () => {
  const raw = JSON.stringify({
    error: {
      message: 'You exceeded your current quota',
      details: [
        {
          violations: [
            {
              quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
              quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
              quotaDimensions: { model: 'gemini-2.5-flash' },
            },
          ],
        },
      ],
    },
  });

  assert.equal(
    extractUpstreamErrorMessage(raw),
    'You exceeded your current quota (generativelanguage.googleapis.com/generate_content_free_tier_requests | GenerateRequestsPerDayPerProjectPerModel-FreeTier | model=gemini-2.5-flash)'
  );
});

test('buildChatLogsWhereClause omits WHERE clause without filters', () => {
  assert.deepEqual(buildChatLogsWhereClause(), {
    whereSql: '',
    params: [],
  });
});

test('buildChatLogsWhereClause adds success filter when provided', () => {
  assert.deepEqual(buildChatLogsWhereClause(false), {
    whereSql: 'WHERE success = $1',
    params: [false],
  });
});
