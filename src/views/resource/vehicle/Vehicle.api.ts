import { defHttp } from '/@/utils/http/axios';

export const list = (params) => defHttp.get({ url: '/vehicle/list', params });
export const queryById = (params) => defHttp.get({ url: '/vehicle/queryById', params });
export const saveOrUpdate = (values, isUpdate) => {
  // 只提交可维护字段，状态及最近使用时间由后端管理。
  const params = {
    ...(isUpdate ? { vehicleId: values.vehicleId } : {}),
    plateNumber: values.plateNumber?.trim(),
    principal: values.principal?.trim(),
    ...(values.driveMode ? { driveMode: values.driveMode } : {}),
    ...(values.currentMileage != null && values.currentMileage !== '' ? { currentMileage: values.currentMileage } : {}),
  };
  return defHttp.post({ url: isUpdate ? '/vehicle/edit' : '/vehicle/add', params }, { successMessageMode: 'success' });
};
export const deleteOne = (params, handleSuccess) =>
  defHttp.delete({ url: '/vehicle/delete', params }, { joinParamsToUrl: true, successMessageMode: 'success' }).then(handleSuccess);
export const driveList = (params) => defHttp.get({ url: '/vehicle/drive/list', params });
export const fuelList = (params) => defHttp.get({ url: '/vehicle/refuel/list', params });
export const maintenanceList = (params) => defHttp.get({ url: '/vehicle/maintain/list', params });
export const driveDetail = (params) => defHttp.get({ url: '/vehicle/drive/queryById', params });
export const fuelDetail = (params) => defHttp.get({ url: '/vehicle/refuel/queryById', params });
export const maintenanceDetail = (params) => defHttp.get({ url: '/vehicle/maintain/queryById', params });
