import { defHttp } from '/@/utils/http/axios';

/**
 * 出入库申请 - 接口定义
 * ⚠️ 与正式后端接口契约对齐(apifox /stock/apply)
 *   申请列表 /stock/apply/list
 *   审批通过 /stock/apply/approve   入参 StockApplyApproval(approvalResult=AGREE)
 *   驳回     /stock/apply/reject    入参 StockApplyApproval(approvalResult=REJECT)
 *   撤回/取消 /stock/apply/cancel    入参 query id
 *   删除      /stock/apply/delete   入参 query id
 *   执行出入库 /stock/apply/execute  入参 StockApplyExecuteRequest(applyId+itemIds+items)
 *   明细分页列表 /stock/apply/items
 *   审批记录分页列表 /stock/apply/approvals
 * 新增/编辑走 /stock/apply/add|edit（领料/还料/物料申请页）
 */
enum Api {
  list = '/stock/apply/list',
  queryById = '/stock/apply/queryById',
  queryItems = '/stock/apply/items',
  queryApprovals = '/stock/apply/approvals',
  approve = '/stock/apply/approve',
  reject = '/stock/apply/reject',
  cancel = '/stock/apply/cancel',
  deleteOne = '/stock/apply/delete',
  deleteBatch = '/stock/apply/deleteBatch',
  execute = '/stock/apply/execute',
}

/**
 * 出入库申请分页列表
 */
export const list = (params) => defHttp.get({ url: Api.list, params });

/**
 * 申请详情(申请头)
 * ⚠️ 返回的 itemList(申请明细)/approvalList(审批记录) 已废弃——
 *    请改用 queryItems(/stock/apply/items 明细分页) + queryApprovals(/stock/apply/approvals 审批记录分页)
 * @param params { id }
 */
export const queryById = (params) => defHttp.get({ url: Api.queryById, params });

/**
 * 出入库申请-明细分页列表
 * @param params { applyId, pageNo?, pageSize? }
 *   StockApplyItem: id, materialId, materialCategory, materialName, brand, model, unit, unitId,
 *   unitName, unitQty, baseQty, applyQty, unitPrice, amount, remark, status,
 *   approvedQty, approvedBaseQty, executedQty, executeStatus, executeUserId, executeUserName, executeTime
 *   MyBatis-Plus 分页返回 { records, total, size, current, pages }
 */
export const queryItems = (params) => defHttp.get({ url: Api.queryItems, params });

/**
 * 出入库申请-审批记录分页列表
 * @param params { applyId, pageNo?, pageSize? }
 *   StockApplyApproval: id, applyId, nodeName, approvalUserId, approvalUserName, approvalResult,
 *   approvalComment, approvalTime, itemId, materialName, items:[{ itemId, approve(bool), unitQty, remark }],
 *   applyQty, approvedQty, approvedBaseQty, unitName
 */
export const queryApprovals = (params) => defHttp.get({ url: Api.queryApprovals, params });

/**
 * 审批提交（整单审批唯一接口，通过+驳回一次提交）
 * @param params StockApplyApproval:
 *   { applyId, approvalUserId?, items }
 *   approvalUserId 当前操作人id（全局规定：审批必须传，= getCurrentUser().applyUserId）
 *   items 整单所有物料审批结果一起传：{ itemId, approve(bool), remark? }
 *     approve=true 通过 / approve=false 驳回（任一条驳回 → 整单状态「已驳回」）
 */
export const approveApply = (params) =>
  defHttp.post({ url: Api.approve, params }, { successMessageMode: 'success' });

/**
 * 驳回
 * @param params StockApplyApproval:
 *   { applyId, approvalUserId?, approvalResult:'REJECT', approvalComment?, items? }
 *   approvalUserId 当前操作人id（全局规定：审批必须传，= getCurrentUser().applyUserId）
 *   items 明细审批结果(空=整单驳回)：{ itemId, approve, remark? }
 *   approve 三态：true 通过 / false 驳回 / null 暂不处理(不提交该项则保持待审批)
 */
export const rejectApply = (params) =>
  defHttp.post({ url: Api.reject, params }, { successMessageMode: 'success' });

/**
 * 撤回/取消申请(query 传 id；撤回后状态置「已撤回」)
 * @param id 申请ID
 */
export const cancelApply = (id) =>
  defHttp.post({ url: Api.cancel, params: { id } }, { joinParamsToUrl: true, successMessageMode: 'success' });

/**
 * 删除申请(query 传 id)
 * @param id 申请ID
 */
export const deleteApply = (id) =>
  defHttp.delete({ url: Api.deleteOne, params: { id } }, { joinParamsToUrl: true, successMessageMode: 'success' });

/**
 * 批量删除申请
 * @param ids 申请ID数组
 */
export const deleteBatchApply = (ids) =>
  defHttp.delete({ url: Api.deleteBatch, data: { ids } }, { joinParamsToUrl: true, successMessageMode: 'success' });

/**
 * 执行出入库(单条/批量统一走此接口；方向由申请自身决定)
 * @param params StockApplyExecuteRequest:
 *   { applyId, itemIds?, items? }
 *   itemIds  待执行明细ID；为空时执行全部待执行明细
 *   items    分批执行明细[{ itemId, executeQty }]；为空时按 itemIds 或全部待执行明细执行
 *            executeQty=本次执行数量(按所选单位)；为空时执行剩余数量
 * ⚠️ 无 approvalUserId：执行人由后端从登录 token 取
 */
export const executeApply = (params) =>
  defHttp.post({ url: Api.execute, params }, { successMessageMode: 'success' });
