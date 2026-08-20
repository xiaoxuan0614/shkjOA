import { defHttp } from '/@/utils/http/axios';

/**
 * 计划方案子资源 add(对齐后端 /project/* 项目域, apifox 文档存在)
 * 注: 这三个接口当前 src 其他处未调用, 保存时如后端未实现会按失败收集并提示
 */
enum Api {
  // 项目用料计划-添加
  materialPlanAdd = '/project/materialPlan/add',
  // 项目成员-添加
  memberAdd = '/project/member/add',
  // 项目工序-添加
  processAdd = '/project/process/add',
  // 项目成员-列表(按分期查, 可过滤邀请状态=1)
  memberList = '/project/member/list',
}

/**
 * 项目成员-列表(现场负责人下拉: 传 periodId + inviteStatus=1 已接收)
 * @param params { periodId, inviteStatus? }
 */
export const getPlanMembers = (params) => defHttp.get({ url: Api.memberList, params });

/**
 * 用料计划-添加(project_material_plan 实体)
 * @param params { periodId, materialId, materialCategory, materialName, brand, model, unit, purchaseQty, expressNo }
 */
export const addPlanMaterialPlan = (params) => defHttp.post({ url: Api.materialPlanAdd, params });

/**
 * 项目成员-添加(project_member 实体)
 * @param params { periodId, userName, memberRole, outsourcingFlag?, outsourcingUnit? }
 */
export const addPlanMember = (params) => defHttp.post({ url: Api.memberAdd, params });

/**
 * 项目工序-添加(project_process 实体)
 * @param params { periodId, processName, siteLeaderName, plannedStartTime, plannedEndTime, plannedHours }
 */
export const addPlanProcess = (params) => defHttp.post({ url: Api.processAdd, params });
