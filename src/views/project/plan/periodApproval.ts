export const PERIOD_APPROVE_PERMISSION = 'project:period:approve';

export interface PeriodApprovalRecord {
  id: string;
  periodId: string;
  roundNo: number;
  approvalStatus: string;
  submitUserId: string;
  submitUserName?: string;
  submitTime?: string;
  approvalUserName?: string;
  approvalTime?: string;
  approvalReason?: string;
  withdrawUserName?: string;
  withdrawTime?: string;
  withdrawReason?: string;
  submittedSnapshot?: string;
}

export function canEditPeriodPlan(period: { status?: unknown }) {
  // 合同通过进入筹备；计划通过进入实施，原计划不再允许编辑。
  return period.status === 'PREPARING';
}

/** 历史通过记录可能已失效，绝不据此推导当前审批状态。 */
export function resolvePeriodApproval(period: Record<string, any>, history: PeriodApprovalRecord[]) {
  const currentId = String(period.currentApprovalId || '');
  const pending = history.filter((row) => String(row.approvalStatus) === '2');
  const current = currentId ? history.find((row) => row.id === currentId) : pending.length === 1 ? pending[0] : undefined;
  const waiting = period.status === 'PENDING_APPROVAL' && String(current?.approvalStatus) === '2';
  const legacy = period.status === 'PENDING_APPROVAL' && !currentId && history.length === 0;
  return {
    current,
    waiting: !!waiting,
    legacy,
    canSubmit: canEditPeriodPlan(period) && pending.length === 0,
  };
}

export function parseApprovalSnapshot(raw?: string) {
  try {
    const value = JSON.parse(raw || '');
    if (!value || !['period', 'plans', 'processes'].every((key) => Array.isArray(value[key]))) return null;
    return value as Record<'period' | 'plans' | 'processes', Record<string, unknown>[]>;
  } catch { return null; }
}
