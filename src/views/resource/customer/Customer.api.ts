import { defHttp } from '/@/utils/http/axios';
import { useMessage } from '/@/hooks/web/useMessage';

const { createConfirm } = useMessage();

enum Api {
  // ⚠️ 与正式后端接口契约对齐：客户管理挂在 /project/customer 下(apifox 文档)
  list = '/project/customer/list',
  save = '/project/customer/add',
  edit = '/project/customer/edit',
  deleteOne = '/project/customer/delete',
  deleteBatch = '/project/customer/deleteBatch',
}

/**
 * 往来客户 - 分页列表
 * @param params 搜索条件 + 分页
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
 * @param params { ids }
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
