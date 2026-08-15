import { defHttp } from '/@/utils/http/axios';
import { useMessage } from '/@/hooks/web/useMessage';

const { createConfirm } = useMessage();

enum Api {
  list = '/resource/vehicle/list',
  queryById = '/resource/vehicle/queryById',
  save = '/resource/vehicle/add',
  edit = '/resource/vehicle/edit',
  deleteOne = '/resource/vehicle/delete',
  deleteBatch = '/resource/vehicle/deleteBatch',
  // 详情页 3 类记录
  driveList = '/resource/vehicle/drive/list',
  fuelList = '/resource/vehicle/fuel/list',
  maintenanceList = '/resource/vehicle/maintenance/list',
}

/**
 * 车辆 - 分页列表
 */
export const list = (params) => defHttp.get({ url: Api.list, params });

/**
 * 车辆详情(详情页头部 + 编辑回显)
 */
export const queryById = (params) => defHttp.get({ url: Api.queryById, params });

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
 * 保存或更新
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

/**
 * 行车记录分页(车辆详情页)
 * @param params { vehicleId, ... }
 */
export const driveList = (params) => defHttp.get({ url: Api.driveList, params });

/**
 * 加油记录分页(车辆详情页)
 */
export const fuelList = (params) => defHttp.get({ url: Api.fuelList, params });

/**
 * 保养记录分页(车辆详情页)
 */
export const maintenanceList = (params) => defHttp.get({ url: Api.maintenanceList, params });
