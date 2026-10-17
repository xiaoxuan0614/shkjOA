import dayjs from 'dayjs';
import { HolidayUtil } from 'lunar-javascript';
import type { DutyPerson, DutyRosterDay } from './dutyRoster.store';

export interface ShiftDemand {
  day: number;
  night: number;
}
export interface TextDutyRule {
  normal: ShiftDemand;
  holiday: ShiftDemand;
  usesHolidays: boolean;
  weekendHoliday: boolean;
  restAfterNight: boolean;
  restAfterFullDay: boolean;
}
export interface RuleInterpretation {
  rule?: TextDutyRule;
  errors: string[];
  summary: string[];
}
export interface RuleCheck extends RuleInterpretation {
  rows?: DutyRosterDay[];
  holidayDates?: string[];
}

const digits: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function normalize(text: string) {
  return text
    .replace(/[零一二两三四五六七八九十]+/g, (value) => {
      const parts = value.split('十');
      return String(parts.length === 2 ? (digits[parts[0]] || 1) * 10 + (digits[parts[1]] || 0) : (digits[value] ?? value));
    })
    .replace(/[^\S\n]+/g, '')
    .replace(/白天|早班/g, '白班')
    .replace(/晚班/g, '夜班')
    .replace(/白(?=\d)/g, '白班')
    .replace(/夜(?=\d)/g, '夜班');
}

