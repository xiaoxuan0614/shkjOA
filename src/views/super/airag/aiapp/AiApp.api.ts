/**
 * AI应用(AiApp) API —— 供 @jeecg/aiflow 编排流程使用
 */
import { defHttp } from '/@/utils/http/axios';

enum Api {
  // AI应用
  list = '/airag/aiapp/list',
  add = '/airag/aiapp/add',
  edit = '/airag/aiapp/edit',
  delete = '/airag/aiapp/delete',
  queryById = '/airag/aiapp/queryById',
  // 知识库
  queryKnowledgeBathById = '/airag/knowledge/queryById',
}

/**
 * AI应用列表
 */
export const queryAiAppList = (params) => {
  return defHttp.get({ url: Api.list, params });
};

/**
 * AI应用详情
 */
export const queryById = (id) => {
  return defHttp.get({ url: `${Api.queryById}/${id}` });
};

/**
 * 知识库详情
 */
export const queryKnowledgeBathById = (id) => {
  return defHttp.get({ url: `${Api.queryKnowledgeBathById}/${id}` });
};
