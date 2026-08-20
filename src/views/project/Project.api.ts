import { defHttp } from '/@/utils/http/axios';

enum Api {
  // 项目管理(主项目 + 分期 合并行)
  list = '/project/project/projectPeriodList',
  detail = '/project/project/projectPeriodDetail',
  addProjectPeriod = '/project/project/addProjectPeriod',
  editProjectPeriod = '/project/project/editProjectPeriod',
  deleteProjectPeriod = '/project/project/deleteProjectPeriod',
  // 项目分期(期项目 独立 CRUD / 模糊搜索)
  periodList = '/project/period/list',
  periodAdd = '/project/period/add',
  periodEdit = '/project/period/edit',
  periodSearch = '/project/period/searchByName',
  // 客户信息(甲方)
  customerList = '/project/customer/list',
  // 主项目列表(创建项目时选择所属主项目)
  mainProjectList = '/project/project/list',
  // 项目分期状态流转(生命周期推进)
  start = '/project/period/start',
  debugComplete = '/project/period/debugComplete',
  implementComplete = '/project/period/implementComplete',
  internalAccept = '/project/period/internalAccept',
  internalAcceptComplete = '/project/period/internalAcceptComplete',
  accept = '/project/period/accept',
  acceptComplete = '/project/period/acceptComplete',
  warranty = '/project/period/warranty',
  complete = '/project/period/complete',
  close = '/project/period/close',
}

/**
 * 项目管理-分页列表(主项目+分期 合并行)
 * @param params 搜索条件 + 分页
 */
export const projectList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 项目详情(新增页详情, 主项目+分期合并字段)
 * @param params { periodId }
 */
export const projectDetail = (params) => defHttp.get({ url: Api.detail, params });

/**
 * 新增主项目及分期
 */
export const addProject = (params) =>
  defHttp.post({ url: Api.addProjectPeriod, params }, { successMessageMode: 'success' });

/**
 * 修改主项目及分期
 */
export const editProject = (params) =>
  defHttp.post({ url: Api.editProjectPeriod, params }, { successMessageMode: 'success' });

/**
 * 删除分期
 * @param params { periodId }
 */
export const deleteProject = (params) =>
  defHttp.delete(
    { url: Api.deleteProjectPeriod, params },
    { joinParamsToUrl: true, successMessageMode: 'success' }
  );

/**
 * 新增分期(挂到已有主项目下)
 * @param params { projectId, periodName, ... }
 */
export const addPeriod = (params) =>
  defHttp.post({ url: Api.periodAdd, params }, { successMessageMode: 'success' });

/**
 * 编辑分期
 */
export const editPeriod = (params) =>
  defHttp.post({ url: Api.periodEdit, params }, { successMessageMode: 'success' });

/**
 * 客户信息列表(甲方选择带出)
 */
export const getCustomerList = (params?) => defHttp.get({ url: Api.customerList, params });

/**
 * 主项目列表(创建项目时选择所属主项目)
 */
export const getMainProjectList = (params?) => defHttp.get({ url: Api.mainProjectList, params });

/**
 * 分期/项目名称模糊搜索(领料/还料/采购选项目单号↔名称)
 */
export const searchPeriod = (params?) => defHttp.get({ url: Api.periodSearch, params });

/**
 * 编辑计划方案(计划页整体提交, 对齐后端 project_plan 实体)
 */
export const addPlan = (params) =>
  defHttp.post({ url: '/project/plan/add', params }, { successMessageMode: 'success' });

/**
 * 状态流转推进(统一状态变更接口, 前端传 periodId + status)
 * ⚠️ 后端将提供 /project/period/status; 当前未就绪时调用会报错(先画页面)
 * @param params { periodId, status }
 */
export const changePeriodStatus = (params) =>
  defHttp.post({ url: '/project/period/status', params }, { successMessageMode: 'success' });

/**
 * 状态流转推进(旧: 每个动作对应后端独立的流转接口, 保留兼容)
 * @param action 流转动作 key(Project.data.ts statusFlow 中的 api 值)
 * @param params { id/periodId }
 */
export const periodFlow = (action: string, params) =>
  defHttp.post({ url: Api[action], params }, { successMessageMode: 'success' });
