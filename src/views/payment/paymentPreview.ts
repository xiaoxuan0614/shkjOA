/** 仅展示的确定性样例，不代表真实合同、日期或收款事实。 */
export function makePaymentPreview(period: Record<string, any>) {
  const periodId = String(period.periodId || '');
  let seed = 0;
  for (const char of periodId) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const scenario = seed % 3;
  const amount = (10 + seed % 40) * 10000;
  const projectLabel = [period.projectName, period.periodName].filter(Boolean).join('-') || '未命名分期';
  const records = ['预付款', '到货款', '验收款', '质保金'].map((type, index) => {
    const planAmount = amount * [0.3, 0.3, 0.3, 0.1][index];
    const paidAmount = scenario === 2 ? planAmount : scenario === 1 ? (index === 0 ? planAmount : index === 1 ? planAmount / 2 : 0) : 0;
    return {
      id: `preview-${periodId}-${index}`, type, planAmount, paidAmount,
      unpaidAmount: planAmount - paidAmount,
      planDate: ['2026-09-01', '2026-10-01', '2026-11-01', '2027-11-01'][index],
      detail: paidAmount === planAmount ? '模拟：本节点已全部回款' : paidAmount ? '模拟：本节点部分回款' : '模拟：等待回款',
      payments: paidAmount ? [{ id: `initial-${index}`, date: '2026-10-01', amount: paidAmount, remark: '模拟历史回款' }] : [],
    };
  });
  const receivedAmount = records.reduce((sum, item) => sum + item.paidAmount, 0);
  return {
    id: `preview-${periodId}`, periodId, projectLabel,
    contractNo: `MOCK-${periodId}`, contractName: `${projectLabel}（模拟合同）`,
    contractAmount: amount, receivedAmount, unpaidAmount: amount - receivedAmount,
    customerName: period.customerName || '模拟甲方', owner: period.projectManagerName || '模拟负责人',
    contractType: '模拟项目合同', signDate: '2026-09-01',
    paymentStatus: ['未回款', '部分回款', '已回款'][scenario], records,
    invoices: [] as { id: string; type: string; number: string; amount: number; date: string; remark: string; files: File[] }[],
  };
}

export type PaymentPreviewRecord = ReturnType<typeof makePaymentPreview>;
export function recordPreviewPayment(row: PaymentPreviewRecord, planId: string, amount: number, date: string, remark: string) {
  const plan = row.records.find((item) => item.id === planId);
  const cents = Math.round(amount * 100);
  if (!plan || !Number.isFinite(amount) || cents <= 0 || Math.abs(amount * 100 - cents) > 0.00001) throw new Error('请输入大于0且最多两位小数的回款金额');
  if (cents > Math.round(plan.unpaidAmount * 100)) throw new Error('本次回款金额不能超过该回款项剩余应回款金额');
  if (!date) throw new Error('请选择回款日期');
  plan.payments.push({ id: `payment-${plan.payments.length}`, date, amount: cents / 100, remark });
  plan.paidAmount = (Math.round(plan.paidAmount * 100) + cents) / 100;
  plan.unpaidAmount = (Math.round(plan.planAmount * 100) - Math.round(plan.paidAmount * 100)) / 100;
  row.receivedAmount = row.records.reduce((sum, item) => sum + Math.round(item.paidAmount * 100), 0) / 100;
  row.unpaidAmount = (Math.round(row.contractAmount * 100) - Math.round(row.receivedAmount * 100)) / 100;
  row.paymentStatus = row.unpaidAmount === 0 ? '已回款' : row.receivedAmount ? '部分回款' : '未回款';
}
