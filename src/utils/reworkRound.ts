/** Count physical rework ancestors, never submissions or optimistic-lock versions. */
export async function resolveReworkName(previousReworkId: string, periodId: string, readDetail: (id: string) => Promise<any>): Promise<string> {
  let round = 1;
  let id = String(previousReworkId || '');
  const seen = new Set<string>();
  while (id) {
    if (seen.has(id) || seen.size >= 1000) throw new Error('返工轮次链异常，请联系管理员核实');
    seen.add(id);
    const row = await readDetail(id);
    if (!row || String(row.id) !== id || String(row.periodId) !== periodId || String(row.approvalStatus) !== '1') {
      throw new Error('无法确认上一轮返工，请刷新后重试');
    }
    round++;
    id = String(row.previousReworkId || '');
  }
  return `第${round}轮返工`;
}

export function reworkHistory(value: unknown): Record<string, unknown>[] {
  try {
    const rows = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) : [];
  } catch {
    return [];
  }
}
