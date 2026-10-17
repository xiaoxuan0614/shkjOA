import { getNightUsers, getRestUsers } from './dutyRoster.rules';
import type { DutyPerson } from './dutyRoster.store';
import { defHttp } from '/@/utils/http/axios';
import type { DutyPersonOptions, DutyRosterPayload, DutyRosterResult } from './dutyRoster.store';

interface Response<T> {
  success: boolean;
  message?: string | null;
  result: T;
}

function unwrap<T>(response: Response<T>): T {
  if (response?.success !== true) throw new Error(response?.message || '值班表请求失败，请稍后重试');
  if (response.result == null) throw new Error('值班表返回内容异常，请重新加载');
  return response.result;
}

const options = { isTransformResponse: false, errorMessageMode: 'none' as const };
const base = '/operation/dutyRoster';

export async function loadDutyRosterUsers(): Promise<DutyPersonOptions> {
  return unwrap(await defHttp.get({ url: `${base}/personOptions` }, options));
}

export async function queryDutyRoster(month: string): Promise<DutyRosterResult> {
  const result = unwrap<DutyRosterResult>(await defHttp.get({ url: `${base}/queryByMonth`, params: { month } }, options));
  return { ...result, version: 0 }; // 仅兼容编辑器内部状态，正式接口不使用版本号。
}

export async function saveDutyRoster(payload: DutyRosterPayload): Promise<DutyRosterResult> {
  const ref = (person: DutyPerson | null) => (person ? { userId: person.userId } : null);
  const days = payload.days.map((row) => {
    const night = getNightUsers(row);
    const rest = getRestUsers(payload.rotationUsers, row);
    if (night.length > 1 || rest.length > 1)
      throw new Error(
        `${row.date}有${night.length}名夜班、${rest.length}名休息人员；当前后端接口仅支持单人字段，无法完整保存，请后端扩展多人字段后再保存。当前修改已保留。`
      );
    return { date: row.date, dayUsers: row.dayUsers.map(ref), nightUser: ref(night[0] || null), restUser: ref(rest[0] || null) };
  });
  const data = { month: payload.month, rotationUsers: payload.rotationUsers.map(ref), days };
  const result = unwrap<DutyRosterResult>(await defHttp.post({ url: `${base}/save`, data }, options));
  return { ...result, version: 0 };
}

export async function downloadDutyRoster(month: string): Promise<Blob> {
  const blob: Blob = await defHttp.get({ url: `${base}/exportXls`, params: { month }, responseType: 'blob' }, options);
  if (!(blob instanceof Blob) || !blob.size) throw new Error('导出文件为空，请稍后重试');
  if (blob.type.includes('json') || blob.type.includes('text')) {
    let message = '导出失败，请确认本月已保存';
    try {
      message = JSON.parse(await blob.text()).message || message;
    } catch {
      /* 非JSON错误返回使用通用提示。 */
    }
    throw new Error(message);
  }
  return blob;
}

/** 按选中月份查询，不批量扫描全年。 */
export async function listDutyRosters(month: string): Promise<DutyRosterResult[]> {
  const row = await queryDutyRoster(month);
  return row.saved ? [row] : [];
}
