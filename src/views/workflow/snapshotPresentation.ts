import type { FormField } from './workflow.types';

// Labels describe snapshot data only; workflow status/permissions remain server-owned.
const labels: Record<string, string> = {
  form: '申请内容', formData: '申请内容', reason: '申请原因', remark: '备注', description: '说明',
  applicationId: '申请编号', applicationType: '申请类型', orderId: '维修单编号', orderNo: '维修单号',
  targetUserId: '接收人编号', targetUserName: '接收人', sourcePersonId: '外协单位编号', unitName: '外协单位',
  personType: '协助类型', personCount: '申请人数', estimatedTotalHours: '预计总工时（小时）', closeType: '关闭原因',
  departments: '受邀部门', departmentId: '部门编号', departmentName: '部门', departmentCount: '部门数量',
  userId: '人员编号', userName: '姓名', name: '名称', title: '名称', content: '内容',
  projectContext: '项目信息', projectName: '项目名称', periodName: '分期名称', customerName: '客户名称',
  contactPerson: '客户联系人', projectLiaisonUserName: '项目对接人', salesUserName: '销售人员',
  paymentPlan: '回款计划', paymentName: '回款项', paymentRatio: '回款比例', paymentAmount: '回款金额',
  ratio: '比例', amount: '金额', paymentDate: '回款日期', contractName: '合同名称', contractNo: '合同编号',
  contractAmount: '合同金额', quotation: '报价信息', candidateName: '报价单名称', version: '版本',
  items: '明细', materialName: '物料名称', materialCode: '物料编码', brand: '品牌', model: '型号',
  specificationParams: '规格参数', quantity: '数量', qty: '数量', unit: '单位', costPrice: '成本单价',
  guidePrice: '指导单价', quotePrice: '报价单价', totalPrice: '总价', guideMarkupRate: '指导比例',
  createdAt: '申请时间', createTime: '创建时间', applyTime: '申请时间', applyUserName: '申请人',
};
const values: Record<string, Record<string, string>> = {
  closeType: { CUSTOMER_ABANDONED: '客户弃修', NOT_A_PROBLEM: '非故障', OTHER: '其他' },
  personType: { INTERNAL: '内部协助', EXTERNAL: '外部协助' },
};

// Business-linked forms contain transport fields as well as business content.
// Read only the already-authorized projection, never the unfiltered instance snapshot.
export function applicationRows(visible: Record<string, unknown>, fields: FormField[], permissions: Record<string, string>, processKey?: string) {
  const definitions: Record<string, Array<[string, string]>> = {
    repair_ops_external: [['orderId', '维修单编号'], ['form.unitName', '外协单位'], ['form.personCount', '申请人数'], ['form.estimatedTotalHours', '预计总工时（小时）'], ['form.reason', '需要协助原因：']],
    repair_ops_transfer: [['orderId', '维修单编号'], ['form.targetUserId', '接收人'], ['form.reason', '转单原因']],
    repair_ops_close: [['orderId', '维修单编号'], ['form.closeType', '关闭原因'], ['form.reason', '关闭说明']],
  };
  function read(path: string): unknown {
    if (Object.entries(permissions).some(([key, permission]) => permission === 'HIDDEN' && (path === key || path.startsWith(`${key}.`)))) return undefined;
    if (Object.prototype.hasOwnProperty.call(visible, path)) return visible[path];
    const [parent, key] = path.split('.');
    const data = snapshotValue(visible[parent]);
    return key && data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : undefined;
  }
  if (processKey && definitions[processKey]) return definitions[processKey].flatMap(([key, label]) => {
    let value = read(key);
    if (key === 'form.targetUserId') value = read('form.targetUserName') || value;
    if (value === undefined) return [];
    return [{ field: { key, name: label, type: fields.find(field => field.key === key)?.type || 'string' }, value }];
  });
  return fields.filter(field => Object.prototype.hasOwnProperty.call(visible, field.key))
    .map(field => ({ field, value: visible[field.key] }));
}

export function snapshotValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^[\[{]/.test(trimmed)) {
    try { return JSON.parse(trimmed); } catch { /* Ordinary text is preserved verbatim. */ }
  }
  return value;
}

export function snapshotText(value: unknown, path = ''): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return values[path.split('.').pop() || '']?.[String(value)] || String(value);
}

export function snapshotEntries(value: Record<string, unknown>, path: string, fields: FormField[], permissions: Record<string, string>) {
  return Object.entries(value).flatMap(([key, item]) => {
    const childPath = path ? `${path}.${key}` : key;
    const normalized = childPath.replace(/\[\]/g, '');
    if (Object.entries(permissions).some(([hidden, permission]) => {
      const hiddenPath = hidden.replace(/\[\]/g, '');
      return permission === 'HIDDEN' && (normalized === hiddenPath || normalized.startsWith(`${hiddenPath}.`));
    })) return [];
    // Prefer a returned readable name over its duplicate identifier, never fetch unrelated data.
    const nameKey = `${key.slice(0, -2)}Name`;
    if (key.endsWith('Id') && typeof value[nameKey] === 'string' && String(value[nameKey]).trim() && permissions[`${path}.${nameKey}`] !== 'HIDDEN') return [];
    return [{ key: childPath, label: fields.find(field => field.key === childPath)?.name || labels[key] || key, value: item }];
  });
}
