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
  positionAddBatch = '/project/location/addBatch',
  positionDeleteBatch = '/project/location/deleteBatch',
  positionEditBatch = '/project/location/editBatch',
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

type PositionRecord = {
  id?: string;
  locationName?: string;
  longitude?: string;
  latitude?: string;
  description?: string;
};
type PositionPayload = PositionRecord & { periodId: string };

function positionFields(record: PositionRecord): PositionRecord {
  return {
    ...(record.id ? { id: record.id } : {}),
    locationName: record.locationName || '',
    longitude: record.longitude == null ? '' : String(record.longitude),
    latitude: record.latitude == null ? '' : String(record.latitude),
    description: record.description || '',
  };
}

/** 新增位置：当前接口只提供批量新增。 */
export const addPosition = ({ periodId, ...record }: PositionPayload) =>
  defHttp.post({ url: Api.positionAddBatch, params: { periodId, records: [positionFields(record)] } }, { successMessageMode: 'none' });

/** 编辑批量接口是全量同步，必须先读齐同分期记录，不能只提交当前行。 */
export async function editPosition({ periodId, ...record }: PositionPayload) {
  if (!record.id) throw new Error('缺少实施位置 ID，无法编辑');
  const records: PositionRecord[] = [];
  const pageSize = 100;
  let total = Infinity;
  for (let pageNo = 1; records.length < total; pageNo++) {
    const page = await getPositions({ periodId, pageNo, pageSize });
    const pageTotal = Number(page?.total);
    if (!Array.isArray(page?.records) || !Number.isSafeInteger(pageTotal) || pageTotal < 0) {
      throw new Error('实施位置分页信息异常，已取消保存');
    }
    const rows: PositionRecord[] = page.records;
    if (!rows.length) {
      if (records.length < pageTotal) throw new Error('实施位置列表未读取完整，已取消保存');
      break;
    }
    records.push(...rows);
    total = pageTotal;
    if (total < records.length) throw new Error('实施位置分页信息异常，已取消保存');
    if (pageNo > 1000) throw new Error('实施位置数据量异常，已取消保存');
  }
  const index = records.findIndex((item) => String(item.id) === String(record.id));
  if (index < 0) throw new Error('该实施位置已不存在，请刷新列表');
  records[index] = { ...records[index], ...record };
  return defHttp.post({ url: Api.positionEditBatch, params: { periodId, records: records.map(positionFields) } }, { successMessageMode: 'none' });
}

/** 删除位置：当前接口接收逗号分隔的 ids。 */
export const deletePosition = ({ id }: { id: string }) =>
  defHttp.delete({ url: Api.positionDeleteBatch, params: { ids: id } }, { joinParamsToUrl: true, successMessageMode: 'none' });

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
export const getAcceptanceLatestStatus = (periodId: string) => defHttp.get({ url: '/project/acceptance/latestStatus', params: { periodId } });
export const getAcceptanceById = (id: string) => defHttp.get({ url: '/project/acceptance/queryById', params: { id } }, quietFeedback);

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
  /** 暂定客户职能字段，待后端实现；与系统权限角色无关。 */
  acceptUnitName?: string;
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
export const submitProjectRework = (params: {
  periodId: string;
  sourceAcceptanceId: string;
  reason: string;
  process: Recordable[];
  materials?: Recordable[];
  outsources?: Recordable[];
  id?: string;
  version?: number;
  description?: string;
  expectedAcceptanceDate?: string | null;
}) => defHttp.post({ url: Api.reworkSubmit, params }, quietFeedback);
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

/** 内外验统一申请，来源和施工轮次由后端确定；两种类型一次事务提交。 */
export const applyProjectAcceptance = (params: {
  periodId: string;
  acceptTypes: ('INTERNAL' | 'CUSTOMER')[];
  reason: string;
  applyMode: 'NORMAL' | 'WITHOUT_RECTIFICATION';
}) => defHttp.post({ url: '/project/acceptance/apply', params }, quietFeedback);
