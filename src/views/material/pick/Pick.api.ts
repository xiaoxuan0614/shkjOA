import { defHttp } from '/@/utils/http/axios';

/**
 * 领料申请 - 接口定义
 * 复用「出入库申请」接口：/stock/apply/add（领料 = 出库 OUT，bizType=PICK）
 * 选物料：/stock/material/list；撤回/驳回后重新编辑：queryById + edit
 */
enum Api {
  materialList = '/stock/material/list',
  applyAdd = '/stock/apply/add',
  applyEdit = '/stock/apply/edit',
  applyQueryById = '/stock/apply/queryById',
  searchPeriod = '/project/period/searchByName',
}

/**
 * 选物料列表(看实时库存 + 单位子表)
 */
export const selectMaterialList = (params) => defHttp.get({ url: Api.materialList, params });

/**
 * 项目分期名称模糊搜索（输入分期名称，带出分期编号/名称）
 * @param params { keyword, pageNo, pageSize }
 */
export const searchProjectPeriod = (params) => defHttp.get({ url: Api.searchPeriod, params });

/**
 * 申请详情(撤回/驳回后重新编辑回填)
 * @param params { id }
 */
export const getApplyById = (params) => defHttp.get({ url: Api.applyQueryById, params });

/**
 * 提交领料申请(出库申请)
 * @param params StockApply: { applyType:'OUT', bizType:'PICK', projectNo, projectName, applyUserId, applyUserName, deptId, deptName, useDate, remark, itemList }
 */
export const submitPickApply = (params) =>
  defHttp.post({ url: Api.applyAdd, params }, { successMessageMode: 'success' });

/**
 * 重新提交(撤回/驳回后修改，更新原单，状态回待审批)
 * @param params StockApply(含 id) + { status:'待审批', executeStatus:'待出库' }
 */
export const updatePickApply = (params) =>
  defHttp.post({ url: Api.applyEdit, params }, { successMessageMode: 'success' });
