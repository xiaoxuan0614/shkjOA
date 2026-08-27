/**
 * 合同审批状态约定：
 * - 0：驳回
 * - 1：通过
 * - 2：待审核
 * - 3：已撤回
 * - 其他值（包括 null / undefined / 空字符串）：待提交
 *
 * 仅用于合同及明确采用相同数值约定的审批字段。接口使用英文状态码或其他
 * 业务状态机时，仍应遵循对应接口协议。
 */
export const APPROVAL_REJECTED = '0';
export const APPROVAL_APPROVED = '1';
export const APPROVAL_PENDING = '2';
export const APPROVAL_WITHDRAWN = '3';

export interface ApprovalStatusMeta {
  text: '驳回' | '通过' | '待审核' | '已撤回' | '待提交';
  color: 'error' | 'success' | 'gold' | 'default';
  rejected: boolean;
  approved: boolean;
  pending: boolean;
  withdrawn: boolean;
  pendingSubmit: boolean;
}

const REJECTED_META: ApprovalStatusMeta = {
  text: '驳回',
  color: 'error',
  rejected: true,
  approved: false,
  pending: false,
  withdrawn: false,
  pendingSubmit: false,
};

const APPROVED_META: ApprovalStatusMeta = {
  text: '通过',
  color: 'success',
  rejected: false,
  approved: true,
  pending: false,
  withdrawn: false,
  pendingSubmit: false,
};

const PENDING_META: ApprovalStatusMeta = {
  text: '待审核',
  color: 'gold',
  rejected: false,
  approved: false,
  pending: true,
  withdrawn: false,
  pendingSubmit: false,
};

const WITHDRAWN_META: ApprovalStatusMeta = {
  text: '已撤回',
  color: 'default',
  rejected: false,
  approved: false,
  pending: false,
  withdrawn: true,
  pendingSubmit: false,
};

const PENDING_SUBMIT_META: ApprovalStatusMeta = {
  text: '待提交',
  color: 'default',
  rejected: false,
  approved: false,
  pending: false,
  withdrawn: false,
  pendingSubmit: true,
};

export function getApprovalStatusMeta(status: unknown): ApprovalStatusMeta {
  const value = String(status ?? '');
  if (value === APPROVAL_REJECTED) return REJECTED_META;
  if (value === APPROVAL_APPROVED) return APPROVED_META;
  if (value === APPROVAL_PENDING) return PENDING_META;
  if (value === APPROVAL_WITHDRAWN) return WITHDRAWN_META;
  return PENDING_SUBMIT_META;
}

export const isApprovalRejected = (status: unknown) => getApprovalStatusMeta(status).rejected;
export const isApprovalApproved = (status: unknown) => getApprovalStatusMeta(status).approved;
export const isApprovalPending = (status: unknown) => getApprovalStatusMeta(status).pending;
export const isApprovalWithdrawn = (status: unknown) => getApprovalStatusMeta(status).withdrawn;
export const isApprovalPendingSubmit = (status: unknown) => getApprovalStatusMeta(status).pendingSubmit;