/** 本地可解释语法，未识别的约束必须报出，不能忽略后声称合理。 */
export function parseDutyRule(text: string): RuleInterpretation {
  const errors: string[] = [];
  if (!text.trim()) return { errors: ['请先输入排班逻辑'], summary: [] };
  if (text.length > 500) return { errors: ['排班逻辑请控制在500字以内'], summary: [] };
  const demands: Record<'normal' | 'holiday', Partial<ShiftDemand>> = { normal: {}, holiday: {} };
  let scope: 'normal' | 'holiday' = 'normal';
  let nightMustAttendDay = false;
  let usesHolidays = false,
    weekendHoliday = false,
    weekendSpecified: boolean | undefined,
    restAfterFullDay = false,
    restAfterNight = true,
    restSpecified: boolean | undefined;
  const assign = (key: keyof ShiftDemand, count: number) => {
    if (demands[scope][key] != null && demands[scope][key] !== count)
      errors.push(`${scope === 'normal' ? '平日' : '节假日'}${key === 'day' ? '白班' : '夜班'}人数前后不一致，请只保留一种安排`);
    demands[scope][key] = count;
  };
  const input = text.replace(
    /(?:一个人|1个人|人员)?\s*如果\s*(?:当天)?\s*上了?\s*(?:24|二十四)\s*小时\s*[，,]?\s*(?:那|那么|就)?\s*(?:转天|第二天|次日)\s*休息(?:\s*(?:一天|1天))?/g,
    '上24小时后次日休息'
  );
  for (const rawPart of input.split(/[，,；;。\n]+/).filter(Boolean)) {
    const part = rawPart.trim();
    let clause = normalize(part);
    if (/^(?:工作日|平日|平时)(?:和|及|、)周末/.test(clause)) {
      if (weekendSpecified === true) errors.push('周末规则前后不一致');
      weekendSpecified = weekendHoliday = false;
      clause = clause.replace(/^(工作日|平日|平时)(?:和|及|、)周末/, '$1');
    }
    clause = clause.replace(/^(法定节假日|节假日|假期)(?:例如|比如|如)(?:国庆节?|春节|元旦|劳动节|五一|清明节?|端午节?|中秋节?)/, '$1');
    if (/^(?:上24小时|24小时值班)(?:后|结束后|的人|人员)?(?:次日|第2天|转天)?(?:必须)?休(?:息)?(?:1天)?$/.test(clause)) {
      if (restSpecified != null && !restAfterFullDay) errors.push('休息规则前后不一致，请明确按夜班还是按24小时值班休息');
      restAfterNight = false;
      restAfterFullDay = true;
      restSpecified = true;
      continue;
    }
    const weekend = clause.match(/^周末按(平时|平日|工作日|节假日)(?:规则)?(?:排班|安排)?$/);
    if (weekend) {
      const holiday = weekend[1] === '节假日';
      if (weekendSpecified != null && weekendSpecified !== holiday) errors.push('周末规则前后不一致，请选择按平日或节假日排班');
      weekendSpecified = weekendHoliday = holiday;
      continue;
    }
    if (/^(?:夜班|夜班人员|上24小时|24小时值班)(?:后|结束后|的人|人员)?(?:次日|第2天)?(?:必须)?休(?:息)?(?:1天)?$/.test(clause)) {
      if (restSpecified === false || restAfterFullDay) errors.push('夜班后休息规则前后不一致');
      restSpecified = restAfterNight = true;
      continue;
    }
    if (/^夜班(?:人员)?后(?:不强制休息|无需休息|不休息)$/.test(clause)) {
      if (restSpecified === true) errors.push('夜班后休息规则前后不一致');
      restSpecified = restAfterNight = false;
      continue;
    }
    if (/^(?:按(?:选择|人员)?顺序(?:循环)?轮值|依次轮值|轮流值班|循环排班|轮值|轮班)$/.test(clause)) continue;
    if (/^夜班人员(?:同时|也)?(?:参加|上)?(?:当天)?白班$/.test(clause)) {
      nightMustAttendDay = true;
      continue;
    }
    const category = clause.match(/^(法定节假日|节假日|假期|平时|平日|工作日|正常日|普通日)/);
    if (category) {
      scope = /假/.test(category[1]) ? 'holiday' : 'normal';
      if (scope === 'holiday') usesHolidays = true;
      clause = clause.slice(category[0].length).replace(/^(?:的|就|是|为|安排|按)/, '');
    }
    if (!clause) continue;
    if (/^(?:每天|1天)?(?:就)?1(?:个?人|名|位)(?:值|上|值班)?(?:全天|24小时)$/.test(clause)) {
      assign('day', 1);
      assign('night', 1);
      continue;
    }
    if (/^(?:全天|24小时)(?:值班)?(?:安排)?1(?:个?人|名|位)$/.test(clause)) {
      assign('day', 1);
      assign('night', 1);
      continue;
    }
    if (/^(?:每天|1天)?(?:就)?\d+(?:个?人|名|位)$/.test(clause)) {
      errors.push(`“${part}”未说明夜班：请写“1人值24小时”或“白班1人，不排夜班”`);
      continue;
    }
    clause = clause.replace(/(?:不排|不安排|没有)夜班|夜班(?:不排|不安排)/g, () => {
      assign('night', 0);
      return '';
    });
    clause = clause.replace(/(白班|夜班)(?:安排|需要|要|为|是|上)?(\d+)(?:个?人|名|位|个)?/g, (_, shift, count) => {
      assign(shift === '白班' ? 'day' : 'night', Number(count));
      return '';
    });
    clause = clause.replace(/(?:每天|每日|安排|排班|值班|各|和|及|、|\+|\/)/g, '');
    if (clause) errors.push(`未能完整理解“${part}”，请写明白班/夜班人数；指定人员、请假等安排可在生成后手动修改`);
  }
  if (demands.normal.day == null || demands.normal.night == null) errors.push('请写明平日白班和夜班人数，例如“平时白班2人，夜班1人”');
  if (usesHolidays && (demands.holiday.day == null || demands.holiday.night == null))
    errors.push('请写完整节假日安排，例如“节假日1人值24小时”或“节假日白班1人，不排夜班”');
  for (const [key, demand] of Object.entries(demands)) {
    const name = key === 'normal' ? '平日' : '节假日';
    if (nightMustAttendDay && demand.night != null && demand.day != null && demand.night > demand.day)
      errors.push(`${name}要求所有夜班人员参加白班，但白班人数少于夜班人数`);
    if (demand.night != null && (!Number.isInteger(demand.night) || demand.night < 0 || demand.night > 100))
      errors.push(`${name}夜班人数须为0至100的整数`);
    if (demand.day != null && (!Number.isInteger(demand.day) || demand.day < 0 || demand.day > 100)) errors.push(`${name}白班人数须为0至100的整数`);
  }
  if (errors.length) return { errors: [...new Set(errors)], summary: [] };
  const rule: TextDutyRule = {
    normal: demands.normal as ShiftDemand,
    holiday: usesHolidays ? (demands.holiday as ShiftDemand) : (demands.normal as ShiftDemand),
    usesHolidays,
    weekendHoliday,
    restAfterNight,
    restAfterFullDay,
  };
  return {
    rule,
    errors: [],
    summary: [
      `平日：白班${rule.normal.day}人，夜班${rule.normal.night}人`,
      usesHolidays
        ? `法定节假日：白班${rule.holiday.day}人，夜班${rule.holiday.night}人${rule.holiday.day === 1 && rule.holiday.night === 1 ? '（同一人值24小时）' : ''}`
        : '节假日沿用平日人数',
      `周末按${weekendHoliday ? '节假日' : '平日'}规则，法定调休上班日按平日规则`,
      restAfterFullDay
        ? '白夜班优先兼任；同一天同时上白班和夜班（24小时）的人，次日全天休息'
        : restAfterNight
          ? '白夜班优先由同一批人员兼任，夜班人员次日全天休息'
          : '白夜班优先由同一批人员兼任，不强制次日休息',
    ],
  };
}

