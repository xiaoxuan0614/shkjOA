/** 两端验收共用规则：只看来源类型，不以另一类型的通过结果拦截申请。 */
export function isCurrentFailedAcceptance(record: any, current: any[]) {
  return (
    !!record?.id && current.some((row) => String(row.id) === String(record.id)) && record.acceptStatus === 'COMPLETED' && record.result === 'FAILED'
  );
}

export function hasActiveRecheck(current: any[]) {
  return current.some((row) => row.sourceAcceptanceId && row.acceptStatus === 'IN_PROGRESS');
}

/** previousReworkId 指向来源施工轮；已完成的上轮返工本身不阻止本轮申请。 */
export function hasBlockingRework(rows: any[], round: string, excludeId = '') {
  return rows.some(
    (row) => String(row.id) !== excludeId && String(row.previousReworkId || '') === round && ['-1', '2', '1'].includes(String(row.approvalStatus))
  );
}

export function acceptanceAttachmentCount(record: any) {
  return ['completionReportFileId', 'acceptanceFormFileId'].reduce(
    (count, key) =>
      count +
      String(record?.[key] || '')
        .split(',')
        .filter((path) => path.trim()).length,
    0
  );
}

/** 当前待填写记录不是历史；兼容没有状态但已保存结论的旧记录。 */
export function isAcceptanceHistory(record: any) {
  const status = String(record?.acceptStatus || '').toUpperCase();
  if (status) return ['COMPLETED', 'CANCELLED'].includes(status);
  return ['PASSED', 'FAILED', '通过', '不通过', '未通过', '整改'].includes(String(record?.result || '').trim());
}
