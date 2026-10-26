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
export const createDelay = (params: { periodId: string; processId: string; expectedEndTime: string; delayReason: string }) =>
  defHttp.post({ url: '/project/delay/add', params }, quiet);
export async function readDelayProcesses(periodId: string) {
  const rows: any[] = [];
  for (let pageNo = 1; pageNo <= 100; pageNo++) {
    const page: any = await defHttp.get({ url: '/project/process/list', params: { periodId, pageNo, pageSize: 100 } }, quiet);
    const records = Array.isArray(page) ? page : page?.records;
    if (!Array.isArray(records)) throw new Error('工序列表格式异常');
    rows.push(...records);
    if (Array.isArray(page) || !records.length || (page.total != null ? pageNo * 100 >= Number(page.total) : records.length < 100)) return rows;
  }
  throw new Error('工序数量过多，请联系管理员');
}
export const delayDetail = (id: string) => defHttp.get<DelayApprovalRecord>({ url: '/project/delay/queryById', params: { id } }, quiet);
export const approveDelay = (id: string) => defHttp.post({ url: '/project/delay/approve', params: { id } }, quiet);
export const rejectDelay = (id: string, approvalReason: string) =>
  defHttp.post({ url: '/project/delay/reject', params: { id, approvalReason } }, quiet);
