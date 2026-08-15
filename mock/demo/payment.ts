import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';

/**
 * 回款管理 mock 接口
 * 前缀: /jeecgboot
 * 接口:
 *   GET /payment/contract/list      合同分页列表
 *   GET /payment/contract/detail    合同详情
 *   POST /payment/contract/save     保存合同
 *   GET /payment/payback/list       合同回款计划列表
 *   POST /payment/payback/save      添加回款
 */

// 合同类型
const contractTypes = ['项目合同', '贸易合同', '维保合同', '维修合同'];

// 回款类型
const paybackTypes = ['预付款', '到货款', '验收款', '质保金', '尾款'];

// 生成合同列表
function createContractList(count = 10) {
  return Array.from({ length: count }).map((_, i) => {
    const idx = i + 1;
    const amount = idx === 1 ? 100000 : 20000 + (idx % 3) * 10000;
    const paid = amount === 100000 ? 50000 : 10000 + (idx % 2) * 10000;
    return {
      id: idx,
      contractNo: `HT0000${String(idx).padStart(1, '0')}`,
      contractType: contractTypes[idx % contractTypes.length],
      customerName: '天津客户公司',
      owner: '张三',
      signDate: '2025-10-10',
      projectNo: idx % 2 === 0 ? '-' : `XM0000${idx % 3 + 1}`,
      contractAmount: amount,
      paidAmount: paid,
      unpaidAmount: amount - paid,
    };
  });
}

// 用 let 以便 mock 接口能写入
let contractList = createContractList(10);

// 合同详情(含回款计划)
function buildContractDetail(id: number) {
  const contract = contractList.find((c) => String(c.id) === String(id)) || contractList[0];
  return {
    ...contract,
    projectStatus: '质保中',
    contact: '李经理',
    phone: '1231231234567',
    paybackPlan: [
      { seq: 1, type: '尾款', planAmount: 50000, paidAmount: 20000, unpaidAmount: 30000, planDate: '2025-10-10', detail: '回款日期 2025-10-10 回款金额 10000 回款说明说明说明' },
      { seq: 2, type: '验收款', planAmount: 50000, paidAmount: 40000, unpaidAmount: 10000, planDate: '2025-10-10', detail: '回款日期 2025-10-10 回款金额 10000 回款说明说明说明' },
      { seq: 3, type: '质保金', planAmount: 5000, paidAmount: 5000, unpaidAmount: 0, planDate: '2025-10-10', detail: '回款日期 2025-10-10 回款金额 2000 回款说明说明说明' },
      { seq: 4, type: '到货款', planAmount: 3000, paidAmount: 1000, unpaidAmount: 2000, planDate: '2025-10-10', detail: '回款日期 2025-10-02 回款金额 10000 回款说明说明说明' },
      { seq: 5, type: '预付款', planAmount: 1000, paidAmount: 1000, unpaidAmount: 0, planDate: '2025-10-10', detail: '回款日期 2025-10-01 回款金额 10000 回款说明说明说明' },
    ],
  };
}

export default [
  {
    url: `${sysUrl}/payment/contract/list`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, contractType, customerName, signDate_begin, signDate_end } = query;
      let data = contractList;
      if (contractType) data = data.filter((c) => c.contractType === contractType);
      if (customerName) data = data.filter((c) => c.customerName.indexOf(customerName) !== -1);
      if (signDate_begin && signDate_end) data = data.filter((c) => c.signDate >= signDate_begin && c.signDate <= signDate_end);
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
  {
    url: `${sysUrl}/payment/contract/detail`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => resultSuccess(buildContractDetail(Number(query.id) || 1)),
  },
  {
    url: `${sysUrl}/payment/contract/save`,
    timeout: 300,
    method: 'post',
    response: ({ body }) => {
      if (body.id) {
        const idx = contractList.findIndex((c) => String(c.id) === String(body.id));
        if (idx !== -1) contractList[idx] = { ...contractList[idx], ...body };
      } else {
        contractList.unshift({
          ...body,
          id: contractList.length + 1,
          contractNo: `HT${String(100000 + contractList.length + 1)}`,
          paidAmount: 0,
          unpaidAmount: body.contractAmount || 0,
        });
      }
      return resultSuccess(null, { message: '保存成功' });
    },
  },
  {
    url: `${sysUrl}/payment/payback/list`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const detail = buildContractDetail(Number(query.contractId) || 1);
      return resultSuccess(detail.paybackPlan || []);
    },
  },
  {
    url: `${sysUrl}/payment/payback/save`,
    timeout: 300,
    method: 'post',
    response: () => resultSuccess(null, { message: '添加回款成功' }),
  },
] as MockMethod[];
