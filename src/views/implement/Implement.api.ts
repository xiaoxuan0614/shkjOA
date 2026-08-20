import { defHttp } from '/@/utils/http/axios';

/**
 * 实施管理 - 对接后端 /project/*(项目域)
 */
enum Api {
  // 项目工序列表
  list = '/project/process/list',
  // 实施记录列表
  logList = '/project/implementLog/list',
  // 实施记录详情
  logDetail = '/project/implementLog/queryById',
}

/**
 * 实施管理 - 工序分页列表
 * @param params { periodId?, pageNo, pageSize }
 */
export const implementList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 某分期的实施记录分页列表
 * @param params { periodId, pageNo, pageSize }
 */
export const logList = (params) => defHttp.get({ url: Api.logList, params });

/**
 * 单条实施记录详情
 * @param params { id }
 */
export const logDetail = (params) => defHttp.get({ url: Api.logDetail, params });
