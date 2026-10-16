import type { FinanceEntry, ReceiptPlan } from './Receipt.api';

// 仅分组当前页真实回款；未匹配到计划的历史记录也保留，不生成占位行。
export function groupReceiptRows(receipts: FinanceEntry[], plans: ReceiptPlan[]) {
  const groups = new Map<string, FinanceEntry[]>();
  for (const receipt of receipts) {
    const key = receipt.paymentRecordId || receipt.id;
    const rows = groups.get(key) || [];
    rows.push(receipt);
    groups.set(key, rows);
  }
  return Array.from(groups.entries()).flatMap(([key, rows]) => {
    const plan = plans.find(item => item.id === key);
    return rows.map((receipt, index) => ({
      ...plan,
      ...receipt,
      rowKey: receipt.id,
      span: index === 0 ? rows.length : 0,
    }));
  });
}
