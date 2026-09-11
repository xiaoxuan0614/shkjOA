/**
 * 通用数值审批状态约定：
 * - -1：待提交
 * - 0：驳回
 * - 1：审核通过
 * - 2：待审批
 * - 3：已撤回
 * - 其他值（包括 null / undefined / 空字符串）：待提交
 *
 * 正式后台统一字典编码：approval_status。这里保留同值映射作为页面判断和
 * 字典缓存不可用时的展示兜底，不再使用 contract_status、stock_apply_status、
 * stock_item_status 三套历史字典。
 *
 * 用于计划方案、合同、项目用料申请、项目延期、出入库申请及其明细的
 * 审批状态字段。审批动作、执行状态及其他业务状态机仍遵循各自接口协议。
 */
export const APPROVAL_STATUS_DICT_CODE = 'approval_status';
export const APPROVAL_PENDING_SUBMIT = '-1';
export const APPROVAL_REJECTED = '0';
export const APPROVAL_APPROVED = '1';
export const APPROVAL_PENDING = '2';
export const APPROVAL_WITHDRAWN = '3';

export interface ApprovalStatusMeta {
  text: '待提交' | '驳回' | '审核通过' | '待审批' | '已撤回';
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
  text: '审核通过',
  color: 'success',
  rejected: false,
  approved: true,
  pending: false,
  withdrawn: false,
  pendingSubmit: false,
};

const PENDING_META: ApprovalStatusMeta = {
  text: '待审批',
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
  if (value === APPROVAL_PENDING_SUBMIT) return PENDING_SUBMIT_META;
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
