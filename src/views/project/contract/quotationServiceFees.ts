import { serviceFeePayload } from '/@/views/plan/serviceFee';

/** 合同调整仅提交服务内容，不能借新增服务费修改价格。 */
export function contractServiceFeePayload(rows: Recordable[]) {
  return rows.map(row => {
    if (!row.id && !row.serviceFeeId) throw new Error('新增服务费请从基础库选择');
    return serviceFeePayload(row, { structure: false, cost: false, price: false });
  });
}

/** 新增行价格未由暂存接口回显，预览不使用基础库价格冒充调整稿价格。 */
export function contractServiceFeeRows(rows: Recordable[]) {
  return rows.map((row, index) => ({ ...row, _key: row._key || row.id || `contract-fee:${index}`,
    ...(!row.id ? { costPrice: null, markupRate: null, guidePrice: null, costAmount: null, guideAmount: null } : {}),
  }));
}
