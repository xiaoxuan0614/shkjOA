import { defHttp } from '/@/utils/http/axios';

enum Api {
  list = '/plan/project/list',
  detail = '/plan/detail',
  materialList = '/plan/material/list',
  positionList = '/plan/position/list',
  savePlan = '/plan/save',
}

/**
 * 计划方案管理 - 项目分页列表
 */
export const planProjectList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 方案详情(项目信息/实施计划/用料计划/位置信息/回款计划 五合一)
 * @param params { id }
 */
export const planDetail = (params) => defHttp.get({ url: Api.detail, params });

/**
 * 用料计划列表
 */
export const getPlanMaterialList = (params) => defHttp.get({ url: Api.materialList, params });

/**
 * 实施位置列表
 */
export const getPlanPositionList = (params) => defHttp.get({ url: Api.positionList, params });

/**
 * 保存方案(各 tab 编辑后整体提交)
 */
export const savePlan = (params) =>
  defHttp.post({ url: Api.savePlan, params }, { successMessageMode: 'success' });
