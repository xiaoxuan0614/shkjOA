export type DutyShift = 'day' | 'night';

export interface DutyRosterUserSnapshot {
  value: string;
  label: string;
  username?: string;
  phone?: string;
}

export interface DutyRosterRow {
  date: string;
  weekday: string;
  dayUserIds: string[];
  nightUserIds: string[];
  contactUserId?: string;
}

export interface DutyRosterDraft {
  version: 1;
  month: string;
  enabledShifts: DutyShift[];
  dayStaffCount: number;
  nightStaffCount: number;
  selectedUserIds: string[];
  userSnapshots: DutyRosterUserSnapshot[];
  rows: DutyRosterRow[];
  savedAt: string;
}

const STORAGE_PREFIX = 'shkj:duty-roster:';

export function loadDutyRosterDraft(month: string): DutyRosterDraft | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${month}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DutyRosterDraft;
    if (parsed?.version !== 1 || parsed.month !== month || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch (error) {
    console.warn('读取本地值班表失败', error);
    return null;
  }
}

export function saveDutyRosterDraft(draft: DutyRosterDraft) {
  window.localStorage.setItem(`${STORAGE_PREFIX}${draft.month}`, JSON.stringify(draft));
}
