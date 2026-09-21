/** 日期字段遵循API yyyy-MM-dd；允许清空，填入时不得早于任一工序结束日期。 */
export function expectedAcceptanceDate(value: unknown, processes: any[]): string | null {
  const date = String(value || '').trim();
  if (!date) return null;
  const parsed = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    throw new Error('请选择有效的预计再次验收日期');
  if (processes.some((row) => String(row.plannedEndTime || '').slice(0, 10) > date)) throw new Error('预计再次验收日期不能早于工序计划完成日期');
  return date;
}
