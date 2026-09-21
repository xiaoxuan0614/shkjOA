import { defHttp } from '/@/utils/http/axios';

export interface NotificationRecord {
  id: string;
  anntId: string;
  titile?: string;
  msgContent?: string;
  msgAbstract?: string;
  sender?: string;
  sendTime?: string;
  readFlag?: number | string;
  izTop?: number;
  openPage?: string;
  openType?: string;
}
export interface NotificationPage {
  records: NotificationRecord[];
  total: number;
}
const options = { isTransformResponse: false, errorMessageMode: 'none', successMessageMode: 'none' } as const;
async function unwrap<T>(request: Promise<any>): Promise<T> {
  const response = await request;
  if (response?.success !== true) throw new Error(response?.message || '通知请求失败');
  return response.result;
}
export function notificationPage(params: { pageNo: number; pageSize: number; readFlag?: number; titile?: string }) {
  return unwrap<NotificationPage>(defHttp.get({ url: '/sys/sysAnnouncementSend/getMyAnnouncementSend', params }, options));
}
export function notificationDetail(sendId: string) {
  return unwrap<NotificationRecord | null>(defHttp.get({ url: '/sys/sysAnnouncementSend/getOne', params: { sendId } }, options));
}
export function markNotificationRead(anntId: string) {
  return unwrap<void>(defHttp.put({ url: '/sys/sysAnnouncementSend/editByAnntIdAndUserId', data: { anntId } }, options));
}
export function markAllNotificationsRead() {
  return unwrap<void>(defHttp.put({ url: '/sys/sysAnnouncementSend/readAll' }, options));
}
