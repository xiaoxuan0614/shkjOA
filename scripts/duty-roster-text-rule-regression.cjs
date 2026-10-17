const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const dayjs = require('dayjs');
const moduleExports = {};
new Function(
  'require',
  'exports',
  ts.transpileModule(fs.readFileSync('src/views/operation/duty-roster/dutyRoster.textRule.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
)(require, moduleExports);
const { parseDutyRule, checkTextDutyRule } = moduleExports;
const users = ['A', 'B', 'C'].map((userId) => ({ userId, name: userId, phone: null }));
const rows = (month) =>
  Array.from({ length: dayjs(month).daysInMonth() }, (_, i) => ({
    date: dayjs(month)
      .date(i + 1)
      .format('YYYY-MM-DD'),
    dayUsers: [],
    nightUser: null,
    restUser: null,
  }));
const rule = '平时白班2人，夜班1人；\n节假日1人值24小时；\n夜班后休息一天；周末按平时排班。';
assert.deepEqual(parseDutyRule(rule).errors, []);
const checked = checkTextDutyRule(rule, rows('2026-10'), users);
assert.deepEqual(checked.errors, []);
assert.equal(checked.rows.length, 31);
assert.deepEqual(
  checked.holidayDates,
  Array.from({ length: 7 }, (_, i) => `2026-10-0${i + 1}`)
);
assert.equal(checked.rows[0].dayUsers.length, 1);
assert.equal(checked.rows[0].nightUser.userId, checked.rows[0].dayUsers[0].userId);
assert.equal(checked.rows[7].dayUsers.length, 2);
assert.equal(checked.rows[9].dayUsers.length, 2, '10月10日调休上班，按平日规则');
checked.rows.slice(1).forEach((day, i) => {
  assert.ok(!day.dayUsers.some((person) => person.userId === checked.rows[i].nightUser.userId));
  assert.ok(day.restUsers.some(person => person.userId === checked.rows[i].nightUser.userId));
});
assert.ok(!checkTextDutyRule(rule, rows('2026-10'), users, 'A').rows[0].dayUsers.some((person) => person.userId === 'A'));
const weekend = checkTextDutyRule(rule.replace('周末按平时', '周末按节假日'), rows('2026-10'), users);
assert.equal(weekend.rows[9].dayUsers.length, 2, '即使周末按假日，调休上班仍优先按平日');
assert.equal(weekend.rows[16].dayUsers.length, 1, '普通周末可按节假日');
const noHolidayNight = checkTextDutyRule('平时白2个夜1个；节假日白班1人，不排夜班；夜班后休息1天', rows('2026-10'), users);
assert.deepEqual(noHolidayNight.errors, []);
assert.equal(noHolidayNight.rows[0].nightUser, null);
assert.deepEqual(parseDutyRule('平时白班两人，夜班一人；节假日一人上二十四小时；夜班后休息一天').errors, []);
for (const text of [
  '',
  '平时白班2人',
  '平时白班2人夜班1人；节假日一天一个人',
  '平时白班2人夜班1人；白班3人',
  '平时白班2人夜班1人；张三周一不上班',
  '平时白班2人夜班1人；夜班后休息2天',
  '平时白班1.5人夜班1人',
]) {
  const parsed = parseDutyRule(text);
  assert.ok(parsed.errors.length, `未明确/不支持的规则应拒绝：${text}`);
  assert.equal(parsed.rule, undefined);
}
const shortage = checkTextDutyRule('平时白班2人，夜班1人；夜班后休息一天', rows('2026-10'), users.slice(0, 2));
assert.ok(shortage.errors[0].includes('2026-10-02'));
assert.ok(shortage.errors[0].includes('仅有1人'));
assert.equal(shortage.rows, undefined, '不返回可被误认为完整表的部分结果');
assert.ok(checkTextDutyRule(rule, rows('2027-01'), users).errors.some((error) => error.includes('暂无内置')));
assert.ok(checkTextDutyRule(rule, rows('2026-10'), [users[0], users[0]]).errors.length);
const noRest = checkTextDutyRule('平时白班2人夜班1人；夜班后不强制休息', rows('2026-10'), users.slice(0, 2));
assert.deepEqual(noRest.errors, []);
console.log('PASS 文字规则解析、中文人数/换行/缩写、歧义/未知约束/冲突拒绝、节假日与调休、逐日缺人和次日休息、跨月、未知年份保护');

const four = [...users, { userId: 'D', name: 'D', phone: null }];
const multi = checkTextDutyRule('平时白班2人夜班2人；夜班后休息一天', rows('2026-10'), four);
assert.deepEqual(multi.errors, []);
assert.ok(multi.rows.every(row => row.nightUsers.length === 2 && row.dayUsers.length === 2));
multi.rows.slice(1).forEach((row, i) => {
  const previous = multi.rows[i].nightUsers.map(person => person.userId);
  assert.ok([...row.dayUsers, ...row.nightUsers].every(person => !previous.includes(person.userId)));
});
assert.ok(checkTextDutyRule('平时白班2人夜班2人', rows('2026-10'), users).errors[0].includes('2026-10-02'));
const cross = checkTextDutyRule('平时白班2人夜班2人', rows('2026-10'), four, ['A', 'B']);
assert.deepEqual(cross.rows[0].nightUsers.map(p => p.userId), ['C', 'D']);
const nightsOnly = checkTextDutyRule('平时白班0人夜班2人', rows('2026-10'), four);
assert.ok(nightsOnly.rows.every(row => row.dayUsers.length === 0 && row.nightUsers.length === 2));
console.log('PASS 多人夜班人数、次日全员休息、人数不足、跨月多人衔接和纯夜班');
const natural = `工作日 和周末 早班2人 晚班 1人
节假日例如国庆 早班 1人 晚班 1人
一个人 如果当天上了24小时 那转天休息`;
const interpreted = parseDutyRule(natural);
assert.deepEqual(interpreted.errors, []);
assert.deepEqual(interpreted.rule.normal, { day: 2, night: 1 });
assert.deepEqual(interpreted.rule.holiday, { day: 1, night: 1 });
assert.equal(interpreted.rule.restAfterFullDay, true);
assert.equal(interpreted.rule.restAfterNight, false);
const naturalMonth = checkTextDutyRule(natural, rows('2026-10'), users);
assert.deepEqual(naturalMonth.errors, []);
assert.equal(naturalMonth.rows[0].dayUsers.length, 1);
assert.equal(naturalMonth.rows[16].dayUsers.length, 2);
naturalMonth.rows.slice(1).forEach((row, i) => {
  const previous = naturalMonth.rows[i];
  const fullDay = previous.nightUsers.filter(p => previous.dayUsers.some(d => d.userId === p.userId));
  assert.ok(fullDay.every(p => ![...row.dayUsers, ...row.nightUsers].some(q => q.userId === p.userId)));
});
const fullDayOnly = '平时白班0人夜班1人；一个人如果当天上了24小时，那转天休息';
assert.deepEqual(checkTextDutyRule(fullDayOnly, rows('2026-10'), users.slice(0, 1)).errors, []);
const crossFull = checkTextDutyRule('平时白班1人夜班1人；上24小时后次日休息', rows('2026-10'), users, ['A', 'B'], ['A']);
assert.ok(!crossFull.rows[0].dayUsers.some(p => p.userId === 'A'));
assert.deepEqual(parseDutyRule(natural.replace('那转天', '，第二天')).errors, []);
console.log('PASS 用户原文、工作日及周末、节假日举例、24小时休息与跨月交集');
