import Big from 'big.js';

export const snapshotQuotationHeaders = ['序号', '名称', '品牌', '型号', '规格参数', '数量', '单位', '单价（元）', '小计（元）', '备注'];
export const snapshotQuotationWidths = [6, 24, 18, 24, 62, 10, 8, 16, 18, 18];

/** 合同无价格快照：物料与服务独立列表合并展示，白名单隔离所有金额字段。 */
export function contractSnapshotRows(snapshot: Record<string, any> | null | undefined) {
  const objects = (value: unknown): Record<string, any>[] => Array.isArray(value)
    ? value.filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [];
  return [
    ...objects(snapshot?.records).map(row => ({ materialCategory: row.materialCategory, materialName: row.materialName,
      brand: row.brand, model: row.model, quantity: row.quantity, unit: row.unit, remark: row.remark, description: '' })),
    ...objects(snapshot?.serviceFees).map(row => ({ materialCategory: '服务费', materialName: row.name,
      brand: '', model: '', quantity: row.quantity, unit: row.unit, remark: row.remark, description: row.description })),
  ];
}

function decimal(value: unknown): Big | null {
  if (value == null || String(value).trim() === '') return null;
  try { const number = new Big(String(value)); return number.gte(0) ? number : null; } catch { return null; }
}
export function snapshotMoney(value: unknown) {
  return decimal(value)?.toFixed(2) ?? '—';
}

/** 仅组装详情接口已脱敏的快照，不补查基础库、报价明细或导出接口。 */
export function quotationSnapshotPreview(quotation: Record<string, any> | null | undefined) {
  const materials = Array.isArray(quotation?.items) ? quotation.items : [];
  const fees = Array.isArray(quotation?.serviceFees) ? quotation.serviceFees : [];
  const completeLists = Array.isArray(quotation?.items) && Array.isArray(quotation?.serviceFees);
  let validRows = true;
  const rows = [...materials.map(item => ({ item, fee: false })), ...fees.map(item => ({ item, fee: true }))].flatMap(({ item, fee }) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { validRows = false; return []; }
    const price = fee ? item.guidePrice : item.finalPrice;
    const quantity = decimal(item.quantity);
    const unitPrice = decimal(price);
    // 服务费若明确返回金额（包括null），保持快照原值；仅缺字段时由可见单价数量计算。
    const amount = fee && Object.prototype.hasOwnProperty.call(item, 'guideAmount')
      ? decimal(item.guideAmount)?.toFixed(2) ?? null
      : quantity && unitPrice ? quantity.times(unitPrice).round(2, Big.roundHalfUp).toFixed(2) : null;
    return [{ name: fee ? item.name : item.materialName, brand: fee ? '' : item.brand, model: fee ? '' : item.model,
      parameters: fee ? item.description : item.specificationParams, quantity: item.quantity, unit: item.unit,
      price, amount, remark: item.remark }];
  });
  const complete = completeLists && validRows && rows.every(row => row.amount !== null);
  return { title: quotation?.candidateName || '报价单快照', rows, complete,
    total: complete && rows.length ? rows.reduce((sum, row) => sum.plus(row.amount!), new Big(0)).toFixed(2) : null };
}
