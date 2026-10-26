export interface ApprovalReuseRecord {
  departmentId?: string; departmentName?: string; automatic?: boolean; approvalSource?: string;
  handledBy?: string; handledAt?: string; sourceTaskId?: string; sourceNodeKey?: string; sourceApprovedAt?: string; reuseReason?: string;
}
export function isApprovalReused(record: ApprovalReuseRecord) {
  return record.automatic === true && record.approvalSource === 'FIRST_LEVEL_REUSE';
}
export function reusedDepartmentRecords(snapshot: Record<string, unknown>): ApprovalReuseRecord[] {
  const groups = snapshot.relatedDepartmentGroups;
  if (!groups || typeof groups !== 'object' || Array.isArray(groups)) return [];
  return Object.values(groups).flatMap(value => Array.isArray(value) ? value : []).filter(record => record && isApprovalReused(record));
}
