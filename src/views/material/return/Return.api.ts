import { defHttp } from '/@/utils/http/axios';

/**
 * 还料申请 - 接口定义
 * 复用「出入库申请」：/stock/apply/add（还料 = 归还，入库 IN，bizType=RETURN）
 * 还料列表：/stock/apply/returnList（按项目带出可还料列表，待后端提供）
 */
enum Api {
  returnList = '/stock/apply/returnList',
  applyAdd = '/stock/apply/add',
  applyEdit = '/stock/apply/edit',
  applyQueryById = '/stock/apply/queryById',
  searchPeriod = '/project/period/searchByName',
}

/**
 * 按项目单号带出可还料列表（待后端接口）
 * @param params { projectNo }
 */
export const getReturnList = (params) => defHttp.get({ url: Api.returnList, params });

/**
 * 项目分期名称模糊搜索（输入分期名称，带出分期编号/名称）
 * @param params { keyword, pageNo, pageSize }
 */
export const searchProjectPeriod = (params) => defHttp.get({ url: Api.searchPeriod, params });

/**
 * 申请详情(撤回/驳回后重新编辑回填)
 */
export const getApplyById = (params) => defHttp.get({ url: Api.applyQueryById, params });

/**
 * 提交还料申请(入库申请)
 * @param params StockApply: { applyType:'IN', bizType:'RETURN', projectNo, projectName, applyUserId, applyUserName, deptId, deptName, returnUser, remark, itemList }
 */
export const submitReturnApply = (params) =>
  defHttp.post({ url: Api.applyAdd, params }, { successMessageMode: 'success' });

/**
 * 重新提交(撤回/驳回后修改，更新原单，状态回待审批)
 */
export const updateReturnApply = (params) =>
  defHttp.post({ url: Api.applyEdit, params }, { successMessageMode: 'success' });
