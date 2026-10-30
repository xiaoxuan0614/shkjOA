import Big from 'big.js';
import type { FormField } from './workflow.types';
import { snapshotEntries, snapshotValue } from './snapshotPresentation';

/** Only consumes the instance form's authorized projection; never queries current order data. */
export function repairCompletionSections(visible: Record<string, unknown>, fields: FormField[], permissions: Record<string, string> = {}, noQuotation = false) {
  const groups = [
    { key: 'report', title: '报修信息', rows: [] as Array<{ field: FormField; value: unknown }> },
    { key: 'completion', title: '完结说明', rows: [] as Array<{ field: FormField; value: unknown }> },
    { key: 'work', title: '维修记录', rows: [] as Array<{ field: FormField; value: unknown }> },
    { key: 'material', title: '物料情况', rows: [] as Array<{ field: FormField; value: unknown }> },
  ];
  const names: Record<string, string> = { finalAmount: '最终维修金额（元）', description: '完工说明', amountChangeReason: '金额调整原因', completionDescription: '完工说明' };
  const seen = new Set<string>();
  const fees = { key: 'fees', title: '费用信息', rows: [] as Array<{ field: FormField; value: unknown }> };
  function visit(key: string, name: string, raw: unknown, type: FormField['type'] = 'string') {
    const normalized = key.replace(/\[\]/g, '');
    if (Object.entries(permissions).some(([path, access]) => access === 'HIDDEN' && (normalized === path.replace(/\[\]/g, '') || normalized.startsWith(`${path.replace(/\[\]/g, '')}.`)))) return;
    const value = snapshotValue(raw);
    if (value === undefined) return;
    if (value && typeof value === 'object' && !Array.isArray(value) && type !== 'attachment') {
      for (const entry of snapshotEntries(value as Record<string, unknown>, key, fields, permissions)) visit(entry.key, entry.label, entry.value, fields.find(f => f.key === entry.key)?.type);
      return;
    }
    const leaf = key.split('.').pop() || key;
    if (seen.has(key) || /Id$|Ids$|^version$|^requestId$|^applicationType$|^processKey$/.test(leaf)) return;
    seen.add(key);
    if (/^(finalAmount|totalAmount|customerConfirmedAmount|amountChangeReason|quotationRequired|noQuoteReason)$/.test(leaf)) {
      let amount = value;
      if (/(?:finalAmount|totalAmount|customerConfirmedAmount)$/.test(leaf) && value != null && value !== '') {
        try { amount = new Big(String(value)).toFixed(2); } catch { amount = '—'; }
      }
      if (!noQuotation) fees.rows.push({field:{key,name:names[leaf] || name,type,required:false},value:amount});
      return;
    }
    const target = /material|writeoff|物料|领用|退回数量|核销/i.test(`${key} ${name}`) ? groups[3]
      : /workRecord|workSummary|workHours|personWork|工时|维修记录|作业|参与人员/i.test(`${key} ${name}`) ? groups[2]
      : /project|period|customer|faultDescription|responsible|report|报修|项目|客户|负责人/i.test(`${key} ${name}`) ? groups[0] : groups[1];
    let formatted = value;
    if (leaf === 'finalAmount' && value != null && value !== '') {
      try { formatted = new Big(String(value)).toFixed(2); } catch { formatted = '—'; }
    }
    target.rows.push({ field: { key, name: names[leaf] || name, type, required: false }, value: formatted });
  }
  for (const field of fields) if (Object.prototype.hasOwnProperty.call(visible, field.key)) visit(field.key, field.name, visible[field.key], field.type);
  if (noQuotation) fees.rows.push({field:{key:'noQuotation',name:'报价',type:'string',required:false},value:'无需报价'});
  groups.splice(2,0,fees);
  return groups;
}
