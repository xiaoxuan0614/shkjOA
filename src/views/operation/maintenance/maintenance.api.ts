import { defHttp } from '/@/utils/http/axios';
export type Row = Record<string, any>;
const options = { isTransformResponse: false, errorMessageMode: 'none' as const, successMessageMode: 'none' as const };
export async function request(path: string, data: Row, write = false): Promise<any> {
  const response: any = write ? await defHttp.post({ url: `/afterSales/${path}`, data }, options) : await defHttp.get({ url: `/afterSales/${path}`, params: data }, options);
  if (response?.success !== true || response.code !== 200) throw new Error(response?.message || '请求失败，请重试');
  return response.result;
}
function page(result: any) {
  if (!Array.isArray(result?.records) || !Number.isFinite(Number(result.total))) throw new Error('列表响应格式异常');
  return { ...result, total: Number(result.total) };
}
export const archives = async (pageNo = 1, keyword = '') => page(await request('archive/list', { pageNo, pageSize: 20, ...(keyword ? { keyword } : {}) }));
export async function archiveDetail(id: string) {
  const result = await request('archive/detail', { id });
  if (result?.archive?.id !== id) throw new Error('售后项目详情不匹配');
  return result;
}
export const contracts = async (archiveId: string, pageNo = 1) => page(await request('maintenanceContract/list', { archiveId, pageNo, pageSize: 10 }));
export async function contractDetail(id: string, archiveId: string) {
  const result = await request('maintenanceContract/detail', { id });
  if (result?.id !== id || result?.archiveId !== archiveId) throw new Error('合同与当前售后项目不匹配');
  return result;
}
export async function locations(archiveId: string) {
  const result = await request('location/list', { archiveId });
  if (!Array.isArray(result) || result.some(row=>row.archiveId!==archiveId)) throw new Error('位置列表与当前售后项目不匹配');
  return result;
}
export async function uploadAttachment(archiveId: string, file: File) {
  const response: any = await defHttp.uploadFile({ url: '/sys/common/upload' }, { file, name: 'file', data: { biz: 'afterSalesAttachment' } }, { isReturnResponse: true });
  if (!response?.success || ![0,200].includes(response.code) || !response.message) throw new Error(response?.message || '附件上传失败');
  const result = await request('attachment/save', { archiveId, ownerType: 'ARCHIVE', ownerId: archiveId, attachmentType: 'CONTRACT', fileName: file.name, storageKey: response.message, fileSize: file.size, mimeType: file.type }, true);
  if (!result?.id || result.archiveId !== archiveId) throw new Error('附件登记结果未确认，请刷新档案附件后核对');
  return result;
}
