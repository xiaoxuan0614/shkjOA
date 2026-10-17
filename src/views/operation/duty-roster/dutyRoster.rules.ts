import type { DutyPerson, DutyRosterDay, DutyRosterPayload } from './dutyRoster.store';

/** 生成规则只用于初稿，不约束人工调整或保存。 */
export function rotateDutyRoster(rows: DutyRosterDay[], users: DutyPerson[], previousNightUserId?: string | null): DutyRosterDay[] {
  if (users.length !== 3 || users.some((user) => !user.userId) || new Set(users.map((user) => user.userId)).size !== 3) {
    throw new Error('三人轮值需要选择3名不同的运维人员，也可选择自定义排班');
  }
  const previousIndex = previousNightUserId ? users.findIndex((user) => user.userId === previousNightUserId) : -1;
  const start = previousIndex >= 0 ? (previousIndex + 1) % 3 : 0;
  return rows.map((row, index) => {
    const current = (start + index) % 3;
    return {
      ...row,
      dayUsers: [{ ...users[current] }, { ...users[(current + 1) % 3] }],
      nightUser: { ...users[current] },
      nightUsers: [{ ...users[current] }],
      restUser: { ...users[(current + 2) % 3] },
    };
  });
}

export function getNightUsers(row?: Pick<DutyRosterDay, 'nightUsers' | 'nightUser'>): DutyPerson[] {
  return row?.nightUsers ?? (row?.nightUser ? [row.nightUser] : []);
}

/** 本月参与人员减去当天白班、夜班人员；去重并保留本月顺序。 */
export function getRestUsers(users: (DutyPerson | null)[], row: Pick<DutyRosterDay, 'dayUsers' | 'nightUser' | 'nightUsers'>): DutyPerson[] {
  const occupied = new Set([...row.dayUsers, ...getNightUsers(row)].map((person) => person?.userId).filter(Boolean));
  const seen = new Set<string>();
  return users
    .filter((person): person is DutyPerson => {
      if (!person?.userId || occupied.has(person.userId) || seen.has(person.userId)) return false;
      seen.add(person.userId);
      return true;
    })
    .map((person) => ({ ...person }));
}

/** 保存实际班次，并计算完整休息名单；不重新排班。 */
export function createDutyRosterPayload(
  month: string,
  version: number,
  rotationUsers: (DutyPerson | null)[],
  rows: DutyRosterDay[]
): DutyRosterPayload {
  return JSON.parse(
    JSON.stringify({
      month,
      version,
      rotationUsers,
      days: rows.map((row) => {
        const { date, dayUsers } = row;
        const nightUsers = getNightUsers(row);
        const nightUser = nightUsers[0] || null;
        const restUsers = getRestUsers(rotationUsers, { dayUsers, nightUser, nightUsers });
        return { date, dayUsers, nightUser, nightUsers, restUser: restUsers[0] || null, restUsers };
      }),
    })
  );
}
