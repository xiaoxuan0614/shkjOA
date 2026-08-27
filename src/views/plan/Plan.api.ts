import { defHttp } from '/@/utils/http/axios';
import { ContentTypeEnum } from '/@/enums/httpEnum';

export const QUOTATION_STATUS_DRAFT = '0';
export const QUOTATION_STATUS_SUBMITTED = '1';
export const QUOTATION_STATUS_ADOPTED = '2';
export const QUOTATION_STATUS_VOIDED = '3';

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
  materialDetail = '/stock/material/queryById',
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
  const pages = Number(first?.pages || 1);
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

/** 后端候选清单列表必须传 periodId，按分期查询后在前端聚合报价管理列表。 */
export async function quotationList(params: Recordable = {}) {
  const pageNo = Math.max(1, Number(params.pageNo) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);
  const periods = await fetchAllPages((pageParams) => planProjectList(pageParams), {
    projectName: params.projectName,
    periodName: params.periodName,
    periodId: params.periodId,
  });
  const candidates: any[] = [];
  const batchSize = 10;
  for (let index = 0; index < periods.length; index += batchSize) {
    const batch = periods.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (period: any) => ({
        period,
        records: await fetchAllPages((pageParams) => getMaterialCandidateList({ ...pageParams, periodId: period.periodId })),
      }))
    );
    results.forEach(({ period, records }) => {
      records.forEach((candidate: any) => candidates.push({ period, candidate }));
    });
  }
  const contains = (value: unknown, keyword: unknown) =>
    !keyword ||
    String(value || '')
      .toLowerCase()
      .includes(String(keyword).trim().toLowerCase());
  const records = candidates
    .filter(({ candidate }) => String(candidate.status) !== QUOTATION_STATUS_VOIDED)
    .map(({ period, candidate }) => ({
      ...period,
      ...candidate,
      apiStatus: String(candidate.status ?? ''),
      status: normalizeQuotationStatus(candidate.status),
      lastUpdatedBy: candidate.updateBy || candidate.createBy || '—',
    }))
    .filter(
      (item: any) =>
        contains(item.projectName, params.projectName) &&
        contains(item.periodName, params.periodName) &&
        contains(item.periodId, params.periodId) &&
        contains(item.candidateName, params.candidateName) &&
        (!params.status || String(item.status) === String(params.status))
    )
    .sort((a: any, b: any) => String(b.updateTime || b.createTime || '').localeCompare(String(a.updateTime || a.createTime || '')));
  const start = (pageNo - 1) * pageSize;
  return {
    records: records.slice(start, start + pageSize),
    total: records.length,
    current: pageNo,
    size: pageSize,
    pages: Math.ceil(records.length / pageSize),
  };
}

/** 新增报价可选择全部项目分期；同一分期允许存在多份不同名称的候选清单。 */
export const getQuotationPeriods = () => fetchAllPages((pageParams) => planProjectList(pageParams));

export const getMaterialCandidateList = (params) => defHttp.get({ url: Api.candidateList, params });

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
 * 按分期全量同步用料计划。records 中有 id 更新、无 id 新增，未提交的旧数据删除。
 */
export const editPlanMaterialBatch = (params, showSuccessMessage = true) =>
  defHttp.post({ url: Api.materialEditBatch, params }, { successMessageMode: showSuccessMessage ? 'success' : 'none' });

/** 物料详情（用于根据 materialId 补齐物料编码） */
export const getMaterialDetail = (params) => defHttp.get({ url: Api.materialDetail, params });

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
