import { defHttp } from '/@/utils/http/axios';
import { contractDetail } from '/@/views/payment/Payment.api';

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
  memberAddBatch = '/project/member/addBatch',
  memberOutsource = '/project/memberOutsource/list',
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
  // 内部/外部验收统一入口；acceptType=INTERNAL/CUSTOMER
  acceptance = '/project/acceptance/list',
  acceptanceEdit = '/project/acceptance/edit',
  // 验收流程（首次实施与返工复验共用）
  acceptanceStart = '/project/acceptance/start',
  acceptanceComplete = '/project/acceptance/complete',
  // 返工申请、审批与本轮额外领料统计
  reworkList = '/project/rework/list',
  reworkDetail = '/project/rework/queryById',
  reworkAdd = '/project/rework/add',
  reworkEdit = '/project/rework/edit',
  reworkSubmit = '/project/rework/submit',
  reworkWithdraw = '/project/rework/withdraw',
  reworkApprove = '/project/rework/approve',
  reworkMaterials = '/project/rework/materials',
  // 项目文件
  file = '/project/file/list',
  fileAddBatch = '/project/file/addBatch',
  fileDeleteBatch = '/project/file/deleteBatch',
  // 计划用料清单（补料预览/计划关联）
  material = '/project/materialPlan/list',
  // 项目物料总账（用料统计）
  materialAccount = '/project/materialAccount/page',
  // 项目动态(右侧时间线)
  activity = '/project/dynamic/list',
}

/**
 * 项目基本信息(详情页头部 + 基本信息 tab 共用; 按分期ID)
 * @param params { periodId }
 */
export const getProjectBasic = (params) => defHttp.get({ url: Api.detail, params });

/**
 * 合同信息 tab；按项目分期 ID 返回合同、两类附件和全部回款计划。
 * @param params { periodId }
 */
export const getContractDetail = (params) => contractDetail(params, true);

/**
 * 计划方案 tab(分页)
 * @param params { periodId, pageNo, pageSize }
 */
export const getPlan = (params, quiet = false) =>
  defHttp.get({ url: Api.plan, params }, quiet ? { successMessageMode: 'none', errorMessageMode: 'none' } : undefined);

/**
 * 项目成员 tab
 */
export const getMembers = (params) => defHttp.get({ url: Api.member, params }, { successMessageMode: 'none', errorMessageMode: 'none' });

/**
 * 邀请项目成员；同一成员的多个角色在一条 memberRole 中以英文逗号连接。
 * @param params { periodId, records: [{ userId, memberRole, remark? }] }
 */
export const inviteProjectMembers = (params) =>
  defHttp.post({ url: Api.memberAddBatch, params }, { successMessageMode: 'none', errorMessageMode: 'none' });

/**
 * 项目外协人员配置；按项目分期查询，与参与人员分开显示。
 * @param params { periodId, pageNo?, pageSize? }
 */
export const getMemberOutsources = (params) =>
  defHttp.get({ url: Api.memberOutsource, params }, { successMessageMode: 'none', errorMessageMode: 'none' });

/**
 * 实施位置 tab
 */
export const getPositions = (params) => defHttp.get({ url: Api.position, params });

/**
 * 新增实施位置
 */
export const addPosition = (params) => defHttp.post({ url: Api.positionAdd, params }, { successMessageMode: 'success' });

/**
 * 编辑实施位置
 */
export const editPosition = (params) => defHttp.post({ url: Api.positionEdit, params }, { successMessageMode: 'success' });

/**
 * 删除实施位置
 * @param params { id }
 */
export const deletePosition = (params) =>
  defHttp.delete({ url: Api.positionDelete, params }, { joinParamsToUrl: true, successMessageMode: 'success' });

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
 * 内部/外部验收记录 tab(分页)，acceptType 显式传 INTERNAL 或 CUSTOMER。
 */
export const getAcceptance = (params) => defHttp.get({ url: Api.acceptance, params });

/**
 * 保存当前内部/外部验收记录资料；记录由 submit 接口创建，不允许前端新增或删除。
 */
export const editAcceptance = (params) => defHttp.post({ url: Api.acceptanceEdit, params }, { successMessageMode: 'none', errorMessageMode: 'none' });

const quietFeedback = { successMessageMode: 'none', errorMessageMode: 'none' } as const;

