import { defHttp } from '/@/utils/http/axios';

enum Api {
  list = '/implement/work/list',
  logList = '/implement/log/list',
  logDetail = '/implement/log/detail',
}

/**
 * 实施管理 - 工序分页列表
 */
export const implementList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 某工序的实施日志分页列表
 * @param params { workId, ... }
 */
export const logList = (params) => defHttp.get({ url: Api.logList, params });

/**
 * 单条实施日志详情
 * @param params { id }
 */
export const logDetail = (params) => defHttp.get({ url: Api.logDetail, params });
