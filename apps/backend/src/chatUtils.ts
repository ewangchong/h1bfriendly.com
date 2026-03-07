export function extractUpstreamErrorMessage(raw: string) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const details = parsed?.error?.details;
    const quotaMessage = Array.isArray(details)
      ? details
          .flatMap((detail: any) => Array.isArray(detail?.violations) ? detail.violations : [])
          .map((violation: any) => {
            const metric = violation?.quotaMetric;
            const quotaId = violation?.quotaId;
            const model = violation?.quotaDimensions?.model;
            if (!metric && !quotaId && !model) return null;
            return [metric, quotaId, model ? `model=${model}` : null].filter(Boolean).join(' | ');
          })
          .filter(Boolean)
      : [];

    const message = parsed?.error?.message;
    if (quotaMessage.length > 0) {
      return `${message} (${quotaMessage.join('; ')})`;
    }
    return message || raw;
  } catch {
    return raw;
  }
}

export function buildChatLogsWhereClause(success?: boolean) {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (success !== undefined) {
    params.push(success);
    whereClauses.push(`success = $${params.length}`);
  }

  return {
    whereSql: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params,
  };
}
