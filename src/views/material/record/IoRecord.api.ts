import { defHttp } from '/@/utils/http/axios';

/**
 * 出入库台账 - 接口定义
 * ⚠️ 与正式后端接口契约对齐(apifox /stock/ioRecord)
 *   台账分页列表 /stock/ioRecord/list
 */
enum Api {
  list = '/stock/ioRecord/list',
}

/**
 * 出入库台账分页列表
 * @param params { pageNo, pageSize, materialId?, ioType?, sourceType? }
 *   sourceType: 台账来源过滤（apply申请/manual手动/stocktake盘存/purchase采购入库），盘存记录页固定传 stocktake
 */
export const list = (params) => defHttp.get({ url: Api.list, params });
