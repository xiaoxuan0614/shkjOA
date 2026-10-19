/** Apifox 8679942 /operation/dutyRoster：人员均为前端提交的快照。 */
export interface DutyPerson {
  userId: string | null;
  name: string | null;
  phone: string | null;
}

export interface DutyRosterDay {
  date: string;
  weekday?: string;
  dayUsers: (DutyPerson | null)[];
  nightUser: DutyPerson | null;
  nightUsers?: DutyPerson[];
  /** 兼容旧初稿，展示与导出必须按当月参与人员重新计算。 */
  restUser: DutyPerson | null;
  restUsers?: DutyPerson[];
}

export interface DutyRosterPayload {
  month: string;
  version: number;
  rotationUsers: (DutyPerson | null)[];
  days: DutyRosterDay[];
}

export interface DutyRosterResult extends DutyRosterPayload {
  id: string | null;
  saved: boolean;
  canManage: boolean;
}

export interface DutyPersonOptions {
  canManage?: boolean;
  persons: DutyPerson[];
}

export type GenerationRule = 'text' | 'rotation' | 'manual';
