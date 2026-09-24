import { defHttp } from '/@/utils/http/axios';
import { getImplementProjectStatusFilter } from './implementScope';
import { normalizeProjectListParams } from '../project/projectListFilters';

/**
 * 实施管理 - 对接后端 /project/*(项目域)
 */
enum Api {
  // 项目分期列表（实施管理首页按项目分期展示）
  projectList = '/project/project/projectPeriodList',
  // 项目分期详情
  projectDetail = '/project/project/projectPeriodDetail',
  // 整份实施计划及全部工序
  processDetail = '/project/process/detail',
  // 实施记录列表
  logList = '/project/implementLog/list',
  // 实施记录详情
  logDetail = '/project/implementLog/queryById',
}

/**
 * 实施管理 - 项目分期分页列表
 * @param params { projectName?, periodName?, customerName?, projectType?, status?, pageNo, pageSize }
 */
export const implementProjectList = (params = {}) =>
  defHttp.get({ url: Api.projectList, params: normalizeProjectListParams({ ...params, status: getImplementProjectStatusFilter((params as Record<string, unknown>).status) }) });

/** 项目分期基本信息。 */
export const implementProjectDetail = (params: { periodId: string }) => defHttp.get({ url: Api.projectDetail, params });

/** 当前项目分期的整份实施计划及全部有效工序。 */
export const implementProcessDetail = (params: { periodId: string }) => defHttp.get({ url: Api.processDetail, params });

/**
 * 实施记录分页列表；当前页面按 processId 加载对应工序日志。
 * @param params { processId, pageNo, pageSize }
 */
export const logList = (params) => defHttp.get({ url: Api.logList, params });

/**
 * 单条实施记录详情
 * @param params { id }
 */
export const logDetail = (params) => defHttp.get({ url: Api.logDetail, params });
