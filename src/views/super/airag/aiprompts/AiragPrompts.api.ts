/**
 * AI提示词(AiragPrompts) API —— 供 @jeecg/aiflow 编排流程使用
 */
import { defHttp } from '/@/utils/http/axios';

enum Api {
  list = '/airag/prompts/list',
  queryById = '/airag/prompts/queryById',
}

/**
 * 提示词列表
 */
export const queryList = (params) => {
  return defHttp.get({ url: Api.list, params });
};

/**
 * 提示词详情
 */
export const queryById = (id) => {
  return defHttp.get({ url: `${Api.queryById}/${id}` });
};
