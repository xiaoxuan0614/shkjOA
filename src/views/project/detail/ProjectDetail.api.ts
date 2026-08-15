import { defHttp } from '/@/utils/http/axios';

enum Api {
  detail = '/project/detail',
  basic = '/project/detail/basic',
  plan = '/project/detail/plan',
  member = '/project/detail/member',
  position = '/project/detail/position',
  implement = '/project/detail/implement',
  implementLog = '/project/detail/implement/log',
  acceptance = '/project/detail/acceptance',
  acceptanceSave = '/project/detail/acceptance/save',
  file = '/project/detail/file',
  material = '/project/detail/material',
  activity = '/project/detail/activity',
}

/**
 * 项目基本信息(详情页头部 + 基本信息 tab 共用)
 */
export const getProjectBasic = (params) => defHttp.get({ url: Api.detail, params });

/**
 * 计划方案 tab(实施计划 + 进度安排 + 人员配置)
 */
export const getPlan = (params) => defHttp.get({ url: Api.plan, params });

/**
 * 项目成员 tab
 */
export const getMembers = (params) => defHttp.get({ url: Api.member, params });

/**
 * 实施位置 tab
 */
export const getPositions = (params) => defHttp.get({ url: Api.position, params });

/**
 * 实施记录 tab
 */
export const getImplementRecords = (params) => defHttp.get({ url: Api.implement, params });

/**
 * 实施记录-查看日志
 */
export const getImplementLog = (params) => defHttp.get({ url: Api.implementLog, params });

/**
 * 验收记录 tab
 */
export const getAcceptance = (params) => defHttp.get({ url: Api.acceptance, params });

/**
 * 保存内部验收信息(负责人/日期/照片)
 */
export const saveAcceptance = (params) => defHttp.post({ url: Api.acceptanceSave, params });

/**
 * 项目文件 tab
 */
export const getFiles = (params) => defHttp.get({ url: Api.file, params });

/**
 * 用料清单 tab
 */
export const getMaterials = (params) => defHttp.get({ url: Api.material, params });

/**
 * 项目动态(右侧时间线)
 */
export const getActivities = (params) => defHttp.get({ url: Api.activity, params });
