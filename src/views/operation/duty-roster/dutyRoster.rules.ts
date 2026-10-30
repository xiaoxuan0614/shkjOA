import type { DutyPerson, DutyRosterDay, DutyRosterPayload } from './dutyRoster.store';

/** 生成规则只用于初稿，不约束人工调整或保存。 */
export function rotateDutyRoster(rows: DutyRosterDay[], users: DutyPerson[], previousNightUserId?: string | null): DutyRosterDay[] {
  if (users.length !== 4 || users.some((user) => !user.userId) || new Set(users.map((user) => user.userId)).size !== 4) {
    throw new Error('四人轮值需要选择4名不同的运维人员；生成后可自由调整每天人数');
  }
  const previousIndex = previousNightUserId ? users.findIndex((user) => user.userId === previousNightUserId) : -1;
  let cursor = previousIndex >= 0 ? (previousIndex + 1) % users.length : 0;
  const next = () => ({ ...users[cursor++ % users.length] });
  return rows.map((row) => {
    const weekday = new Date(`${row.date}T12:00:00Z`).getUTCDay();
    const dayUsers = [0, 6].includes(weekday) ? [next()] : users.map(user => ({ ...user }));
    const nightUser = next();
    const restUsers = getRestUsers(users, { dayUsers, nightUser });
    return { ...row, dayUsers, nightUser, nightUsers: [nightUser], restUsers, restUser: restUsers[0] || null };
  });
}

/** 昨晚夜班且今天仍排白班的人：上午休息、下午上班，不计全天休息。 */
export function getMorningRestUsers(row: Pick<DutyRosterDay, 'dayUsers'>, previousRow?: Pick<DutyRosterDay, 'nightUsers' | 'nightUser'>): DutyPerson[] {
  const dayIds = new Set(row.dayUsers.map(person => person?.userId).filter(Boolean));
  return getNightUsers(previousRow).filter(person => !!person?.userId && dayIds.has(person.userId)).map(person => ({ ...person }));
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
