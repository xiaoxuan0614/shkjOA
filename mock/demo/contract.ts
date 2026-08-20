import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';

/**
 * 合同管理(合同签订/审批)相关 mock 接口
 * 前缀: /jeecgboot
 * 对齐后端 /project/contract/*:
 *   GET    /project/contract/list          合同分页列表(按 periodId 过滤)
 *   POST   /project/contract/add           提交合同(status=1 待审批)
 *   POST   /project/contract/edit          修改合同(驳回后重提)
 *   POST   /project/contract/status        变更合同状态(审批: 0驳回/2已通过, approvalReason)
 */

// periodId → 合同
const contractMap: Record<string, any> = {};
let contractSeq = 1;

// 回款计划(contractItem): periodId → rows
const paybackStore: Record<string, any[]> = {};
let paybackSeq = 1;

function getContract(periodId: string) {
  return contractMap[periodId] || null;
}

export default [
  // 合同分页列表(按 periodId 过滤, 单个合同)
  {
    url: `${sysUrl}/project/contract/list`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, periodId } = query;
      const data = periodId && getContract(periodId) ? [getContract(periodId)] : Object.values(contractMap);
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
  // 提交合同(新增, status=待审批)
  {
    url: `${sysUrl}/project/contract/add`,
    timeout: 200,
    method: 'post',
    response: ({ body }) => {
      const contract = {
        ...body,
        id: `contract_${contractSeq++}`,
        status: body.status ?? 1,
        createTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      };
      contractMap[body.periodId] = contract;
      return resultSuccess(contract, { message: '提交成功' });
    },
  },
  // 修改合同(驳回后重提)
  {
    url: `${sysUrl}/project/contract/edit`,
    timeout: 200,
    method: 'post',
    response: ({ body }) => {
      const periodId = body.periodId;
      const old = getContract(periodId);
      const contract = { ...(old || {}), ...body, status: body.status ?? 1 };
      contractMap[periodId] = contract;
      return resultSuccess(contract, { message: '修改成功' });
    },
  },
  // 变更合同状态(审批)
  {
    url: `${sysUrl}/project/contract/status`,
    timeout: 200,
    method: 'post',
    response: ({ body }) => {
      const { id, status, approvalReason } = body;
      const periodId = Object.keys(contractMap).find((k) => getContract(k)?.id === id);
      if (periodId) {
        contractMap[periodId] = { ...contractMap[periodId], status, approvalReason };
      }
      return resultSuccess(null, { message: status === 2 ? '审批通过' : '已驳回' });
    },
  },
  // 回款计划(contractItem)列表
  {
    url: `${sysUrl}/project/contractItem/list`,
    timeout: 100,
    method: 'get',
    response: ({ query }) => {
      const { periodId, pageNo = 1, pageSize = 100 } = query;
      return resultPageSuccess(pageNo, pageSize, paybackStore[periodId] || []);
    },
  },
  // 回款计划(contractItem)添加/更新
  {
    url: `${sysUrl}/project/contractItem/add`,
    timeout: 100,
    method: 'post',
    response: ({ body }) => {
      const { periodId } = body;
      if (!paybackStore[periodId]) paybackStore[periodId] = [];
      if (body.id) {
        const idx = paybackStore[periodId].findIndex((i) => String(i.id) === String(body.id));
        if (idx !== -1) paybackStore[periodId][idx] = { ...paybackStore[periodId][idx], ...body };
      } else {
        paybackStore[periodId].push({ ...body, id: `payback_${paybackSeq++}` });
      }
      return resultSuccess(null, { message: '已保存' });
    },
  },
] as MockMethod[];
