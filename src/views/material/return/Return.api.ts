import { defHttp } from '/@/utils/http/axios';

/**
 * 还料申请 - 接口定义
 * 复用「出入库申请」：/stock/apply/add（项目还料固定 IN + RETURN + PROJECT + periodId）
 * 项目列表：/project/member/participatedProjects（后端自动按当前用户过滤已接受邀请的项目）
 * 剩余物料：/project/materialAccount/page（按 periodId 返回项目物料总账）
 */
enum Api {
  applyAdd = '/stock/apply/add',
  applyEdit = '/stock/apply/edit',
  applyQueryById = '/stock/apply/queryById',
  participatedProjects = '/project/member/participatedProjects',
  materialAccountPage = '/project/materialAccount/page',
}

/**
 * 查询当前登录用户已确认参与的项目分期；无需传 userId。
 */
export const RETURN_PERIOD_STATUSES = [
  'IMPLEMENTING',
  'DEBUGGING',
  'DEBUG_COMPLETED',
  'IMPLEMENT_COMPLETED',
  'PENDING_ACCEPT',
  'INTERNAL_ACCEPTING',
  'ACCEPTING',
  'REWORKING',
  'WARRANTY',
  'COMPLETED',
  'CLOSED',
];

export const getParticipatedProjects = () =>
  defHttp.get({ url: Api.participatedProjects, params: { periodStatus: RETURN_PERIOD_STATUSES.join(',') } });

/**
 * 查询项目物料总账；数量均为物料基准单位。
 * remainingReturnQty = max(应还量 - 合格回库量 - 报废量 - 遗失量, 0)。
 */
export const getProjectMaterialAccount = (params: { periodId: string; pageNo?: number; pageSize?: number }) =>
  defHttp.get({ url: Api.materialAccountPage, params });

/**
 * 申请详情(撤回/驳回后重新编辑回填)
 */
export const getApplyById = (params) => defHttp.get({ url: Api.applyQueryById, params });

/**
 * 提交还料申请(入库申请)
 * @param params StockApply: { applyType:'IN', bizType:'RETURN', usageType:'PROJECT', periodId, itemList }
 */
export const submitReturnApply = (params) => defHttp.post({ url: Api.applyAdd, params }, { successMessageMode: 'success' });

/**
 * 重新提交(撤回/驳回后修改，更新原单，状态回待审批)
 */
export const updateReturnApply = (params) => defHttp.post({ url: Api.applyEdit, params }, { successMessageMode: 'success' });
