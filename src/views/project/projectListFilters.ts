/** 列表展示名称；保留原字段，不影响详情和编辑。 */
export function projectDisplayName(record: { projectName?: unknown; periodName?: unknown }): string {
  return [record.projectName, record.periodName].map((value) => String(value ?? '').trim()).filter(Boolean).join('-') || '—';
}

/** 多选字段内 OR、字段间 AND，交由后端在分页前过滤。 */
export function normalizeProjectListParams(params: Record<string, any> = {}) {
  const result = { ...params };
  for (const field of ['status', 'arrivalStatus', 'contractStatus', 'projectType']) {
    const raw = result[field];
    const values = (Array.isArray(raw) ? raw : [raw]).flatMap((value) => String(value ?? '').split(','));
    const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))].join(',');
    if (normalized) result[field] = normalized;
    else delete result[field];
  }
  for (const field of ['keyword', 'projectName', 'projectManagerName']) {
    const value = String(result[field] ?? '').trim();
    if (value) result[field] = value;
    else delete result[field];
  }
  return result;
}
