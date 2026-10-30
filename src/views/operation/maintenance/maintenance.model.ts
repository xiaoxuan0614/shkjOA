type Row = Record<string, any>;
export const archiveStates: Record<string,string> = { DRAFT:'待补齐', ACTIVE:'有效', SUSPENDED:'暂停', CLOSED:'关闭' };
export const approvalStates: Record<string,string> = { DRAFT:'草稿', PENDING:'审批中', APPROVED:'已通过', REJECTED:'已驳回', WITHDRAWN:'已撤回' };
export const executionStates: Record<string,string> = { NOT_EFFECTIVE:'未生效', EFFECTIVE:'审批已生效', TERMINATED:'已终止' };
export const editable = (row: Row) => ['DRAFT','REJECTED','WITHDRAWN'].includes(row.approvalStatus) && row.executionStatus !== 'TERMINATED';
export const money = (value: unknown) => value == null || value === '' ? '—' : Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—';
export const date = (value: unknown) => value ? String(value).slice(0,10) : '—';
export function locationPayload(archiveId: string, row: Row) {
  if (!archiveId || !row.locationName?.trim()) throw new Error('请填写位置名称');
  const blank = (value: any) => value == null || String(value).trim() === '';
  const x = blank(row.longitude), y = blank(row.latitude);
  if (x !== y) throw new Error('经度和纬度须同时填写或同时清空');
  if (!x && (!Number.isFinite(Number(row.longitude)) || !Number.isFinite(Number(row.latitude)) || Math.abs(Number(row.longitude)) > 180 || Math.abs(Number(row.latitude)) > 90)) throw new Error('请填写有效经纬度：经度-180至180，纬度-90至90');
  if (!Number.isInteger(row.sortNo) || row.sortNo < 0) throw new Error('排序号须为非负整数');
  return { archiveId, ...(row.id ? { id: row.id } : {}), locationName: row.locationName.trim(), longitude: x ? null : String(row.longitude).trim(), latitude: y ? null : String(row.latitude).trim(), description: row.description || '', sortNo: row.sortNo, reason: row.reason || '' };
}
const fields = ['id','archiveId','contractNo','contractName','maintenanceType','signedDate','startDate','endDate','currency','scopeMode','serviceContent','exclusions','responseTerms','settlementTerms','billingNotes','responsibleDeptId','responsibleUserId','previousContractId','remark','reason','contractAmount','laborBillingMode','materialBillingMode','outsourceBillingMode','travelBillingMode','attachmentIds'];
export function contractPayload(row: Row, scope: Row[]) {
  if (!row.archiveId || !row.contractNo?.trim() || !row.contractName?.trim()) throw new Error('请填写合同名称和合同编号');
  if (row.startDate && row.endDate && row.startDate > row.endDate) throw new Error('结束日期不能早于开始日期');
  if (row.contractAmount != null && (!Number.isFinite(row.contractAmount) || row.contractAmount < 0 || Math.abs(row.contractAmount * 100 - Math.round(row.contractAmount * 100)) > 0.000001)) throw new Error('金额须为非负数字，最多两位小数');
  if (row.scopeMode === 'SELECTED' && !scope.length) throw new Error('请选择至少一个产品或设备');
  return { ...(row.paymentPlans == null ? {} : { paymentPlans: paymentPlanPayload(row.paymentPlans, row.contractAmount) }), contract: Object.fromEntries(fields.filter(key=>row[key] !== undefined && !(key === 'id' && !row[key])).map(key=>[key,row[key]])), scope: row.scopeMode === 'ALL' ? [] : scope.map(item=>item.productId ? { productId:item.productId } : { assetId:item.assetId }) };
}
export function newContract(archiveId: string, previous?: Row) {
  const base: Row = { archiveId, contractName:'', contractNo:'', maintenanceType:'FULL', currency:'CNY', scopeMode:'ALL', paymentPlans:[], attachmentIds:[], serviceContent:'', remark:'' };
  if (!previous) return base;
  for (const key of ['maintenanceType','currency','serviceContent','exclusions','responseTerms','settlementTerms','billingNotes','laborBillingMode','materialBillingMode','outsourceBillingMode','travelBillingMode','contractAmount','scopeMode']) base[key] = previous[key];
  return { ...base, previousContractId: previous.id, contractName: `${previous.contractName}（续签）` };
}
export function validateSubmit(row: Row) {
  if (!row.signedDate || !row.startDate || !row.endDate) throw new Error('提交前请补齐签约日期和维保期限');
  if (String(row.startDate).slice(0,10) > String(row.endDate).slice(0,10)) throw new Error('结束日期不能早于开始日期');
  if (!['FULL','PARTIAL'].includes(row.maintenanceType) || !row.serviceContent?.trim()) throw new Error('提交前请选择维保类型并填写服务内容');
  if (row.contractAmount == null || !Number.isFinite(Number(row.contractAmount)) || Number(row.contractAmount) < 0) throw new Error('提交前请填写合同金额');
  if (Number(row.contractAmount) === 0 && !row.remark?.trim()) throw new Error('零金额合同须填写备注');
  if (['laborBillingMode','materialBillingMode','outsourceBillingMode','travelBillingMode'].some(key=>!['INCLUDED','EXTRA','AGREED'].includes(row[key]))) throw new Error('提交前请明确人工、材料、外协、差旅费用责任');
  if (!Array.isArray(row.attachmentIds) || !row.attachmentIds.length) throw new Error('提交前请上传至少一个合同附件');
}

/** 聚合保存仅提交计划可编辑字段，实际到账及归属由后端维护。 */
export function paymentPlanPayload(plans: Row[], amount: unknown) {
  if (!Array.isArray(plans) || plans.length > 500) throw new Error('回款计划最多500条');
  let total = 0;
  const ids = new Set<string>();
  const decimal = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 0.000001;
  const result = plans.map((p, i) => {
    const label = `第${i + 1}条回款计划`;
    if (!p.paymentNode?.trim() || p.paymentNode.trim().length > 64) throw new Error(`${label}请填写64字以内的回款节点`);
    if (!decimal(p.plannedAmount) || p.plannedAmount <= 0) throw new Error(`${label}金额须大于0且最多两位小数`);
    if (typeof p.plannedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.plannedDate) || Number.isNaN(Date.parse(p.plannedDate)) || new Date(p.plannedDate).toISOString().slice(0,10) !== p.plannedDate) throw new Error(`${label}请选择有效计划日期`);
    if (p.ratio != null && (!decimal(p.ratio) || p.ratio < 0 || p.ratio > 100)) throw new Error(`${label}比例须为0至100，最多两位小数`);
    if ((p.payMethod || '').length > 32 || (p.remark || '').length > 500) throw new Error(`${label}支付方式最多32字、备注最多500字`);
    if (p.id && ids.has(p.id)) throw new Error('回款计划ID重复，请重新加载');
    if (p.id) ids.add(p.id);
    total += Math.round(p.plannedAmount * 100);
    return { ...(p.id ? { id:p.id } : {}), paymentNode:p.paymentNode.trim(), plannedAmount:p.plannedAmount, plannedDate:p.plannedDate, ...(p.ratio == null ? {} : {ratio:p.ratio}), ...(p.payMethod ? {payMethod:p.payMethod} : {}), ...(p.remark ? {remark:p.remark} : {}) };
  });
  if (plans.length && (typeof amount !== 'number' || !decimal(amount) || total > Math.round(amount * 100))) throw new Error('请填写合同金额，回款计划合计不能超过合同金额');
  return result;
}
