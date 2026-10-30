import { reactive } from 'vue';
export type DispatchRule = { id: string; userId: string; mode: 'CUSTOMER' | 'DUTY'; customerIds: string[]; enabled: boolean; updatedAt: string };
export const people = ['运维人员甲', '运维人员乙', '运维人员丙', '运维人员丁'].map((label, i) => ({ label, value: `person-${i}` }));
export const customers = ['示例客户一', '示例客户二', '示例客户三', '示例客户四'].map((label, i) => ({ label, value: `customer-${i}` }));
// 仅当前页面会话演示，不调用接口或写入浏览器持久存储。
export const rules = reactive<DispatchRule[]>([
  { id: 'sample-customer', userId: 'person-0', mode: 'CUSTOMER', customerIds: ['customer-0'], enabled: true, updatedAt: '—' },
  ...people.slice(1).map((p, i): DispatchRule => ({ id: `sample-duty-${i}`, userId: p.value, mode: 'DUTY', customerIds: [], enabled: true, updatedAt: '—' })),
]);
export function validateRule(rule: DispatchRule): string {
  if (!people.some(p => p.value === rule.userId)) return '请选择运维人员';
  if (rule.mode === 'CUSTOMER' && !rule.customerIds.length) return '客户制至少选择一个客户';
  if (rule.customerIds.some(id => !customers.some(c => c.value === id))) return '客户选项已失效，请重新选择';
  if (!rule.enabled) return '';
  if (rules.some(r => r.id !== rule.id && r.enabled && r.mode === rule.mode && r.userId === rule.userId)) return '该人员已有相同类型的有效规则，请编辑原规则';
  const conflict = rules.find(r => r.id !== rule.id && r.enabled && r.mode === 'CUSTOMER' && rule.mode === 'CUSTOMER' && r.customerIds.some(id => rule.customerIds.includes(id)));
  return conflict ? `所选客户已有负责人：${people.find(p => p.value === conflict.userId)?.label}，请先调整原规则` : '';
}
