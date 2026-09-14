import { defHttp } from '/@/utils/http/axios';
import { ContentTypeEnum } from '/@/enums/httpEnum';

export const QUOTATION_STATUS_DRAFT = '-1';
export const QUOTATION_STATUS_REJECTED = '0';
export const QUOTATION_STATUS_APPROVED = '1';
export const QUOTATION_STATUS_SUBMITTED = '2';
export const QUOTATION_STATUS_ADOPTED = '3';
export const QUOTATION_STATUS_VOIDED = '4';
export const isQuotationEditable = (status: unknown) => ['-1', '0'].includes(String(status));

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
  materialEditBatch = '/project/materialPlan/editBatch',
  // 报价管理（项目用料候选清单主表/子表）
  candidateList = '/project/materialCandidate/list',
  candidateAdd = '/project/materialCandidate/add',
  candidateEdit = '/project/materialCandidate/edit',
  candidateItemList = '/project/materialCandidateItem/list',
  candidateItemAddBatch = '/project/materialCandidateItem/addBatch',
  candidateItemEditBatch = '/project/materialCandidateItem/editBatch',
  // 实施位置
  positionList = '/project/location/list',
  // 保存计划方案
  savePlan = '/project/plan/add',
  editPlan = '/project/plan/edit',
}

function getPageRecords(result: any) {
  return Array.isArray(result) ? result : result?.records || [];
}

async function fetchAllPages(api: (params: Recordable) => Promise<any>, params: Recordable = {}) {
  const pageSize = 1000;
  const first: any = await api({ ...params, pageNo: 1, pageSize });
  const records = [...getPageRecords(first)];
  const pages = Number(first?.pages || Math.ceil(Number(first?.total || records.length) / Number(first?.size || records.length || pageSize)) || 1);
  if (pages > 1) {
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => api({ ...params, pageNo: index + 2, pageSize })));
    rest.forEach((page) => records.push(...getPageRecords(page)));
  }
  return records;
}

/**
 * 项目/分期分页列表(计划方案入口)
 */
export const planProjectList = (params) => defHttp.get({ url: Api.list, params });

export function normalizeQuotationStatus(status: unknown) {
  return String(status ?? QUOTATION_STATUS_DRAFT);
}

/** 报价管理直接使用后端分页，不再枚举分期、聚合或在当前页过滤。 */
export async function quotationList(params: Recordable = {}) {
  const periodId = String(params.periodId ?? '').trim();
  const result: any = await getMaterialCandidateList({
    pageNo: Math.max(1, Number(params.pageNo) || 1),
    pageSize: Math.max(1, Number(params.pageSize) || 10),
    ...(periodId ? { periodId } : {}),
  });
  return {
    ...result,
    records: (result?.records || []).map((candidate: any) => ({
      ...candidate,
      apiStatus: String(candidate.status ?? ''),
      status: normalizeQuotationStatus(candidate.status),
      lastUpdatedBy: candidate.updateBy || candidate.createBy || '—',
    })),
  };
}

/** 新增报价可选择全部项目分期；同一分期允许存在多份不同名称的候选清单。 */
export const getQuotationPeriods = () => fetchAllPages((pageParams) => planProjectList(pageParams));

export const getMaterialCandidateList = (params) => defHttp.get({ url: Api.candidateList, params });
export const getAllMaterialCandidates = (periodId: string) => fetchAllPages(getMaterialCandidateList, { periodId });
export const getAllMaterialCandidateItems = (candidateId: string) => fetchAllPages(getMaterialCandidateItemList, { candidateId });

export const addMaterialCandidate = (params, showSuccessMessage = true) =>
  defHttp.post({ url: Api.candidateAdd, params }, { successMessageMode: showSuccessMessage ? 'success' : 'none' });

export const editMaterialCandidate = (params, showSuccessMessage = true) =>
  defHttp.post({ url: Api.candidateEdit, params }, { successMessageMode: showSuccessMessage ? 'success' : 'none' });

export const getMaterialCandidateItemList = (params) => defHttp.get({ url: Api.candidateItemList, params });

export const addMaterialCandidateItems = (params, showSuccessMessage = true) =>
  defHttp.post({ url: Api.candidateItemAddBatch, params }, { successMessageMode: showSuccessMessage ? 'success' : 'none' });

export const editMaterialCandidateItems = (params, showSuccessMessage = true) =>
  defHttp.post({ url: Api.candidateItemEditBatch, params }, { successMessageMode: showSuccessMessage ? 'success' : 'none' });

export const updateMaterialCandidateStatus = (record: Recordable, status: string, showSuccessMessage = true) =>
  editMaterialCandidate(
    {
      id: record.id,
      periodId: record.periodId,
      candidateName: record.candidateName,
      status,
    },
    showSuccessMessage
  );

/** 当前候选清单未提供删除接口，删除操作使用后端作废状态并由报价列表隐藏。 */
export const voidMaterialCandidate = (record: Recordable, showSuccessMessage = true) =>
  editMaterialCandidate(
    {
      id: record.id,
      periodId: record.periodId,
      candidateName: record.candidateName,
      status: QUOTATION_STATUS_VOIDED,
    },
    showSuccessMessage
  );

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
 * 按分期全量同步用料计划。
 * records 仅提交 id（已有记录）、materialId、plannedQty、unitId、remark；未提交的旧数据删除。
 */
export const editPlanMaterialBatch = (params, showSuccessMessage = true) =>
  defHttp.post(
    { url: Api.materialEditBatch, params },
    {
      successMessageMode: showSuccessMessage ? 'success' : 'none',
      errorMessageMode: showSuccessMessage ? 'message' : 'none',
    }
  );

/**
 * 实施位置列表
 */
export const getPlanPositionList = (params) => defHttp.get({ url: Api.positionList, params });

/**
 * 保存计划方案
 */
export const savePlan = (params, showSuccessMessage = true) => submitPlan(Api.savePlan, params, showSuccessMessage);

/** 编辑计划方案（报价草稿锁定状态） */
export const editPlan = (params, showSuccessMessage = true) => submitPlan(Api.editPlan, params, showSuccessMessage);

function submitPlan(url: string, data: Recordable, showSuccessMessage: boolean) {
  const formData = new FormData();
  formData.append('data', JSON.stringify(data));
  return defHttp.post(
    { url, params: formData, headers: { 'Content-Type': ContentTypeEnum.FORM_DATA } },
    { successMessageMode: showSuccessMessage ? 'success' : 'none' }
  );
}
