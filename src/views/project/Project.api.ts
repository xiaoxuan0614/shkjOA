import { uploadDocument, uploadProjectDocument } from '/@/utils/documentUpload';
import { defHttp } from '/@/utils/http/axios';
import { ContentTypeEnum } from '/@/enums/httpEnum';
import { normalizeProjectListParams } from './projectListFilters';

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
  warranty = '/project/period/warranty',
  complete = '/project/period/complete',
  close = '/project/period/close',
  arrivalStatus = '/project/period/arrivalStatus',
  // 项目补料申请
  materialApplyList = '/project/materialApply/list',
  materialApplyDetail = '/project/materialApply/queryById',
  materialApplyAddBatch = '/project/materialApply/addBatch',
  materialApplyApprove = '/project/materialApply/approve',
  materialApplyApproveBatch = '/project/materialApply/approveBatch',
  // 实施计划工序完成
  processDetail = '/project/process/detail',
  processStatus = '/project/process/status',
}

/**
 * 项目管理-分页列表(主项目+分期 合并行)
 * @param params 搜索条件 + 分页
 */
export const projectList = (params) => defHttp.get({ url: Api.list, params: normalizeProjectListParams(params) });

/**
 * 项目详情(新增页详情, 主项目+分期合并字段)
 * @param params { periodId }
 */
export const projectDetail = (params, quiet = false) =>
  defHttp.get({ url: Api.detail, params }, quiet ? { successMessageMode: 'none', errorMessageMode: 'none' } : undefined);

/** 新增主项目及分期：先公共上传附件，再以 JSON 保存返回路径。 */
export const addProject = async (data: Recordable, attachment?: File) => {
  const params = { ...data };
  // 新增前尚无分期 ID，使用公共上传接口约定的 project 业务目录。
  if (attachment) params.attachmentFileId = (await uploadDocument(attachment, 'project')).path;
  return defHttp.post({ url: Api.addProjectPeriod, params, headers: { 'Content-Type': ContentTypeEnum.JSON } }, { successMessageMode: 'success' });
};

/**
 * 修改主项目及分期；未传 attachment 时后端保留原附件。
 */
export const editProject = async (data: Recordable, attachment?: File) => {
  const params = { ...data };
  if (attachment) params.attachmentFileId = (await uploadProjectDocument(attachment, String(data.periodId))).path;
  return defHttp.post({ url: Api.editProjectPeriod, params, headers: { 'Content-Type': ContentTypeEnum.JSON } }, { successMessageMode: 'success' });
};

/**
 * 删除分期
 * @param params { periodId }
 */
export const deleteProject = (params) =>
  defHttp.delete({ url: Api.deleteProjectPeriod, params }, { joinParamsToUrl: true, successMessageMode: 'success' });

/**
 * 新增分期(挂到已有主项目下)
 * @param params { projectId, periodName, ... }
 */
export const addPeriod = (params) => defHttp.post({ url: Api.periodAdd, params }, { successMessageMode: 'success' });

/**
 * 编辑分期
 */
export const editPeriod = (params) => defHttp.post({ url: Api.periodEdit, params }, { successMessageMode: 'success' });

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
export const addPlan = (params) => defHttp.post({ url: '/project/plan/add', params }, { successMessageMode: 'success' });

/**
 * 状态流转推进(统一状态变更接口, 前端传 periodId + status)
 * ⚠️ 后端将提供 /project/period/status; 当前未就绪时调用会报错(先画页面)
 * @param params { periodId, status }
 */
export const changePeriodStatus = (params) => defHttp.post({ url: '/project/period/status', params }, { successMessageMode: 'none' });

/**
 * 确认项目分期到货。
 * 后端根据确认日期和合同中的到货款回款周期生成计划回款日期，前端只提交到货状态。
 * @param params { periodId, arrivalStatus: 0 | 1 }
 */
export const changeArrivalStatus = (params) => defHttp.post({ url: Api.arrivalStatus, params }, { successMessageMode: 'none' });

/** 按分期读取整份实施计划及全部有效工序。 */
export const getProjectProcessDetail = (params: { periodId: string }) => defHttp.get({ url: Api.processDetail, params });

/** 更新单道工序状态；最后一道完成后的项目状态由后端自动推进。 */
export const changeProjectProcessStatus = (params: { processId: string; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' }) =>
  defHttp.post({ url: Api.processStatus, params }, { successMessageMode: 'none' });

/**
 * 状态流转推进(旧: 每个动作对应后端独立的流转接口, 保留兼容)
 * @param action 流转动作 key(Project.data.ts statusFlow 中的 api 值)
 * @param params { id/periodId }
 */
export const periodFlow = (action: string, params) => defHttp.post({ url: Api[action], params }, { successMessageMode: 'success' });

/** 按项目分期查询补料申请单。 */
export const getProjectMaterialApplies = (params) => defHttp.get({ url: Api.materialApplyList, params });

/** 查询补料申请单详情（含 items 物料明细）。 */
export const getProjectMaterialApplyDetail = (params) => defHttp.get({ url: Api.materialApplyDetail, params });

/** 提交一张补料申请单；申请信息放 apply，物料明细放 items。 */
export const addProjectMaterialApplies = (params) => defHttp.post({ url: Api.materialApplyAddBatch, params }, { successMessageMode: 'none' });

/** 审批一张补料申请单；id 为申请单 ID，驳回时 approvalReason 必填。 */
export const approveProjectMaterialApply = (params) => defHttp.post({ url: Api.materialApplyApprove, params }, { successMessageMode: 'none' });

/** 批量审批多张补料申请单；ids 为申请单 ID。 */
export const approveProjectMaterialAppliesBatch = (params) =>
  defHttp.post({ url: Api.materialApplyApproveBatch, params }, { successMessageMode: 'none' });
