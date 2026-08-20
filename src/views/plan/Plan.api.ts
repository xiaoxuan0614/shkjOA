import { defHttp } from '/@/utils/http/axios';

/**
 * 计划方案管理 - 对接后端 /project/*(项目域)
 */
enum Api {
  // 项目/分期列表(计划方案入口)
  list = '/project/project/projectPeriodList',
  // 计划方案列表(按 periodId)
  detail = '/project/plan/list',
  // 用料计划
  materialList = '/project/materialPlan/list',
  // 实施位置
  positionList = '/project/location/list',
  // 保存计划方案
  savePlan = '/project/plan/add',
}

/**
 * 项目/分期分页列表(计划方案入口)
 */
export const planProjectList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 计划方案列表
 * @param params { periodId, pageNo, pageSize }
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
 * 保存计划方案
 */
export const savePlan = (params) =>
  defHttp.post({ url: Api.savePlan, params }, { successMessageMode: 'success' });
