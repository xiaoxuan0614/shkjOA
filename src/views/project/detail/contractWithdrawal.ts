import { isApprovalPending, isApprovalPendingSubmit, isApprovalRejected, isApprovalWithdrawn } from '/@/utils/approvalStatus';

export function canWithdrawDetailContract(contract: any, user: any) {
  if (!contract?.id || !isApprovalPending(contract.status)) return false;
  return isDetailContractSubmitter(contract, user);
}

export function canEditDetailContract(contract: any, user: any) {
  return !!contract?.id && (isApprovalWithdrawn(contract.status) || isApprovalRejected(contract.status) || isApprovalPendingSubmit(contract.status))
    && isDetailContractSubmitter(contract, user);
}

function isDetailContractSubmitter(contract: any, user: any) {
  const creator = String(contract.createBy || '');
  const username = String(user?.username || '');
  if (creator) return !!username && creator === username;
  const id = String(user?.id ?? user?.userId ?? '');
  return !!id && String(contract.salesUserId ?? '') === id;
}
