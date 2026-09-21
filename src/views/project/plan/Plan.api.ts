import { uploadProjectDocument } from '/@/utils/documentUpload';
import { defHttp } from '/@/utils/http/axios';
import { ContentTypeEnum } from '/@/enums/httpEnum';

/**
 * 计划方案子资源接口（对齐后端 /project/* 项目域）。
 */
enum Api {
  // 计划方案
  planAdd = '/project/plan/add',
  planAddBatch = '/project/plan/addBatch',
  planEdit = '/project/plan/edit',
  planDeleteBatch = '/project/plan/deleteBatch',
  // 项目用料计划-添加
  materialPlanAdd = '/project/materialPlan/add',
  // 项目成员-单条邀请、批量新增/删除
  memberAdd = '/project/member/add',
  memberAddBatch = '/project/member/addBatch',
  memberEditBatch = '/project/member/editBatch',
  memberDeleteBatch = '/project/member/deleteBatch',
  // 项目成员-列表(按分期查, 邀请状态 1 表示接受)
  memberList = '/project/member/list',
  // 外协配置
  memberOutsourceList = '/project/memberOutsource/list',
  memberOutsourceEditBatch = '/project/memberOutsource/editBatch',
  outsourcingUnitList = '/project/outsourcingUnit/list',
  // 实施计划详情一次返回计划验收信息与全部工序；工序、位置按分期全量同步
  processDetail = '/project/process/detail',
  processAddBatch = '/project/process/addBatch',
  processEditBatch = '/project/process/editBatch',
  locationList = '/project/location/list',
  locationEditBatch = '/project/location/editBatch',
}

/**
 * 项目成员-列表（当前契约仅接收 periodId 与分页参数；现场负责人由前端过滤 inviteStatus=1）
 * @param params { periodId, pageNo?, pageSize? }
 */
const quietFeedback = { successMessageMode: 'none', errorMessageMode: 'none' } as const;

export const getPlanMembers = (params) => defHttp.get({ url: Api.memberList, params }, quietFeedback);

export const getPlanOutsources = (params) => defHttp.get({ url: Api.memberOutsourceList, params }, quietFeedback);

/** 外协配置的单位下拉，读取外协单位维护数据。 */
export const getOutsourcingUnits = (params) => defHttp.get({ url: Api.outsourcingUnitList, params }, quietFeedback);

export const getPlanProcessDetail = (params: { periodId: string }) => defHttp.get({ url: Api.processDetail, params }, quietFeedback);

export const getPlanLocations = (params) => defHttp.get({ url: Api.locationList, params }, quietFeedback);

/** 新增单条计划方案；可选文件先公共上传，再使用 JSON 提交路径。 */
export const addProjectPlan = (data: Recordable, attachment?: File) => submitProjectPlan(Api.planAdd, data, attachment);

/** 批量新增方案使用 JSON；可选文件先公共上传，再传 plan.planFileId。 */
export function addProjectPlansBatch(periodId: string, records: { plan: Recordable }[]) {
  return defHttp.post({ url: Api.planAddBatch, params: { periodId, records }, headers: { 'Content-Type': ContentTypeEnum.JSON } }, quietFeedback);
}

/** 修改单条计划方案；未传 attachment 时保留原文件。 */
export const editProjectPlan = (data: Recordable, attachment?: File) => submitProjectPlan(Api.planEdit, data, attachment);

/** 删除计划方案。 */
export const deleteProjectPlansBatch = (params: { ids: string }, showSuccessMessage = true) =>
  defHttp.delete(
    { url: Api.planDeleteBatch, params },
    { joinParamsToUrl: true, ...quietFeedback, successMessageMode: showSuccessMessage ? 'success' : 'none' }
  );

async function submitProjectPlan(url: string, data: Recordable, attachment?: File) {
  const params = { ...data };
  if (attachment) params.planFileId = (await uploadProjectDocument(attachment, String(data.periodId || ''))).path;
  return defHttp.post({ url, params, headers: { 'Content-Type': ContentTypeEnum.JSON } }, quietFeedback);
}

/**
 * 用料计划-添加(project_material_plan 实体)
 * @param params { periodId, materialId, materialCategory, materialName, brand, model, unit, purchaseQty, expressNo }
 */
export const addPlanMaterialPlan = (params) => defHttp.post({ url: Api.materialPlanAdd, params });

/**
 * 项目成员-批量新增(project_member 实体)
 * @param params { periodId, records: [{ userId, memberRole, remark? }] }
 * 同一用户的多个角色合并在一个 memberRole 中，并使用英文逗号连接，例如 "5,6"。
 */
export const addPlanMembersBatch = (params) => defHttp.post({ url: Api.memberAddBatch, params }, { successMessageMode: 'success' });

/** 按分期全量同步项目成员。 */
export const editPlanMembersBatch = (params) => defHttp.post({ url: Api.memberEditBatch, params });

/** 按分期全量同步外协配置。 */
export const editPlanOutsourcesBatch = (params) => defHttp.post({ url: Api.memberOutsourceEditBatch, params }, quietFeedback);

/**
 * 项目成员-单条邀请。
 * @param params { periodId, userId, memberRole, inviteStatus }
 */
export const addPlanMember = (params) => defHttp.post({ url: Api.memberAdd, params }, { successMessageMode: 'success' });

/**
 * 项目成员-批量删除。
 * @param params { ids: string }
 */
export const deletePlanMembersBatch = (params) =>
  defHttp.delete({ url: Api.memberDeleteBatch, params }, { joinParamsToUrl: true, successMessageMode: 'success' });

/** 按分期全量同步项目工序。 */
export const editPlanProcessesBatch = (params) => defHttp.post({ url: Api.processEditBatch, params }, quietFeedback);

/** 首次批量新增项目工序。 */
export const addPlanProcessesBatch = (params) => defHttp.post({ url: Api.processAddBatch, params }, quietFeedback);

/** 按分期全量同步实施位置；行内保存可关闭接口默认的“批量修改成功”提示。 */
export const editPlanLocationsBatch = (params, showSuccessMessage = true) =>
  defHttp.post(
    { url: Api.locationEditBatch, params },
    {
      successMessageMode: showSuccessMessage ? 'success' : 'none',
      errorMessageMode: showSuccessMessage ? 'message' : 'none',
    }
  );
