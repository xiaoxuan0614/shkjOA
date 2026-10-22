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

/** 新接口不返回 rotationUsers；由所有班次快照恢复编辑器参与人员。 */
function normalizeRoster(result: DutyRosterResult): DutyRosterResult {
  const days = (result.days ?? []).map((row) => ({
    ...row,
    dayUsers: (row.dayUsers ?? []).filter((person): person is DutyPerson => !!person),
    nightUsers: getNightUsers(row).filter((person): person is DutyPerson => !!person),
    restUsers: (row.restUsers ?? (row.restUser ? [row.restUser] : [])).filter((person): person is DutyPerson => !!person),
    nightUser: row.nightUser ?? null,
    restUser: row.restUser ?? null,
  }));
  const participants = new Map<string, DutyPerson>();
  for (const person of [...(result.rotationUsers ?? []), ...days.flatMap((row) => [...row.dayUsers, ...row.nightUsers, ...row.restUsers])]) {
    if (person?.userId && !participants.has(person.userId)) participants.set(person.userId, { ...person });
  }
  return { ...result, days, rotationUsers: [...participants.values()], version: 0 };
}

export async function loadDutyRosterUsers(): Promise<DutyPersonOptions> {
  interface Department {
    id?: string;
    departName?: string;
    title?: string;
    children?: Department[];
  }
  const response: Response<Department[] | null> = await defHttp.get({ url: '/sys/sysDepart/queryTreeList' }, options);
  const departments = unwrap({ ...response, result: response.result ?? [] });
  const matches = new Set<string>();
  const visit = (nodes: Department[]) => {
    for (const node of nodes) {
      if ((node.departName || node.title)?.trim() === '运维部' && node.id) matches.add(node.id);
      if (node.children) visit(node.children);
    }
  };
  visit(departments);
  if (matches.size !== 1) throw new Error(matches.size ? '存在多个运维部，请联系管理员确认部门配置' : '未找到运维部，请联系管理员配置部门');
  const departId = [...matches][0];
  const persons = new Map<string, DutyPerson>();
  for (let pageNo = 1; ; pageNo++) {
    const response: Response<{
      records: { id: string; realname?: string; username?: string; phone?: string }[];
      total: number;
      size: number;
      pages: number;
    } | null> = await defHttp.get({ url: '/sys/user/list', params: { departId, pageNo, pageSize: 100 } }, options);
    const page = unwrap({ ...response, result: response.result ?? { records: [], total: 0, size: 100, pages: 0 } });
    for (const user of page.records) {
      if (user.id) persons.set(user.id, { userId: user.id, name: user.realname || user.username || user.id, phone: user.phone || '' });
    }
    if (pageNo >= page.pages || pageNo * page.size >= page.total) break;
    if (!page.records.length) throw new Error('运维部人员分页返回不完整，请重新加载');
  }
  return { persons: [...persons.values()] };
}

export async function queryDutyRoster(month: string): Promise<DutyRosterResult> {
  const result = unwrap<DutyRosterResult>(await defHttp.get({ url: `${base}/queryByMonth`, params: { month } }, options));
  return normalizeRoster(result);
}

export async function saveDutyRoster(payload: DutyRosterPayload): Promise<DutyRosterResult> {
  const ref = (person: DutyPerson | null) => (person ? { userId: person.userId } : null);
  const days = payload.days.map((row) => {
    const night = getNightUsers(row);
    const rest = getRestUsers(payload.rotationUsers, row);
    return { date: row.date, dayUsers: row.dayUsers.map(ref), nightUsers: night.map(ref), restUsers: rest.map(ref) };
  });
  const data = { month: payload.month, rotationUsers: payload.rotationUsers.map(ref), days };
  const result = unwrap<DutyRosterResult>(await defHttp.post({ url: `${base}/save`, data }, options));
  return normalizeRoster(result);
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

export interface DutyRosterListItem {
  id: string;
  month: string;
  updateTime: string;
  createByName: string;
  createBy: string;
  updateByName: string;
  updateBy: string;
}
export interface DutyRosterPage {
  records: DutyRosterListItem[];
  total: number;
  current: number;
  size: number;
  pages: number;
}

export async function listDutyRosters(month?: string, pageNo = 1, pageSize = 10): Promise<DutyRosterPage> {
  return unwrap(await defHttp.get({ url: `${base}/list`, params: { ...(month ? { month } : {}), pageNo, pageSize } }, options));
}
