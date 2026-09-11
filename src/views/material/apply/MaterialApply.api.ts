import { defHttp } from '/@/utils/http/axios';

/**
 * 物料申请(出入库申请) - 接口定义
 * ⚠️ 路径与正式后端接口契约对齐(apifox)：
 *   出入库申请  /stock/apply/*（add 创建申请）
 *   普通物料选择/新增 /stock/material/*；项目领料候选 /project/materialAccount/page
 * 说明：文档无「类别树」接口，物料类别树由前端静态提供；无「保存草稿」接口，保存/发起申请均走 /stock/apply/add。
 * 新增请求不回传申请人、部门和项目展示字段；itemList 仅传 materialId/unitQty/unitName。
 */
enum Api {
  materialList = '/stock/material/list',
  materialAdd = '/stock/material/add',
  projectMaterialAccountPage = '/project/materialAccount/page',
  applyAdd = '/stock/apply/add',
}

/**
 * 物料选择列表(选物料抽屉表格)
 * @param params { pageNo, pageSize, materialName?, model?, brand?, materialCategory? }
 */
export const selectMaterialList = (params) => defHttp.get({ url: Api.materialList, params });

/**
 * 项目物料总账分页（项目领料候选）
 * @param params { periodId, keyword?, pageNo?, pageSize? }
 */
export const selectProjectMaterialAccountPage = (params) => defHttp.get({ url: Api.projectMaterialAccountPage, params });

/**
 * 新增物料(写入物料列表)
 * @param params 物料字段(StockMaterial)
 */
export const addMaterial = (params) => defHttp.post({ url: Api.materialAdd, params }, { successMessageMode: 'success' });

/**
 * 保存申请(创建出入库申请，后端落库)
 * @param params 主表单 + 明细 itemList
 */
export const saveApply = (params) => defHttp.post({ url: Api.applyAdd, params }, { successMessageMode: 'message' });

/**
 * 发起申请(创建出入库申请，后端按状态流转)
 * @param params 主表单 + 明细 itemList
 */
export const submitApply = (params) => defHttp.post({ url: Api.applyAdd, params }, { successMessageMode: 'message' });
