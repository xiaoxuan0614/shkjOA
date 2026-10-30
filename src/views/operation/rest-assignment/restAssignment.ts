/** 页面预览模型：不调用业务写接口，不持久化示例记录。双端保持一致。 */
export interface RestForm { date: string; userId: string; start: string; end: string; reason: string }
export interface RestOrder { id: string; title: string; customer: string; time: string; state: 'pending' | 'working'; targetId: string }
export const demoPeople = [
  { id: 'demo-a', name: '运维人员甲', hint: '白班 · 待处理2单' },
  { id: 'demo-b', name: '运维人员乙', hint: '白班 · 待处理1单' },
  { id: 'demo-c', name: '运维人员丙', hint: '白班 · 待处理3单' },
  { id: 'demo-d', name: '运维人员丁', hint: '08:00—12:00休息', unavailable: true },
];
export function validateRest(form: RestForm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !Number.isFinite(Date.parse(form.date + 'T00:00:00Z')) || new Date(form.date + 'T00:00:00Z').toISOString().slice(0, 10) !== form.date) return '请选择日期';
  if (!demoPeople.some(p => p.id === form.userId)) return '请选择运维人员';
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(form.start) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(form.end) || form.start >= form.end) return '休息结束时间须晚于开始时间';
  return '';
}
export function previewOrders(form: RestForm): RestOrder[] {
  return [
    { id: '示例 WX-001', title: '摄像机离线', customer: '示例客户 · 园区监控', time: '09:00', state: 'pending' as const, targetId: '' },
    { id: '示例 WX-002', title: '门禁无法识别', customer: '示例客户 · 办公楼门禁', time: '10:30', state: 'pending' as const, targetId: '' },
    { id: '示例 WX-003', title: '网络间歇中断', customer: '示例客户 · 网络维护', time: '11:00', state: 'working' as const, targetId: '' },
    { id: '示例 WX-004', title: '录像存储异常', customer: '示例客户 · 视频存储', time: '15:00', state: 'pending' as const, targetId: '' },
  ].filter(row => row.time >= form.start && row.time < form.end);
}
export function eligiblePeople(userId: string) { return demoPeople.filter(p => p.id !== userId && !p.unavailable); }
export function assignmentError(form: RestForm, rows: RestOrder[]) {
  const error = validateRest(form); if (error) return error;
  if (rows.some(row => row.state === 'working')) return '存在执行中的维修单，请主管另行处理后再确认休息';
  const ids = new Set(eligiblePeople(form.userId).map(p => p.id));
  if (rows.some(row => !ids.has(row.targetId))) return '请为每张待转维修单指定可接单人员';
  return '';
}
