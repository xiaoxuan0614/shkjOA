import { defHttp } from '/@/utils/http/axios';

/**
 * 采购入库 - 接口定义
 * ⚠️ 依据接口文档：采购走独立「采购订单」模块 /project/purchaseOrder（不再复用出入库申请）
 *   订单  /project/purchaseOrder/list|add|edit|delete|deleteBatch|queryById
 *   明细  add/edit 请求体携带 itemList 一并保存（后端落 purchase_order_item，orderId 回填）
 *   供应商 /project/supplier/list
 *   项目分期 /project/period/searchByName
 *   入库  /project/purchaseOrder/inbound   （按实际入库数量生成库存入库台账）
 *   状态  /project/purchaseOrder/status    （采购订单状态变更：传 orderId + 目标状态）
 */
enum Api {
  orderList = '/project/purchaseOrder/list',
  orderAdd = '/project/purchaseOrder/add',
  orderEdit = '/project/purchaseOrder/edit',
  orderQueryById = '/project/purchaseOrder/queryById',
  supplierList = '/project/supplier/list',
  searchPeriod = '/project/period/searchByName',
  periodList = '/project/period/list',
  inbound = '/project/purchaseOrder/inbound',
  status = '/project/purchaseOrder/status',
}

/**
 * 采购订单分页列表
 */
export const list = (params) => defHttp.get({ url: Api.orderList, params });

/**
 * 新增采购订单（订单头 + itemList 明细）
 * @param params OaPurchaseOrder + { itemList:[{materialId, materialName, materialCategory, brand, model, unit, quantity, unitPrice, amount}] }
 */
export const addOrder = (params) =>
  defHttp.post({ url: Api.orderAdd, params }, { successMessageMode: 'success' });

/**
 * 编辑采购订单（含状态流转：待采购→采购中→已到货→已入库）
 */
export const editOrder = (params) =>
  defHttp.post({ url: Api.orderEdit, params }, { successMessageMode: 'success' });

/**
 * 采购订单详情(含明细 itemList)
 */
export const queryOrderById = (params) => defHttp.get({ url: Api.orderQueryById, params });

/**
 * 供应商列表(分页返回 { records }，取 supplierName/supplierId)
 */
export const getSuppliers = (params?) => defHttp.get({ url: Api.supplierList, params });

/**
 * 项目分期名称模糊搜索（输入分期名称，带出主项目/分期编号）
 * @param params { keyword, pageNo, pageSize }
 */
export const searchProjectPeriod = (params) => defHttp.get({ url: Api.searchPeriod, params });

/**
 * 项目分期分页列表(用于采购订单列表 periodId→periodName 解析)
 */
export const listPeriod = (params) => defHttp.get({ url: Api.periodList, params });

/**
 * 采购入库：按实际入库数量生成库存入库台账（后端更新明细已入库数量并写台账）
 * @param params { orderId, items: [{ itemId(采购明细id), inboundQty(本次累计入库数量,按采购单位) }] }
 */
export const purchaseInbound = (params) =>
  defHttp.post({ url: Api.inbound, params }, { successMessageMode: 'success' });

/**
 * 采购订单状态变更（状态机：1待采购→2采购中→3已到货→4入库中→5已完成；1/2/3 可关闭→0）
 * @param params { orderId, status } 采购订单ID + 目标状态码
 */
export const changeStatus = (params) =>
  defHttp.post({ url: Api.status, params }, { successMessageMode: 'success' });