function classifyDate(date: string, rule: TextDutyRule): boolean {
  const holiday = HolidayUtil.getHoliday(date);
  if (holiday) return !holiday.isWork();
  return rule.weekendHoliday && [0, 6].includes(dayjs(date).day());
}

/** 按月实际模拟，人数和前一日夜班休息约束无解时不产生部分排班。 */
export function checkTextDutyRule(
  text: string,
  rows: DutyRosterDay[],
  users: DutyPerson[],
  previousNightUserId?: string | string[] | null,
  previousDayUserIds?: string[]
): RuleCheck {
  const parsed = parseDutyRule(text);
  if (!parsed.rule) return parsed;
  const rule = parsed.rule;
  const errors: string[] = [];
  if (!users.length || users.some((user) => !user.userId) || new Set(users.map((user) => user.userId)).size !== users.length)
    errors.push('请选择不同的参与排班人员后再检查规则');
  if (!rows.length) errors.push('当前月份没有可排班日期');
  if (rule.usesHolidays && rows.length && !HolidayUtil.getHolidays(dayjs(rows[0].date).year()).length)
    errors.push('该年份暂无内置法定节假日数据，请先去掉节假日差异规则或使用其他生成方式，不会将未知节假日按平日生成');
  if (errors.length) return { ...parsed, errors };
  const nightCounts = users.map(() => 0),
    dayCounts = users.map(() => 0);
  const previousIds = Array.isArray(previousNightUserId) ? previousNightUserId : previousNightUserId ? [previousNightUserId] : [];
  const restIds = rule.restAfterFullDay ? previousIds.filter((id) => (previousDayUserIds || []).includes(id)) : previousIds;
  let previous = users.map((user, i) => (restIds.includes(user.userId || '') ? i : -1)).filter((i) => i >= 0);
  let cursor = previous.length ? (previous[previous.length - 1] + 1) % users.length : 0;
  const generated: DutyRosterDay[] = [],
    holidayDates: string[] = [];
  for (const row of rows) {
    const holiday = rule.usesHolidays && classifyDate(row.date, rule);
    if (holiday) holidayDates.push(row.date);
    const demand = holiday ? rule.holiday : rule.normal;
    const available = users.map((_, i) => i).filter((i) => !(rule.restAfterNight || rule.restAfterFullDay) || !previous.includes(i));
    if (Math.max(demand.day, demand.night) > available.length)
      return {
        ...parsed,
        errors: [
          `${row.date}需要白班${demand.day}人、夜班${demand.night}人，但${(rule.restAfterNight || rule.restAfterFullDay) && previous.length ? `前一天${rule.restAfterFullDay ? '值24小时的' : '上夜班的'}${previous.map((i) => users[i].name).join('、')}需休息，` : ''}仅有${available.length}人可排。请增加人员、减少当天人数或调整休息规则。`,
        ],
      };
    const distance = (i: number) => (i - cursor + users.length) % users.length;
    const ranked = [...available].sort((a, b) => nightCounts[a] - nightCounts[b] || distance(a) - distance(b));
    const night = ranked.slice(0, demand.night);
    const day = night.slice(0, demand.day);
    const remaining = available.filter((i) => !day.includes(i)).sort((a, b) => dayCounts[a] - dayCounts[b] || distance(a) - distance(b));
    day.push(...remaining.slice(0, demand.day - day.length));
    const rest = users.map((_, i) => i).filter((i) => !day.includes(i) && !night.includes(i));
    const nightUsers = night.map((i) => ({ ...users[i] }));
    generated.push({
      ...row,
      dayUsers: day.map((i) => ({ ...users[i] })),
      nightUsers,
      nightUser: nightUsers[0] || null,
      restUsers: rest.map((i) => ({ ...users[i] })),
      restUser: rest.length ? { ...users[rest[0]] } : null,
    });
    day.forEach((i) => dayCounts[i]++);
    night.forEach((i) => nightCounts[i]++);
    if (night.length) cursor = (night[night.length - 1] + 1) % users.length;
    else if (day.length) cursor = (day[0] + 1) % users.length;
    previous = rule.restAfterFullDay ? night.filter((i) => day.includes(i)) : night;
  }
  return { ...parsed, errors: [], rows: generated, holidayDates };
}
