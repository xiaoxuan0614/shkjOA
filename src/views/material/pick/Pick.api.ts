import { defHttp } from '/@/utils/http/axios';

/**
 * 领料申请 - 接口定义
 * 复用「出入库申请」接口：/stock/apply/add（领料 = 出库 OUT，bizType=PICK）
 * 项目领料候选：/project/materialAccount/page；其他领料候选：/stock/material/list。
 * 撤回/驳回后重新编辑：queryById + edit。
 */
enum Api {
  materialList = '/stock/material/list',
  applyAdd = '/stock/apply/add',
  applyEdit = '/stock/apply/edit',
  applyQueryById = '/stock/apply/queryById',
  participatedProjects = '/project/member/participatedProjects',
  materialAccountPage = '/project/materialAccount/page',
  projectDetail = '/project/project/projectPeriodDetail',
  reworkMaterials = '/project/rework/materials',
}

/**
 * 选物料列表(看实时库存 + 单位子表)
 */
export const selectMaterialList = (params) => defHttp.get({ url: Api.materialList, params });

/**
 * 查询当前登录用户已接受邀请并参与的项目分期。
 * periodStatus 支持使用英文逗号分隔多个项目分期生命周期状态。
 */
export const getParticipatedProjects = (params: { periodStatus?: string } = {}) => defHttp.get({ url: Api.participatedProjects, params });

/**
 * 项目物料总账分页；项目领料以 availableApplyQty 作为当前可申请数量。
 */
export const getProjectMaterialAccountPage = (params) => defHttp.get({ url: Api.materialAccountPage, params });

/** 返工领料只读取当前返工单的额外领料计划和剩余可申请数量。 */
export const getReworkMaterials = (params: { reworkId: string }) => defHttp.get({ url: Api.reworkMaterials, params });

/** 返工领料直链按 periodId 回显项目和分期名称。 */
export const getProjectPeriodDetail = (params: { periodId: string }) => defHttp.get({ url: Api.projectDetail, params });

/**
 * 申请详情(撤回/驳回后重新编辑回填)
 * @param params { id }
 */
export const getApplyById = (params) => defHttp.get({ url: Api.applyQueryById, params });

/**
 * 提交领料申请(出库申请)
 * @param params StockApply: { applyType:'OUT', bizType:'PICK', usageType, periodId?, applyUserId, useDate, remark, itemList:[{materialId,unitQty,unitName}] }
 */
export const submitPickApply = (params) => defHttp.post({ url: Api.applyAdd, params }, { successMessageMode: 'success' });

/**
 * 重新提交（撤回/驳回后修改）；项目领料状态由后端固定回待审批。
 * @param params StockApply（含 id；PROJECT 历史单据须补传 periodId）
 */
export const updatePickApply = (params) => defHttp.post({ url: Api.applyEdit, params }, { successMessageMode: 'success' });
