import { defHttp } from '/@/utils/http/axios';
import { useMessage } from '/@/hooks/web/useMessage';

const { createConfirm } = useMessage();

/**
 * 外协单位 - 接口定义
 * ⚠️ 对齐 apifox /project/outsourcingUnit(OaOutsourcingUnit):
 *    list/add/edit/delete/deleteBatch/queryById
 */
enum Api {
  list = '/project/outsourcingUnit/list',
  save = '/project/outsourcingUnit/add',
  edit = '/project/outsourcingUnit/edit',
  deleteOne = '/project/outsourcingUnit/delete',
  deleteBatch = '/project/outsourcingUnit/deleteBatch',
  detail = '/project/outsourcingUnit/queryById',
}

/**
 * 外协单位 - 分页列表
 * query: unitCode / unitName / status / pageNo / pageSize
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
 * 删除单个(query: id)
 */
export const deleteOne = (params, handleSuccess) => {
  return defHttp.delete({ url: Api.deleteOne, params }, { joinParamsToUrl: true }).then(() => {
    handleSuccess();
  });
};

/**
 * 批量删除(query: ids, 逗号分隔字符串)
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
        .delete(
          { url: Api.deleteBatch, params: { ids: (params.ids || []).join(',') } },
          { joinParamsToUrl: true }
        )
        .then(() => {
          handleSuccess();
        });
    },
  });
};

/**
 * 详情(query: id)
 */
export const detail = (params) => defHttp.get({ url: Api.detail, params });
