export type Data = Record<string, any>;
export type Transport = (method: 'GET' | 'POST', path: string, data?: Data) => Promise<any>;
export const restReasons: Record<string, string> = {
  REST_OVERLAP:'与已有休息时间重叠', MISSING_SCHEDULE:'尚未设置预计执行时间', WORK_IN_PROGRESS:'正在执行，不能转派', APPROVAL_IN_PROGRESS:'存在待审批申请', NO_ELIGIBLE_RECEIVER:'暂无可接单人员', CANDIDATE_UNAVAILABLE:'指定人员当前不可接单', ORIGINAL_OWNER:'原负责人不能接收自己的转派单', ACCOUNT_UNAVAILABLE:'账号不可用', REST_CONFLICT:'与休息时间冲突', ORDER_SET_CHANGED:'受影响工单已变化，请重新预览', PREVIEW_CHANGED:'分配方案已变化，请重新预览', PREVIEW_EXPIRED:'预览已过期，请重新预览', REQUEST_REUSED:'请求号与原提交不一致，请核对记录',
};
export function reasonText(code: string) { return restReasons[code] || code || '—'; }
export function beijingDate(now = Date.now()) { return new Date(now + 8*3600000).toISOString().slice(0,10); }
export function nextDate(date: string) { return new Date(Date.parse(date+'T00:00:00+08:00')+32*3600000).toISOString().slice(0,10); }
export function toTimestamp(date: string, time: string) {
  const value = `${date}T${time}:00+08:00`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)+8*3600000).toISOString().slice(0,16)!==`${date}T${time}`) throw new Error('请选择有效的日期和时间');
  return value;
}
export function timeRange(form: Data, now = Date.now()) {
  const startAt=toTimestamp(form.startDate,form.startTime), endAt=toTimestamp(form.endDate,form.endTime);
  const start=Date.parse(startAt),end=Date.parse(endAt);
  if(end<=start || end<=now) throw new Error('结束时间须晚于开始时间和当前时间');
  if(end-start>366*86400000)throw new Error('时间跨度不能超过366天');
  return {startAt,endAt};
}
export function formatTime(value: string) {
  if(!value)return '未设置';
  const normalized=/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:value.replace(' ','T')+'+08:00';
  const n=Date.parse(normalized);return Number.isFinite(n)?new Date(n+8*3600000).toISOString().slice(0,16).replace('T',' '):value;
}
export function assignmentPlan(items: Data[], choices: Record<string,string>) {
  return items.map(item=>choices[item.orderId] ? {orderId:item.orderId,mode:'MANUAL',targetUserId:choices[item.orderId]} : {orderId:item.orderId,mode:'AUTO'});
}
export function batchCandidates(items: Data[], ids: string[]) {
  const selected=items.filter(i=>ids.includes(i.orderId));
  if(!selected.length)return [];
  return (selected[0].eligibleCandidates||[]).filter((p:Data)=>p.canAssign===true && selected.every(i=>(i.eligibleCandidates||[]).some((q:Data)=>q.userId===p.userId && q.canAssign===true)));
}
export function requestId(){return `rest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;}
export function resultOf(response: Data) {
  if(response?.success!==true)throw Object.assign(new Error(response?.message||'请求失败'),{definite:true,errorCode:response?.errorCode,code:response?.code});
  if(response.result==null)throw new Error('接口未返回有效结果，请核对记录');
  return response.result;
}
