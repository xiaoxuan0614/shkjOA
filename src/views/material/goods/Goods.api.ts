import { defHttp } from '/@/utils/http/axios';
import { useMessage } from '/@/hooks/web/useMessage';

const { createConfirm } = useMessage();

/**
 * 物料库存 - 接口定义
 *
 * ⚠️ 路径与正式后端接口契约对齐(mock 前缀 /stock/*，对应正式服务 /shouhuiApi/stock/*)：
 *    物料  /stock/material/list|queryById|add|edit|delete|deleteBatch
 *    台账  /stock/ioRecord/manualIn|manualOut   （库存变动走手动入库/出库，无直接改库存接口）
 *    generateCode 为 mock 专用辅助接口(正式后端物料编码由后端生成，前端仅作展示)
 */
enum Api {
  list = '/stock/material/list',
  queryById = '/stock/material/queryById',
  generateCode = '/stock/material/generateCode',
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
 * 自动生成物料编码（mock 专用；正式后端由后端生成）
 */
export const generateCode = (params?) => defHttp.get({ url: Api.generateCode, params });

/**
 * 删除单个
 */
export const deleteOne = (params, handleSuccess) => {
  return defHttp
    .delete({ url: Api.deleteOne, params }, { joinParamsToUrl: true })
    .then(() => {
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
      return defHttp
        .delete({ url: Api.deleteBatch, data: params }, { joinParamsToUrl: true })
        .then(() => {
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
  return defHttp.post({ url, params }, { successMessageMode: showTip ? 'success' : 'none' });
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
