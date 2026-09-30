import { defHttp } from '/@/utils/http/axios';
const base = '/project/serviceFee';
const quiet = { errorMessageMode: 'none', successMessageMode: 'none' } as const;
export const serviceFeeList = (params: { name?: string; pageNo: number; pageSize: number }) =>
  defHttp.get({ url: `${base}/list`, params: { pageNo: params.pageNo, pageSize: params.pageSize, ...(params.name?.trim() ? { name: params.name.trim() } : {}) } }, quiet);
export const serviceFeeDetail = (id: string) => defHttp.get({ url: `${base}/queryById`, params: { id } }, quiet);
export const saveServiceFee = (params: Recordable) => defHttp.post({ url: `${base}/${params.id ? 'edit' : 'add'}`, params }, quiet);
export const deleteServiceFee = (id: string) => defHttp.delete({ url: `${base}/delete`, params: { id } }, quiet);
