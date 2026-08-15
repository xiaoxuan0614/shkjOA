import { defHttp } from '/@/utils/http/axios';

/**
 * 用户选择器 - 加载全量用户选项(支持前端模糊查询)
 * 供客户(销售/维保/客户经理)、供应商(对接人)等选择负责人用
 */
let userOptionsCache: { label: string; value: string }[] | null = null;

export async function loadUserOptions(): Promise<{ label: string; value: string }[]> {
  if (userOptionsCache) return userOptionsCache;
  const res: any = await defHttp.get({ url: '/sys/user/list', params: { pageNo: 1, pageSize: 1000 } });
  const list = res?.records || res || [];
  userOptionsCache = list.map((u: any) => ({ label: u.realname || u.username || u.id, value: u.id }));
  return userOptionsCache;
}
