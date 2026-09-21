import { defHttp } from '/@/utils/http/axios';
import { usePermission } from '/@/hooks/web/usePermission';
import { useMessage } from '/@/hooks/web/useMessage';

const { createConfirm } = useMessage();

/**
 * 物料库存 - 接口定义
 *
 * ⚠️ 路径与正式后端接口契约对齐(mock 前缀 /stock/*，对应正式服务 /shouhuiApi/stock/*)：
 *    物料  /stock/material/list|queryById|add|edit|delete|deleteBatch
 *    台账  /stock/ioRecord/manualIn|manualOut   （库存变动走手动入库/出库，无直接改库存接口）
 */
enum Api {
  list = '/stock/material/list',
  queryById = '/stock/material/queryById',
  save = '/stock/material/add',
  edit = '/stock/material/edit',
  deleteOne = '/stock/material/delete',
  deleteBatch = '/stock/material/deleteBatch',
  manualIn = '/stock/ioRecord/manualIn',
  manualOut = '/stock/ioRecord/manualOut',
  importExcel = '/stock/material/importExcel',
  importTemplate = '/stock/material/importTemplate',
}

/**
 * 分页列表
 */
export const list = (params) => defHttp.get({ url: Api.list, params });

/**
 * 根据 id 查询详情(含单位子表 unitList)
 */
export const queryById = (params) => defHttp.get({ url: Api.queryById, params });

/**
 * 删除单个
 */
export const deleteOne = (params, handleSuccess) => {
  return defHttp.delete({ url: Api.deleteOne, params }, { joinParamsToUrl: true }).then(() => {
    handleSuccess();
  });
};

/**
 * 批量删除
 */
export const batchDelete = (params, handleSuccess) => {
  createConfirm({
    iconType: 'warning',
    title: '确认删除',
    content: '是否删除选中数据',
    okText: '确认',
    cancelText: '取消',
    onOk: () => {
      return defHttp.delete({ url: Api.deleteBatch, data: params }, { joinParamsToUrl: true }).then(() => {
        handleSuccess();
      });
    },
  });
};

/**
 * 保存或者更新
 */
export const saveOrUpdate = (params, isUpdate, showTip = true) => {
  const url = isUpdate ? Api.edit : Api.save;
  const basic = { ...params };
  // 基本信息维护不得携带价格，避免回显或默认值覆盖独立维护的价格。
  delete basic.costPrice;
  delete basic.unitPrice;
  delete basic.guideMarkupRate;
  return defHttp.post({ url, params: basic }, { successMessageMode: showTip ? 'success' : 'none' });
};

/**
 * 手动入库 / 手动出库（库存变动统一走台账接口，后端计算基准数量/金额/变动前后库存）
 * @param ioType 'IN' 入库 | 'OUT' 出库
 */
export const manualInOut = (params, ioType: 'IN' | 'OUT') => {
  const url = ioType === 'IN' ? Api.manualIn : Api.manualOut;
  return defHttp.post({ url, params }, { successMessageMode: 'success' });
};

/**
 * 物料Excel导入(接口文档：POST /stock/material/importExcel，multipart)
 */
export const importExcel = Api.importExcel;

/**
 * 物料导入模板下载(接口文档：GET /stock/material/importTemplate)
 */
export const importTemplate = Api.importTemplate;

/** 专用价格接口，仅提交 ID 与非空价格，不修改物料基本信息。 */
export const MATERIAL_PRICE_PERMISSION = 'mtl:goods:price';
export async function saveMaterialPrices(params: {
  id: string;
  costPrice?: number | string;
  unitPrice?: number | string;
  guideMarkupRate?: number | string;
}) {
  if (!usePermission().hasPermission(MATERIAL_PRICE_PERMISSION)) throw new Error('无价格维护权限');
  const { id, costPrice, unitPrice, guideMarkupRate } = params;
  if (!id?.trim()) throw new Error('缺少物料 ID');
  const prices = Object.fromEntries(
    Object.entries({ costPrice, unitPrice, guideMarkupRate }).filter(([, value]) => value != null && value !== '')
  );
  if (!Object.keys(prices).length) throw new Error('请至少填写一项价格信息');
  const response = await defHttp.post(
    { url: '/stock/material/updatePrice', params: { id, ...prices } },
    { isTransformResponse: false, successMessageMode: 'none' }
  );
  if (response?.success !== true) throw new Error(response?.message || '价格保存失败');
  return response.result;
}