/** 内部/外部验收开始；acceptType 为 INTERNAL 或 CUSTOMER。 */
export const startProjectAcceptance = (params: {
  periodId: string;
  acceptType: 'INTERNAL' | 'CUSTOMER';
  acceptStartDate?: string;
  reworkId?: string;
}) => defHttp.post({ url: Api.acceptanceStart, params }, quietFeedback);

/** 完成内部/外部验收；FAILED 时 remark 必填。 */
export const completeProjectAcceptance = (params: {
  acceptanceId: string;
  periodId: string;
  acceptType: 'INTERNAL' | 'CUSTOMER';
  acceptEndDate?: string;
  result: 'PASSED' | 'FAILED';
  acceptUnitLeader?: string;
  acceptUnitPhone?: string;
  completionReportFileId?: string;
  acceptanceFormFileId?: string;
  remark?: string;
  reworkId?: string;
}) => defHttp.post({ url: Api.acceptanceComplete, params }, quietFeedback);

/** 按项目分期查询全部返工轮次。 */
export const getProjectReworks = (params: { periodId: string; pageNo?: number; pageSize?: number }) =>
  defHttp.get({ url: Api.reworkList, params }, quietFeedback);

/** 查询返工单详情。 */
export const getProjectReworkDetail = (params: { id: string }) => defHttp.get({ url: Api.reworkDetail, params }, quietFeedback);

/** 保存返工草稿；每张返工单只提交一个 process 工序对象。 */
export const addProjectRework = (params: Recordable) => defHttp.post({ url: Api.reworkAdd, params }, quietFeedback);

/** 编辑返工方案。 */
export const editProjectRework = (params: Recordable) => defHttp.post({ url: Api.reworkEdit, params }, quietFeedback);

/** 提交、撤回返工申请；version 取详情最新值。 */
export const submitProjectRework = (params: { reworkId: string; version: number }) => defHttp.post({ url: Api.reworkSubmit, params }, quietFeedback);
export const withdrawProjectRework = (params: { reworkId: string; version: number }) =>
  defHttp.post({ url: Api.reworkWithdraw, params }, quietFeedback);

/** 审批返工申请。 */
export const approveProjectRework = (params: { reworkId: string; version: number; approvalResult: 'AGREE' | 'REJECT'; approvalComment?: string }) =>
  defHttp.post({ url: Api.reworkApprove, params }, quietFeedback);

/** 当前返工轮次的额外领料计划、实际出库、消耗和剩余可申请数量。 */
export const getProjectReworkMaterials = (params: { reworkId: string }) => defHttp.get({ url: Api.reworkMaterials, params }, quietFeedback);

/**
 * 项目文件列表；periodId 必传。
 * @param params { periodId, pageNo?, pageSize? }
 */
export const getFiles = (params) => defHttp.get({ url: Api.file, params });

/**
 * 批量新增项目文件；periodId 位于顶层，明细不重复传 periodId。
 * @param params { periodId, records: [{ fileType?, fileId?, fileName?, remark? }] }
 */
export const addProjectFiles = (params) => defHttp.post({ url: Api.fileAddBatch, params }, { successMessageMode: 'none', errorMessageMode: 'none' });

/**
 * 删除项目文件
 */
export const deleteFile = (params) => defHttp.delete({ url: Api.fileDeleteBatch, params }, { joinParamsToUrl: true, successMessageMode: 'success' });

/**
 * 项目用料计划；保留给补料预览及需要 materialPlanId 的计划关联场景。
 */
export const getMaterials = (params) => defHttp.get({ url: Api.material, params });

/**
 * 项目物料总账；按分期分页统计计划、申请、出库、消耗、归还处置及成本。
 * @param params { periodId, materialId?, keyword?, pageNo?, pageSize? }
 */
export const getMaterialAccounts = (params) => defHttp.get({ url: Api.materialAccount, params }, quietFeedback);

/**
 * 项目动态(右侧时间线)
 */
export const getActivities = (params) => defHttp.get({ url: Api.activity, params });

/** 项目经理申请免整改复验；来源验收类型由后端确定。 */
export const submitAcceptanceRecheck = (params: { periodId: string; sourceAcceptanceId: string; reason: string }) =>
  defHttp.post({ url: '/project/acceptance/submit', params }, quietFeedback);
