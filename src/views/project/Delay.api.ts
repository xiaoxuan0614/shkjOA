import { defHttp } from '/@/utils/http/axios';

export interface DelayApprovalRecord {
  id: string;
  periodId?: string;
  applyNo?: string;
  applyUserName?: string;
  applyTime?: string;
  originalEndTime?: string;
  expectedEndTime?: string;
  delayDays?: number;
  delayReason?: string;
  remark?: string;
  status?: string | number;
  approvalUserName?: string;
  approvalTime?: string;
  approvalReason?: string;
}

const quiet = { successMessageMode: 'none', errorMessageMode: 'none' } as const;
export const delayDetail = (id: string) => defHttp.get<DelayApprovalRecord>({ url: '/project/delay/queryById', params: { id } }, quiet);
export const approveDelay = (id: string) => defHttp.post({ url: '/project/delay/approve', params: { id } }, quiet);
export const rejectDelay = (id: string, approvalReason: string) =>
  defHttp.post({ url: '/project/delay/reject', params: { id, approvalReason } }, quiet);
