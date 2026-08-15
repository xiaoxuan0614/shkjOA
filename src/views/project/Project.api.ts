import { defHttp } from '/@/utils/http/axios';

enum Api {
  list = '/project/list',
  detail = '/project/detail',
  add = '/project/add',
  edit = '/project/edit',
  customerList = '/project/customerList',
  mainProjectList = '/project/mainProjectList',
  planSave = '/project/plan/save',
  statusAdvance = '/project/status/advance',
}

/**
 * 项目分页列表
 * @param params 搜索条件 + 分页
 */
export const projectList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 项目详情
 * @param params { id }
 */
export const projectDetail = (params) => defHttp.get({ url: Api.detail, params });

/**
 * 新增项目
 */
export const addProject = (params) =>
  defHttp.post({ url: Api.add, params }, { successMessageMode: 'success' });

/**
 * 编辑项目
 */
export const editProject = (params) =>
  defHttp.post({ url: Api.edit, params }, { successMessageMode: 'success' });

/**
 * 客户信息列表(甲方选择带出)
 */
export const getCustomerList = (params?) => defHttp.get({ url: Api.customerList, params });

/**
 * 主项目列表(创建项目时选择所属主项目)
 */
export const getMainProjectList = (params?) => defHttp.get({ url: Api.mainProjectList, params });

/**
 * 保存计划(六标签整体提交)
 */
export const savePlan = (params) =>
  defHttp.post({ url: Api.planSave, params }, { successMessageMode: 'success' });

/**
 * 状态流转推进(按生命周期顺序推进到下一状态，不能跳步/回退)
 * @param params { id, targetStatus }
 */
export const advanceStatus = (params) =>
  defHttp.post({ url: Api.statusAdvance, params }, { successMessageMode: 'success' });
