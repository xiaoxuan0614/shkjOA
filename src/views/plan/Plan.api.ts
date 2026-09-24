import { quotationVersion, normalizeQuotationAccess } from './quotationGovernance';
import { defHttp } from '/@/utils/http/axios';
import { ContentTypeEnum } from '/@/enums/httpEnum';
import { normalizeProjectListParams } from '../project/projectListFilters';

export const QUOTATION_STATUS_DRAFT = '-1';
export const QUOTATION_STATUS_REJECTED = '0';
export const QUOTATION_STATUS_APPROVED = '1';
export const QUOTATION_STATUS_SUBMITTED = '2';
export const isQuotationAdopted = (record?: { adopted?: unknown }) => String(record?.adopted) === '1';
export const QUOTATION_STATUS_VOIDED = '4';
export const isQuotationEditable = (status: unknown) => ['-1', '0', '1'].includes(String(status));

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
export const planProjectList = (params) => defHttp.get({ url: Api.list, params: normalizeProjectListParams(params) });

export function normalizeQuotationStatus(status: unknown) {
  return String(status ?? QUOTATION_STATUS_DRAFT);
}

/** 名称直接传关键词；0 为有效筛选，空值才省略。 */
export function quotationFilters(params: Recordable = {}) {
  const filters: Recordable = {};
  for (const key of ['keyword', 'projectName', 'status', 'adopted']) {
    const value = params[key];
    if (value != null && String(value).trim() !== '') filters[key] = typeof value === 'string' ? value.trim() : value;
  }
  return filters;
}

/** 报价管理直接使用后端分页，不再枚举分期、聚合或在当前页过滤。 */
export async function quotationList(params: Recordable = {}) {
  const periodId = String(params.periodId ?? '').trim();
  const result: any = await getMaterialCandidateList({
    pageNo: Math.max(1, Number(params.pageNo) || 1),
    pageSize: Math.max(1, Number(params.pageSize) || 10),
    ...(periodId ? { periodId } : {}),
    ...quotationFilters(params),
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

/** 新增报价仅选择合同待提交、驳回、待审批或已撤回的分期。 */
export const getQuotationPeriods = () => fetchAllPages((pageParams) => planProjectList({ ...pageParams, contractStatus: '-1,0,2,3' }));

export const getMaterialCandidateList = (params) => defHttp.get({ url: Api.candidateList, params });
/** 外层按分期分页，total 为分期数；不改变原候选单分页。 */
export const quotationPeriodGroupPage = (params: Recordable = {}) =>
  defHttp.get({
    url: '/project/materialCandidate/periodGroupPage',
    params: { pageNo: params.pageNo || 1, pageSize: params.pageSize || 10, ...quotationFilters(params) },
  });
export const getAllMaterialCandidates = (periodId: string) => fetchAllPages(getMaterialCandidateList, { periodId });
export const getAllMaterialCandidateItems = (candidateId: string) => fetchAllPages(getMaterialCandidateItemList, { candidateId });

export const addMaterialCandidate = (params, showSuccessMessage = true) =>
  defHttp.post({ url: Api.candidateAdd, params }, { successMessageMode: showSuccessMessage ? 'success' : 'none' });

export const editMaterialCandidate = (params, showSuccessMessage = true) =>
  defHttp.post(
    { url: Api.candidateEdit, params: { ...params, version: quotationVersion(params.version) } },
    { successMessageMode: showSuccessMessage ? 'success' : 'none' }
  );

export const getMaterialCandidateItemList = (params) => defHttp.get({ url: Api.candidateItemList, params });

export const addMaterialCandidateItems = (params, showSuccessMessage = true) =>
  defHttp.post(
    { url: Api.candidateItemAddBatch, params: { ...params, version: quotationVersion(params.version) } },
    { successMessageMode: showSuccessMessage ? 'success' : 'none' }
  );

export const editMaterialCandidateItems = (params, showSuccessMessage = true) =>
  defHttp.post(
    { url: Api.candidateItemEditBatch, params: { ...params, version: quotationVersion(params.version) } },
    { successMessageMode: showSuccessMessage ? 'success' : 'none' }
  );

const candidateBase = '/project/materialCandidate';
const quietCandidate = { successMessageMode: 'none', errorMessageMode: 'none' } as const;
export const getQuotationGrantUsers = (pageNo: number) =>
  defHttp.get({ url: '/sys/user/list', params: { pageNo, pageSize: 100, status: 1 } }, quietCandidate);
export const getQuotationDepartments = () => defHttp.get({ url: '/sys/sysDepart/queryTreeList' }, quietCandidate);
export const getQuotationAccess = async (periodId: string, candidateId?: string) =>
  normalizeQuotationAccess(await defHttp.get({ url: `${candidateBase}/permissions`, params: { periodId, ...(candidateId ? { candidateId } : {}) } }, quietCandidate));
export const getQuotationGrants = (periodId: string) => defHttp.get({ url: `${candidateBase}/grants`, params: { periodId } }, quietCandidate);
export const saveQuotationGrant = (params: Recordable) =>
  defHttp.post({ url: `${candidateBase}/grant`, params: { ...params, version: quotationVersion(params.version) } }, quietCandidate);
export const getQuotationHistory = (params: Recordable) => defHttp.get({ url: `${candidateBase}/history`, params }, quietCandidate);
export async function getCandidateRecord(periodId: string, candidateId: string) {
  const records = await getAllMaterialCandidates(periodId);
  const record = records.find((item: any) => String(item.id) === String(candidateId));
  if (!record) throw new Error('未找到报价单，请返回列表刷新');
  quotationVersion(record.version);
  return record;
}
export function candidateAction(action: 'submit' | 'approve' | 'withdraw' | 'void' | 'price', record: Recordable, fields: Recordable = {}) {
  if (!record.id) throw new Error('缺少候选清单 ID');
  return defHttp.post(
    { url: `${candidateBase}/${action}`, params: { ...fields, candidateId: record.id, version: quotationVersion(record.version) } },
    quietCandidate
  );
}
export const reviseMaterialCandidate = (params: Recordable) =>
  defHttp.post({ url: `${candidateBase}/revise`, params: { ...params, version: quotationVersion(params.version) } }, quietCandidate);
export const checkCandidateExport = (record: Recordable) =>
  defHttp.get({ url: `${candidateBase}/exportCheck`, params: { candidateId: record.id, version: quotationVersion(record.version) } }, quietCandidate);
export const getCandidateExportData = (record: Recordable) =>
  defHttp.get({ url: `${candidateBase}/exportData`, params: { candidateId: record.id, version: quotationVersion(record.version) } }, quietCandidate);

/** 采用仍走主单编辑，必须带使用者看到的版本；冲突由后端拒绝。 */
export const updateMaterialCandidateAdoption = (record: Recordable, adopted: 0 | 1, showSuccessMessage = true) =>
  editMaterialCandidate(
    { id: record.id, periodId: record.periodId, candidateName: record.candidateName, version: quotationVersion(record.version), adopted },
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
  return defHttp.post(
    { url, params: data, headers: { 'Content-Type': ContentTypeEnum.JSON } },
    { successMessageMode: showSuccessMessage ? 'success' : 'none' }
  );
}
