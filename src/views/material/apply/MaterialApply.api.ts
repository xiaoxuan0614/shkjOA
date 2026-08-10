import { defHttp } from '/@/utils/http/axios';

enum Api {
  categoryTree = '/material/categoryTree',
  selectList = '/material/selectList',
  save = '/material/apply/save',
  submit = '/material/apply/submit',
  addMaterial = '/material/add',
}

/**
 * 大类树(添加用料抽屉左侧)
 */
export const getCategoryTree = (params?) =>
  defHttp.get({ url: Api.categoryTree, params });

/**
 * 物料选择列表(添加用料抽屉表格)
 * @param params { pageNo, pageSize, categoryCode?, name?, model?, brand? }
 */
export const selectMaterialList = (params) =>
  defHttp.get({ url: Api.selectList, params });

/**
 * 新增物料(写入物料列表)
 * @param params 物料字段
 */
export const addMaterial = (params) =>
  defHttp.post({ url: Api.addMaterial, params }, { successMessageMode: 'success' });

/**
 * 保存申请
 * @param params 主表单 + 明细数组
 */
export const saveApply = (params) =>
  defHttp.post({ url: Api.save, params }, { successMessageMode: 'message' });

/**
 * 发起申请
 * @param params 主表单 + 明细数组
 */
export const submitApply = (params) =>
  defHttp.post({ url: Api.submit, params }, { successMessageMode: 'message' });
