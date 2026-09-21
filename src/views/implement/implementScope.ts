/** 实施及后续正常阶段；关闭可能发生在实施前，不能仅凭 CLOSED 判断。 */
export const IMPLEMENT_PROJECT_STATUSES = [
  'IMPLEMENTING',
  'DEBUGGING',
  'DEBUG_COMPLETED',
  'IMPLEMENT_COMPLETED',
  'PENDING_ACCEPT',
  'INTERNAL_ACCEPTING',
  'ACCEPTING',
  'REWORKING',
  'WARRANTY',
  'COMPLETED',
] as const;

export function isImplementProjectStatus(value: unknown): boolean {
  return (IMPLEMENT_PROJECT_STATUSES as readonly string[]).includes(String(value ?? '').trim());
}

/** 清空、重置或过期筛选值都不能扩大为全部项目。 */
export function getImplementProjectStatusFilter(value?: unknown): string {
  const selected = [
    ...new Set(
      String(value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(isImplementProjectStatus)
    ),
  ];
  return (selected.length ? selected : IMPLEMENT_PROJECT_STATUSES).join(',');
}
