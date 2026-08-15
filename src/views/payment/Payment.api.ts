import { defHttp } from '/@/utils/http/axios';

enum Api {
  list = '/payment/contract/list',
  detail = '/payment/contract/detail',
  save = '/payment/contract/save',
  paybackList = '/payment/payback/list',
  paybackSave = '/payment/payback/save',
}

/**
 * 回款管理 - 合同分页列表
 */
export const contractList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 合同详情(合同信息 + 回款计划)
 * @param params { id }
 */
export const contractDetail = (params) => defHttp.get({ url: Api.detail, params });

/**
 * 保存合同(新增/编辑)
 */
export const saveContract = (params) =>
  defHttp.post({ url: Api.save, params }, { successMessageMode: 'success' });

/**
 * 合同回款计划列表
 */
export const paybackList = (params) => defHttp.get({ url: Api.paybackList, params });

/**
 * 添加回款记录
 */
export const savePayback = (params) =>
  defHttp.post({ url: Api.paybackSave, params }, { successMessageMode: 'success' });
