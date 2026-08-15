import { defHttp } from '/@/utils/http/axios';
import { useMessage } from '/@/hooks/web/useMessage';

const { createConfirm } = useMessage();

/**
 * 供应商管理 - 接口定义
 * ⚠️ 与正式后端接口契约对齐(apifox /project/supplier)：供应商挂 /project/supplier 下
 */
enum Api {
  list = '/project/supplier/list',
  save = '/project/supplier/add',
  edit = '/project/supplier/edit',
  deleteOne = '/project/supplier/delete',
  deleteBatch = '/project/supplier/deleteBatch',
}

/**
 * 供应商 - 分页列表
 */
export const list = (params) => defHttp.get({ url: Api.list, params });

/**
 * 新增
 */
export const save = (params) =>
  defHttp.post({ url: Api.save, params }, { successMessageMode: 'success' });

/**
 * 编辑
 */
export const edit = (params) =>
  defHttp.post({ url: Api.edit, params }, { successMessageMode: 'success' });

/**
 * 保存或更新(新增/编辑弹窗统一入口)
 */
export const saveOrUpdate = (params, isUpdate) => (isUpdate ? edit(params) : save(params));

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
      return defHttp
        .delete({ url: Api.deleteBatch, data: params }, { joinParamsToUrl: true })
        .then(() => {
          handleSuccess();
        });
    },
  });
};
