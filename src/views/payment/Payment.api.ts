import { defHttp } from '/@/utils/http/axios';

/**
 * 回款管理 - 对接后端 /project/contract/*(合同管理)
 * ⚠️ 回款计划(paybackPlan)后端暂无独立接口, 暂保留占位; 已回款金额走 contract.receivedAmount
 */
enum Api {
  list = '/project/contract/list',
  detail = '/project/contract/queryById',
  add = '/project/contract/add',
  edit = '/project/contract/edit',
  status = '/project/contract/status',
  delete = '/project/contract/delete',
  paybackList = '/project/contractItem/list',
  paybackSave = '/project/contractItem/add',
}

/**
 * 合同分页列表
 */
export const contractList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 合同详情
 * @param params { id }
 */
export const contractDetail = (params) => defHttp.get({ url: Api.detail, params });

/**
 * 保存合同(新增/编辑)
 */
export const saveContract = (params) => {
  if (params.id) {
    return defHttp.post({ url: Api.edit, params }, { successMessageMode: 'success' });
  }
  return defHttp.post({ url: Api.add, params }, { successMessageMode: 'success' });
};

/**
 * 合同状态变更(审批: 通过/驳回)
 * @param params { id, status, approvalReason? } status: 0驳回 / 2已通过
 */
export const changeContractStatus = (params) =>
  defHttp.post({ url: Api.status, params }, { successMessageMode: 'success' });

/**
 * 合同回款计划列表(暂用合同明细分页, 待后端回款计划接口)
 */
export const paybackList = (params) => defHttp.get({ url: Api.paybackList, params });

/**
 * 添加回款记录(占位)
 */
export const savePayback = (params) =>
  defHttp.post({ url: Api.paybackSave, params }, { successMessageMode: 'success' });
