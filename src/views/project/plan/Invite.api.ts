import { defHttp } from '/@/utils/http/axios';

/**
 * 参与人员邀约(站内待办) - 接口定义
 * ⚠️ 后端待提供正式接口, 当前按约定挂 /project/plan/invitation/*
 */
enum Api {
  add = '/project/plan/invitation/add',
  list = '/project/plan/invitation/list',
  accept = '/project/plan/invitation/accept',
  reject = '/project/plan/invitation/reject',
}

/**
 * 发送邀约
 * @param params { periodId, memberId, memberName }
 */
export const addInvitation = (params) =>
  defHttp.post({ url: Api.add, params }, { successMessageMode: 'success' });

/**
 * 我的邀约列表(站内待办: 当前用户收到/发出的)
 */
export const invitationList = (params) => defHttp.get({ url: Api.list, params });

/**
 * 同意邀约
 */
export const acceptInvitation = (params) =>
  defHttp.post({ url: Api.accept, params }, { successMessageMode: 'success' });

/**
 * 拒绝邀约
 */
export const rejectInvitation = (params) =>
  defHttp.post({ url: Api.reject, params }, { successMessageMode: 'success' });
