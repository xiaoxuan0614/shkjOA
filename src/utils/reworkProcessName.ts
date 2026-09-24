/** Display-only: never write the prefix back to processName. */
export function reworkProcessName(name: unknown, round: unknown): string {
  const text = String(name ?? '').trim() || '—';
  const value = typeof round === 'number' || typeof round === 'string' ? Number(round) : NaN;
  if (!Number.isInteger(value) || value < 1) return text;
  const prefix = `第${value}轮返工`;
  if (text === prefix || text.startsWith(`${prefix}-`)) return text;
  return `${prefix}-${text}`;
}
