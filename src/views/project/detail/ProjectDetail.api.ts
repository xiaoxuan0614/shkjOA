import { defHttp } from '/@/utils/http/axios';

/**
 * 项目详情(8-tab) API
 * 各 tab 数据均为「项目分期」维度的子表(periodId 关联)
 */
enum Api {
  // 基本信息(主项目+分期合并详情)
  detail = '/project/project/projectPeriodDetail',
  // 计划方案
  plan = '/project/plan/list',
  planAdd = '/project/plan/add',
  // 项目成员
  member = '/project/member/list',
  // 实施位置
  position = '/project/location/list',
  positionAdd = '/project/location/add',
  positionDelete = '/project/location/delete',
  positionEdit = '/project/location/edit',
  // 实施记录
  implement = '/project/implementLog/list',
  implementLog = '/project/implementLog/queryById',
  // 工序(实施记录按工序)
  process = '/project/process/list',
  // 客户验收(正式验收)
  acceptance = '/project/acceptance/list',
  acceptanceAdd = '/project/acceptance/add',
  acceptanceEdit = '/project/acceptance/edit',
  acceptanceDelete = '/project/acceptance/delete',
  // 内部验收
  internalAcceptance = '/project/internalAcceptance/list',
  internalAcceptanceAdd = '/project/internalAcceptance/add',
  internalAcceptanceEdit = '/project/internalAcceptance/edit',
  internalAcceptanceDelete = '/project/internalAcceptance/delete',
  // 项目文件
  file = '/project/file/list',
  fileAdd = '/project/file/add',
  fileDelete = '/project/file/delete',
  // 用料清单
  material = '/project/materialPlan/list',
  // 项目动态(右侧时间线)
  activity = '/project/dynamic/list',
}

/**
 * 项目基本信息(详情页头部 + 基本信息 tab 共用; 按分期ID)
 * @param params { periodId }
 */
export const getProjectBasic = (params) => defHttp.get({ url: Api.detail, params });

/**
 * 计划方案 tab(分页)
 * @param params { periodId, pageNo, pageSize }
 */
export const getPlan = (params) => defHttp.get({ url: Api.plan, params });

/**
 * 项目成员 tab
 */
export const getMembers = (params) => defHttp.get({ url: Api.member, params });

/**
 * 实施位置 tab
 */
export const getPositions = (params) => defHttp.get({ url: Api.position, params });

/**
 * 新增实施位置
 */
export const addPosition = (params) =>
  defHttp.post({ url: Api.positionAdd, params }, { successMessageMode: 'success' });

/**
 * 编辑实施位置
 */
export const editPosition = (params) =>
  defHttp.post({ url: Api.positionEdit, params }, { successMessageMode: 'success' });

/**
 * 删除实施位置
 * @param params { id }
 */
export const deletePosition = (params) =>
  defHttp.delete(
    { url: Api.positionDelete, params },
    { joinParamsToUrl: true, successMessageMode: 'success' }
  );

/**
 * 实施记录 tab(实施记录=实施日志, 按 periodId)
 */
export const getImplementRecords = (params) => defHttp.get({ url: Api.implement, params });

/**
 * 实施记录-查看日志详情
 * @param params { id }
 */
export const getImplementLog = (params) => defHttp.get({ url: Api.implementLog, params });

/**
 * 客户验收记录 tab(分页)
 */
export const getAcceptance = (params) => defHttp.get({ url: Api.acceptance, params });

/**
 * 新增客户验收
 */
export const addAcceptance = (params) =>
  defHttp.post({ url: Api.acceptanceAdd, params }, { successMessageMode: 'success' });

/**
 * 编辑客户验收
 */
export const editAcceptance = (params) =>
  defHttp.post({ url: Api.acceptanceEdit, params }, { successMessageMode: 'success' });

/**
 * 删除客户验收
 */
export const deleteAcceptance = (params) =>
  defHttp.delete(
    { url: Api.acceptanceDelete, params },
    { joinParamsToUrl: true, successMessageMode: 'success' }
  );

/**
 * 内部验收记录(分页)
 */
export const getInternalAcceptance = (params) => defHttp.get({ url: Api.internalAcceptance, params });

/**
 * 新增内部验收
 */
export const addInternalAcceptance = (params) =>
  defHttp.post({ url: Api.internalAcceptanceAdd, params }, { successMessageMode: 'success' });

/**
 * 编辑内部验收
 */
export const editInternalAcceptance = (params) =>
  defHttp.post({ url: Api.internalAcceptanceEdit, params }, { successMessageMode: 'success' });

/**
 * 删除内部验收
 */
export const deleteInternalAcceptance = (params) =>
  defHttp.delete(
    { url: Api.internalAcceptanceDelete, params },
    { joinParamsToUrl: true, successMessageMode: 'success' }
  );

/**
 * 项目文件 tab
 */
export const getFiles = (params) => defHttp.get({ url: Api.file, params });

/**
 * 新增项目文件
 */
export const addFile = (params) =>
  defHttp.post({ url: Api.fileAdd, params }, { successMessageMode: 'success' });

/**
 * 删除项目文件
 */
export const deleteFile = (params) =>
  defHttp.delete(
    { url: Api.fileDelete, params },
    { joinParamsToUrl: true, successMessageMode: 'success' }
  );

/**
 * 用料清单 tab(项目用料计划)
 */
export const getMaterials = (params) => defHttp.get({ url: Api.material, params });

/**
 * 项目动态(右侧时间线)
 */
export const getActivities = (params) => defHttp.get({ url: Api.activity, params });
