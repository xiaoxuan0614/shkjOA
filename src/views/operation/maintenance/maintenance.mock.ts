import Big from 'big.js';

export function paymentAmount(amount: number, ratio: number): string {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(ratio) || ratio < 0 || ratio > 100) return '—';
  return new Big(amount).times(ratio).div(100).toFixed(2, Big.roundHalfUp);
}

export function paymentRatioTotal(payments: MaintenanceContract['payments']): string {
  return payments.reduce((sum, p) => sum.plus(Number.isFinite(p.ratio) ? p.ratio : 0), new Big(0)).toFixed(2);
}

export function validatePayments(payments: MaintenanceContract['payments']) {
  if (!payments.length) return '请至少添加一条回款项';
  for (const [index, p] of payments.entries()) {
    const row = `第${index + 1}行`;
    if (!p.name) return `${row}请选择回款项`;
    if (!Number.isFinite(p.ratio) || p.ratio <= 0 || p.ratio > 100 || !new Big(p.ratio).eq(new Big(p.ratio).round(2))) return `${row}比例须大于0且不超过100%，最多两位小数`;
    if (!Number.isInteger(p.days) || p.days < 0) return `${row}回款周期须为非负整数`;
  }
  if (new Set(payments.map(p => p.name)).size !== payments.length) return '回款项不能重复';
  if (!payments.reduce((sum, p) => sum.plus(p.ratio), new Big(0)).eq(100)) return `回款比例合计须为100%，当前为${paymentRatioTotal(payments)}%`;
  return '';
}

export interface MaintenanceContract {
  id: string; periodId: string; previousId?: string; name: string; no: string;
  type: 'FULL' | 'HALF'; signed: string; start: string; end: string;
  amount: number; sales: string; salesUserId?: string; scope: string; remark: string;
  files: { name: string; url?: string }[];
  payments: { name: string; ratio: number; days: number }[];
}
export const archivedPeriods = [
  { id: 'mock-p1', name: '示范园区安防改造-一期', customer: '示例园区管理公司', contact: '示例对接人甲' },
  { id: 'mock-p2', name: '示范园区安防改造-二期', customer: '示例园区管理公司', contact: '示例对接人乙' },
  { id: 'mock-p3', name: '示范办公楼网络建设-一期', customer: '示例办公楼管理公司', contact: '示例对接人丙' },
];
export const seedContracts = (): MaintenanceContract[] => [
  { id: 'mock-c1', periodId: 'mock-p1', name: '园区一期2025年度维保合同', no: 'WB-DEMO-2025-001', type: 'FULL', signed: '2024-12-20', start: '2025-01-01', end: '2025-12-31', amount: 36000, sales: '示例销售负责人', scope: '安防设备巡检、故障处理及合同约定的配件更换', remark: '演示历史合同，续签不会覆盖本记录。', files: [{ name: '2025年度合同（示例，无真实附件）' }], payments: [{ name: '一次款', ratio: 100, days: 7 }] },
  { id: 'mock-c2', previousId: 'mock-c1', periodId: 'mock-p1', name: '园区一期2026年度维保合同', no: 'WB-DEMO-2026-001', type: 'HALF', signed: '2025-12-20', start: '2026-01-01', end: '2026-12-31', amount: 24000, sales: '示例销售负责人', scope: '定期巡检及人工维修，配件费用另行约定', remark: '半包服务范围以合同条款为准。', files: [{ name: '2026年度合同（示例，无真实附件）' }], payments: [{ name: '一次款', ratio: 100, days: 7 }] },
];
export function contractState(c: MaintenanceContract, today: string) {
  return today < c.start ? '未生效' : today > c.end ? '已到期' : '服务中';
}
export function validateContract(c: MaintenanceContract) {
  if (!archivedPeriods.some(p => p.id === c.periodId)) return '请选择归档分期项目';
  if (!c.salesUserId || !c.sales.trim()) return '请选择销售负责人';
  if (![c.name, c.no, c.sales, c.scope].every(v => v.trim())) return '请填写合同名称、编号、销售负责人和维保范围';
  if (!['FULL', 'HALF'].includes(c.type)) return '请选择维保类型';
  if (!c.signed || !c.start || !c.end || c.end < c.start) return '请填写有效的签订日期和维保起止日期';
  if (!Number.isFinite(c.amount) || c.amount <= 0) return '维保金额须大于0';
  if (!c.files.length || !c.files.every(f => f.url)) return '请上传新合同附件（Mock，仅当前会话）';
  return validatePayments(c.payments);
}
export function renewalDraft(old: MaintenanceContract): MaintenanceContract {
  return { ...old, id: '', previousId: old.id, name: `${old.name}（续签）`, no: '', signed: '', start: '', end: '', sales: old.salesUserId ? old.sales : '', files: [], payments: old.payments.map(p => ({ ...p })) };
}
