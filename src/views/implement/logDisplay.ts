import dayjs from 'dayjs';

/** 列表和详情使用同一工时展示规则，保留有效的 0。 */
export function formatLogHours(log: Recordable) {
  const hours = log.hours ?? log.workHours;
  if (hours !== undefined && hours !== null && hours !== '') return `${hours}h`;
  if (!log.signInTime || !log.signOutTime) return '—';
  const start = dayjs(log.signInTime);
  const end = dayjs(log.signOutTime);
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return '—';
  return `${Number((end.diff(start, 'second') / 3600).toFixed(2))}h`;
}
