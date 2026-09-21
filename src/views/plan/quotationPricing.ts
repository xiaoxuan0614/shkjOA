import Big from 'big.js';

export const hasPrice = (value: unknown) => value !== null && value !== undefined && value !== '';

/** 比例使用百分数原值，如20表示20%。 */
export function guidancePrice(cost: any, percent: any) {
  return decimalPrice(cost, '成本价').times(decimalPrice(percent, '指导比例', 4).div(100).plus(1)).round(2, Big.roundHalfUp).toFixed(2);
}

export function decimalPrice(value: any, label: string, precision = 2) {
  if (!hasPrice(value)) throw new Error(`请填写${label}`);
  let number: Big;
  try {
    number = new Big(value);
  } catch {
    throw new Error(`${label}必须为有效数字`);
  }
  // UI uses a conservative safe bound to avoid JSON number precision loss.
  if (number.lt(0) || number.gt('9999999999')) throw new Error(`${label}须在 0～9999999999 之间`);
  if (!number.eq(number.round(precision))) throw new Error(`${label}最多 ${precision} 位小数`);
  return number;
}

export function finalFromRate(basePrice: any, markupRate: any) {
  return decimalPrice(basePrice, '底价')
    .times(decimalPrice(markupRate, '提价比例', 4).plus(1))
    .round(2, Big.roundHalfUp)
    .toFixed(2);
}

export function rateFromFinal(basePrice: any, finalPrice: any) {
  const base = decimalPrice(basePrice, '底价');
  const final = decimalPrice(finalPrice, '终价');
  if (base.eq(0)) {
    if (!final.eq(0)) throw new Error('底价为 0 时终价只能为 0，无法反算提价比例');
    return '0.0000';
  }
  if (final.lt(base)) throw new Error('终价不能低于底价');
  return final.div(base).minus(1).round(4, Big.roundHalfUp).toFixed(4);
}

/** 价格字段按输入原值保存；不强制底价、比例、终价间的公式关系。 */
export function quotationPricePayload(row: any, required = false) {
  const result: Record<string, number> = {};
  for (const [key, label, precision] of [
    ['basePrice', '成本价', 2],
    ['markupRate', '提价比例', 4],
    ['finalPrice', '终价', 2],
  ] as const) {
    if (required || hasPrice(row[key])) result[key] = Number(decimalPrice(row[key], label, precision));
  }
  return result;
}

export function quotationSnapshot(row: any) {
  return JSON.stringify(
    ['id', 'materialId', 'unitId', 'quantity', 'remark', 'basePrice', 'markupRate', 'finalPrice'].map((key) => {
      const value = row[key];
      if (['quantity', 'basePrice', 'markupRate', 'finalPrice'].includes(key) && hasPrice(value)) return new Big(value).toString();
      return value == null ? '' : String(value);
    })
  );
}
