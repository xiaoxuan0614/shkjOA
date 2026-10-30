import dayjs from 'dayjs';
import { HolidayUtil } from 'lunar-javascript';
import type { DutyPerson, DutyRosterDay } from './dutyRoster.store';
import type { DutyRuleForm, RuleCheck } from './dutyRoster.textRule';
export interface AdvancedRule extends DutyRuleForm {
  nightRest: 'none' | 'morning' | 'full';
  coverMorning: boolean;
  overlap: boolean;
  holidays: boolean;
  holidaySeparate: boolean;
  holidayDay: number | null;
  holidayNight: number | null;
  start: 'continue' | 'person';
  startUserId: string;
  exceptions: { dates: string[]; day: number | null; night: number | null }[];
}
export const defaultAdvancedRule = (): AdvancedRule => ({day:4,night:1,weekendDay:1,weekendNight:1,nightRest:'morning',coverMorning:false,overlap:true,holidays:false,holidaySeparate:false,holidayDay:1,holidayNight:1,start:'continue',startUserId:'',exceptions:[]});
export function advancedSummary(f: AdvancedRule): string {
  return `工作日白${f.day ?? '—'}夜${f.night ?? '—'}，周末白${f.weekendDay ?? '—'}夜${f.weekendNight ?? '—'}；夜班后${{none:'不休息',morning:'次日上午休息',full:'次日全天休息'}[f.nightRest]}${f.nightRest==='morning'?(f.coverMorning?'，上午另排人补足':'，不补人'):''}；${f.overlap?'允许':'不允许'}同日兼白夜班；${f.holidays?(f.holidaySeparate?`节假日白${f.holidayDay ?? '—'}夜${f.holidayNight ?? '—'}`:'节假日沿用周末'):'按自然星期'}；${f.exceptions.length}条指定日期安排。`;
}
export function checkAdvancedRule(f: AdvancedRule, rows: DutyRosterDay[], users: DutyPerson[], previousIds: string[] = []): RuleCheck {
  const summary=[advancedSummary(f)], errors:string[]=[];
  const fail=(message:string):RuleCheck=>({errors:[message],summary});
  if (!users.length || users.some(u=>!u.userId) || new Set(users.map(u=>u.userId)).size!==users.length) return fail('请先选择不同的参与人员');
  if (!rows.length) return fail('请选择排班月份');
  const demands=[['工作日',f.day,f.night],['周末',f.weekendDay,f.weekendNight],...(f.holidays&&f.holidaySeparate?[['节假日',f.holidayDay,f.holidayNight]]:[]),...f.exceptions.map((e,i)=>[`特殊日期第${i+1}条`,e.day,e.night])];
  for(const [label,d,n] of demands) if([d,n].some(v=>typeof v!=='number'||!Number.isInteger(v)||v<0||v>100)) errors.push(`${label}白班和夜班人数须为0至100的整数`);
  if(errors.length)return {errors,summary};
  if(f.start==='person'&&!users.some(u=>u.userId===f.startUserId))return fail('请选择本月起排人员，且该人员须在参与名单中');
  if(f.holidays&&!HolidayUtil.getHolidays(dayjs(rows[0].date).year()).length)return fail('该年份暂无节假日数据，请关闭节假日识别并使用指定日期安排');
  const overrides=new Map<string,{day:number|null;night:number|null}>();
  for(const [i,e] of f.exceptions.entries()){
    if(!Array.isArray(e.dates)||e.dates.length!==2||e.dates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||!dayjs(d).isValid()||dayjs(d).format('YYYY-MM-DD')!==d)||e.dates[0]>e.dates[1])return fail(`特殊日期第${i+1}条请选择完整、有效的日期范围`);
    if(e.dates.some(d=>d.slice(0,7)!==rows[0].date.slice(0,7)))return fail(`特殊日期第${i+1}条须在当前月份内`);
    for(let d=dayjs(e.dates[0]);d.format('YYYY-MM-DD')<=e.dates[1];d=d.add(1,'day')){const key=d.format('YYYY-MM-DD');if(overrides.has(key))return fail(`${key}有重叠的特殊安排，请合并或调整日期`);overrides.set(key,e);}
  }
  let previous=new Set(previousIds);
  const last=users.findIndex(u=>u.userId===previousIds.at(-1));
  let cursor=f.start==='person'?users.findIndex(u=>u.userId===f.startUserId):last<0?0:(last+1)%users.length;
  const generated:DutyRosterDay[]=[], holidayDates:string[]=[];
  for(const row of rows){
    const official=f.holidays?HolidayUtil.getHoliday(row.date):null;
    const holiday=official&&!official.isWork();
    const weekend=official?false:[0,6].includes(dayjs(row.date).day());
    if(holiday)holidayDates.push(row.date);
    const demand=overrides.get(row.date)||(holiday?(f.holidaySeparate?{day:f.holidayDay,night:f.holidayNight}:{day:f.weekendDay,night:f.weekendNight}):weekend?{day:f.weekendDay,night:f.weekendNight}:{day:f.day,night:f.night});
    const available=users.filter(u=>f.nightRest!=='full'||!previous.has(u.userId!));
    const dayAvailable=available.filter(u=>!(f.nightRest==='morning'&&f.coverMorning&&previous.has(u.userId!)));
    const d=demand.day!,n=demand.night!;
    if(d>dayAvailable.length||n>available.length||(!f.overlap&&d+n>available.length))return fail(`${row.date}需白班${d}人、夜班${n}人，休息规则下白班可排${dayAvailable.length}人、夜班可排${available.length}人${!f.overlap?'，且白夜班不能重复':''}。请增加人员或调整当天人数/休息规则`);
    const take=(count:number,pool:DutyPerson[])=>{const result:DutyPerson[]=[];for(let step=0;step<users.length*2&&result.length<count;step++){const u=users[cursor++%users.length];if(pool.some(p=>p.userId===u.userId)&&!result.some(p=>p.userId===u.userId))result.push({...u});}return result;};
    // 全员白班不消耗轮次；其余白班先取人，夜班接着排。
    const dayUsers=d===dayAvailable.length?dayAvailable.map(u=>({...u})):take(d,dayAvailable);
    if(f.nightRest==='morning'&&f.coverMorning&&d>0) dayUsers.push(...users.filter(u=>previous.has(u.userId!)).map(u=>({...u})));
    const nightPool=f.overlap?available:available.filter(u=>!dayUsers.some(p=>p.userId===u.userId));
    const nightUsers=take(n,nightPool);
    if(nightUsers.length!==n)return fail(`${row.date}无法按当前顺序排满班次，请调整规则（上午补班人员和下午返岗人员都计入白班名单）`);
    const occupied=new Set([...dayUsers,...nightUsers].map(u=>u.userId));
    const restUsers=users.filter(u=>!occupied.has(u.userId)).map(u=>({...u}));
    generated.push({...row,dayUsers,nightUsers,nightUser:nightUsers[0]||null,restUsers,restUser:restUsers[0]||null});
    previous=new Set(nightUsers.map(u=>u.userId!));
  }
  return {errors:[],summary,rows:generated,holidayDates};
}
