import dayjs from 'dayjs';
import { useUserStore } from '/@/store/modules/user';
import type { DutyPerson, DutyRosterPayload, DutyRosterResult } from './dutyRoster.store';
import { rotateDutyRoster, getRestUsers, getNightUsers, createDutyRosterPayload } from './dutyRoster.rules';

export interface MockRoster extends DutyRosterResult {
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
const KEY = 'operation:duty-roster:mock:v1';
const people: DutyPerson[] = [
  { userId: 'mock-op-1', name: '张三', phone: '13800000001' },
  { userId: 'mock-op-2', name: '李四', phone: '13800000002' },
  { userId: 'mock-op-3', name: '王五', phone: '13800000003' },
];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function read(): MockRoster[] {
  const raw = localStorage.getItem(KEY);
  if (raw !== null) {
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) throw new Error('Mock 数据格式异常，请清理该模块的浏览器缓存后重试');
    return rows;
  }
  const rows = [0, 1, 2].map((offset) => {
    const month = dayjs().subtract(offset, 'month').startOf('month');
    const days = Array.from({ length: month.daysInMonth() }, (_, i) => ({
      date: month.date(i + 1).format('YYYY-MM-DD'),
      dayUsers: [],
      nightUser: null,
      restUser: null,
    }));
    return {
      id: `mock-${month.format('YYYY-MM')}`,
      month: month.format('YYYY-MM'),
      version: 1,
      saved: true,
      canManage: true,
      rotationUsers: copy(people),
      days: rotateDutyRoster(days, people),
      updatedAt: month.format('YYYY-MM-DD 09:00:00'),
      createdBy: '演示管理员',
      updatedBy: '演示管理员',
    };
  });
  localStorage.setItem(KEY, JSON.stringify(rows));
  return rows;
}
export async function listDutyRosters(year?: string, month?: string) {
  return copy(
    read()
      .filter((row) => (!year || row.month.slice(0, 4) === year) && (!month || row.month.slice(5) === month))
      .sort((a, b) => b.month.localeCompare(a.month))
  );
}
export async function loadDutyRosterUsers() {
  return { canManage: true, persons: copy(people) };
}
export async function queryDutyRoster(month: string): Promise<DutyRosterResult> {
  return copy(
    read().find((row) => row.month === month) || {
      id: null,
      month,
      version: 0,
      saved: false,
      canManage: true,
      rotationUsers: [],
      days: [],
    }
  );
}
export async function saveDutyRoster(payload: DutyRosterPayload): Promise<DutyRosterResult> {
  const rows = read();
  const index = rows.findIndex((row) => row.month === payload.month);
  const previous = rows[index];
  if ((previous?.version || 0) !== payload.version) throw new Error('本月排班已更新，请刷新后重新编辑');
  const user = useUserStore().getUserInfo;
  const actor = user?.realname || user?.username || '演示管理员';
  const row: MockRoster = {
    ...createDutyRosterPayload(payload.month, payload.version, payload.rotationUsers, payload.days),
    id: `mock-${payload.month}`,
    saved: true,
    canManage: true,
    version: payload.version + 1,
    createdBy: previous?.createdBy || actor,
    updatedBy: actor,
    updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  };
  if (index < 0) rows.push(row);
  else rows[index] = row;
  localStorage.setItem(KEY, JSON.stringify(rows));
  return copy(row);
}
export async function downloadDutyRoster(month: string): Promise<Blob> {
  const row = await queryDutyRoster(month);
  if (!row.saved) throw new Error('请先保存本月排班');
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('运维值班表');
  sheet.columns = [
    { header: '日期', key: 'date', width: 16 },
    { header: '白班人员', key: 'day', width: 28 },
    { header: '夜班人员', key: 'night', width: 18 },
    { header: '联系电话', key: 'phone', width: 20 },
    { header: '休息人员', key: 'rest', width: 18 },
  ];
  row.days.forEach((day) =>
    sheet.addRow({
      date: day.date,
      day: day.dayUsers
        .map((p) => p?.name)
        .filter(Boolean)
        .join('、'),
      night: getNightUsers(day)
        .map((person) => person.name)
        .join('、'),
      phone: getNightUsers(day)
        .map((person) => person.phone || '未维护电话')
        .join('、'),
      rest: getRestUsers(row.rotationUsers, day)
        .map((person) => person.name)
        .join('、'),
    })
  );
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return new Blob([(await workbook.xlsx.writeBuffer()) as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
