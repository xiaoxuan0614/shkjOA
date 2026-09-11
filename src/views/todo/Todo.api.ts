import { defHttp } from '/@/utils/http/axios';

enum Api {
  page = '/sys/todo/page',
  summary = '/sys/todo/summary',
}

export const getMyTodoPage = (params?: Recordable) => defHttp.get({ url: Api.page, params });
export const getMyTodoSummary = () => defHttp.get({ url: Api.summary });
