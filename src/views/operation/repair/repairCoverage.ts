/** Display the server's report-time coverage; never infer it from current contracts or prices. */
export function repairCoverageName(row?: { coverageType?: unknown; coverageTypeName?: unknown } | null): string {
  const name = typeof row?.coverageTypeName === 'string' ? row.coverageTypeName.trim() : '';
  if (name) return name;
  const labels: Record<string, string> = { FULL: '全包', PARTIAL: '半包', WARRANTY: '质保', MIXED: '混合', NONE: '无有效保障', UNKNOWN: '未知' };
  return labels[String(row?.coverageType)] || '未知';
}
