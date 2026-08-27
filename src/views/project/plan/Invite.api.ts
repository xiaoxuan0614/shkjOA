import { defHttp } from '/@/utils/http/axios';

/** 参与人员邀请（当前登录用户）。 */
enum Api {
  list = '/project/member/myInvitations',
  respond = '/project/member/respond',
}

/** 当前用户尚未处理的项目成员邀请。 */
export const invitationList = (params?: { pageNo?: number; pageSize?: number }) => defHttp.get({ url: Api.list, params });

/** 处理邀请：inviteStatus=1 接受，0 拒绝。 */
export const respondInvitation = (params: { memberId: string; inviteStatus: '0' | '1' }) => defHttp.post({ url: Api.respond, params });
