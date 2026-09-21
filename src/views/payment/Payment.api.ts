import { defHttp } from '/@/utils/http/axios';
import { ContentTypeEnum } from '/@/enums/httpEnum';

/**
 * 回款管理 - 对接后端 /project/contract/* 与 /project/paymentRecord/*
 * 合同新增和修改均使用 JSON，详情按 periodId 返回合同、文件与回款计划。
 */
enum Api {
  list = '/project/contract/list',
  detail = '/project/contract/queryById',
  add = '/project/contract/add',
  addWithPaymentRecords = '/project/contract/addWithPaymentRecords',
  editWithPaymentRecords = '/project/contract/editWithPaymentRecords',
  status = '/project/contract/status',
  delete = '/project/contract/delete',
  paybackList = '/project/paymentRecord/list',
  paybackAdd = '/project/paymentRecord/add',
  paybackAddBatch = '/project/paymentRecord/addBatch',
  paybackEditBatch = '/project/paymentRecord/editBatch',
  paybackDeleteBatch = '/project/paymentRecord/deleteBatch',
}

/**
 * 合同分页列表
 */
export const contractList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 合同详情；最新接口仅接受项目分期 ID。
 * @param params { periodId }
 */
export const contractDetail = async (params, quiet = false) => {
  const result: any = await defHttp.get({ url: Api.detail, params }, quiet ? { successMessageMode: 'none', errorMessageMode: 'none' } : undefined);
  if (!result?.contract) return result;
  // 兼容原有消费方的合同扁平结构，同时保留组合接口返回的文件与回款计划。
  return {
    ...result.contract,
    contractFile: result.contractFile,
    materialFile: result.materialFile,
    records: result.records || [],
  };
};

/**
 * 合同审批按项目分期读取合同详情，避免把项目列表中的其他记录 ID 误作合同主键。
 * @param periodId 项目分期 ID
 */
export const contractDetailByPeriodId = (periodId: string) => contractDetail({ periodId });

/** 旧回款管理弹窗仅保留新增；合同修改统一进入组合修改接口。 */
export const saveContract = (params) => defHttp.post({ url: Api.add, params }, { successMessageMode: 'success' });

/**
 * 新增合同与回款计划：文件先公共上传，路径随 JSON contract 提交。
 */
export const addContractWithPaymentRecords = (data: Recordable) =>
  defHttp.post({ url: Api.addWithPaymentRecords, params: data, headers: { 'Content-Type': ContentTypeEnum.JSON } }, { successMessageMode: 'none' });

/**
 * 按 periodId 差量修改合同字段，并全量同步回款计划；未传新文件时保留旧文件。
 */
export const editContractWithPaymentRecords = (data: Recordable) =>
  defHttp.post({ url: Api.editWithPaymentRecords, params: data, headers: { 'Content-Type': ContentTypeEnum.JSON } }, { successMessageMode: 'none' });

/**
 * 合同状态变更（审批、撤回、重新提审）。
 * @param params { periodId, status, approvalReason? } status: -1待提交 / 0驳回 / 1审核通过 / 2待审批 / 3已撤回
 */
export const changeContractStatus = (params) => defHttp.post({ url: Api.status, params }, { successMessageMode: 'success' });

/**
 * 项目回款计划列表；periodId 必传。
 */
export const paybackList = async (params, quiet = false) => {
  const result: any = await defHttp.get(
    { url: Api.paybackList, params },
    quiet ? { successMessageMode: 'none', errorMessageMode: 'none' } : undefined
  );
  const normalize = (record: Recordable) => ({
    ...record,
    node: record.paymentNode ?? record.node,
    amount: record.plannedAmount ?? record.amount,
    planDate: record.plannedDate ?? record.planDate,
    type: record.paymentNode ?? record.type,
    planAmount: record.plannedAmount ?? record.planAmount,
    paidAmount: record.actualAmount ?? record.paidAmount,
    unpaidAmount: record.unpaidAmount ?? Math.max(0, Number(record.plannedAmount || 0) - Number(record.actualAmount || 0)),
    detail: record.remark ?? record.detail,
  });
  if (Array.isArray(result)) return result.map(normalize);
  if (Array.isArray(result?.records)) return { ...result, records: result.records.map(normalize) };
  return result;
};

/**
 * 添加单条回款项（兼容旧页面）
 */
export const savePayback = (params) => defHttp.post({ url: Api.paybackAdd, params }, { successMessageMode: 'success' });

/**
 * 批量新增项目回款计划。
 * @param params { periodId, records }; records 内不得传 periodId/id/contractId
 */
export const addPaybackBatch = (params) => defHttp.post({ url: Api.paybackAddBatch, params }, { successMessageMode: 'success' });

/**
 * 按项目分期全量同步回款计划。
 * @param params { periodId, records }; 带 id 更新，不带 id 新增，未提交的原记录会删除
 */
export const editPaybackBatch = (params) => defHttp.post({ url: Api.paybackEditBatch, params }, { successMessageMode: 'success' });

/**
 * 批量删除回款计划
 * @param params { ids: string }
 */
export const deletePaybackBatch = (params) =>
  defHttp.delete({ url: Api.paybackDeleteBatch, params }, { joinParamsToUrl: true, successMessageMode: 'success' });
