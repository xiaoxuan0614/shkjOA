/** Only the four display fields travel with navigation; never serialize the full project row into a URL. */
const displayKeys = ['projectName', 'periodName', 'customerName', 'projectLiaisonUserName'] as const;
export function contractProjectContext(record: Record<string, unknown>, ownerId: string) {
  const periodId = String(record.periodId || record.id || '');
  if (!periodId || !ownerId) return null;
  const fields: Record<string, string> = {};
  for (const key of displayKeys) if (typeof record[key] === 'string') fields[key] = record[key] as string;
  return { periodId, ownerId, fields };
}
export function readContractProjectContext(value: unknown, periodId: string, ownerId: string): Record<string, string> {
  if (!value || typeof value !== 'object' || !ownerId) return {};
  const data = value as Record<string, unknown>;
  if (data.periodId !== periodId || data.ownerId !== ownerId || !data.fields || typeof data.fields !== 'object') return {};
  const fields: Record<string, string> = {};
  for (const key of displayKeys) {
    const field = (data.fields as Record<string, unknown>)[key];
    if (typeof field === 'string') fields[key] = field;
  }
  return fields;
}
