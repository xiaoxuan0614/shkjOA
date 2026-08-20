import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';

/**
 * 参与人员邀约(站内待办) mock
 * 前缀: /jeecgboot
 *   POST /project/plan/invitation/add      发送邀约(状态=已邀请)
 *   GET  /project/plan/invitation/list     邀约列表
 *   POST /project/plan/invitation/accept   同意(状态=已同意)
 *   POST /project/plan/invitation/reject   拒绝(状态=已拒绝)
 */

const invitations: any[] = [];
let inviteSeq = 1;

export default [
  {
    url: `${sysUrl}/project/plan/invitation/add`,
    timeout: 100,
    method: 'post',
    response: ({ body }) => {
      const item = {
        ...body,
        id: `invite_${inviteSeq++}`,
        inviterName: '管理员',
        status: '0',
        createTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      };
      invitations.unshift(item);
      return resultSuccess(item, { message: '邀约已发送' });
    },
  },
  {
    url: `${sysUrl}/project/plan/invitation/list`,
    timeout: 100,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10 } = query;
      return resultPageSuccess(pageNo, pageSize, invitations);
    },
  },
  {
    url: `${sysUrl}/project/plan/invitation/accept`,
    timeout: 100,
    method: 'post',
    response: ({ body }) => {
      const it = invitations.find((i) => String(i.id) === String(body.id));
      if (it) it.status = '1';
      return resultSuccess(null, { message: '已同意' });
    },
  },
  {
    url: `${sysUrl}/project/plan/invitation/reject`,
    timeout: 100,
    method: 'post',
    response: ({ body }) => {
      const it = invitations.find((i) => String(i.id) === String(body.id));
      if (it) it.status = '0';
      return resultSuccess(null, { message: '已拒绝' });
    },
  },
  // 项目成员列表(现场负责人下拉: 传 periodId + inviteStatus=1)
  {
    url: `${sysUrl}/project/member/list`,
    timeout: 100,
    method: 'get',
    response: ({ query }) => {
      const { inviteStatus, pageNo = 1, pageSize = 100 } = query;
      const members = [
        { id: 'm1', memberName: '张三', userName: '张三', inviteStatus: '1' },
        { id: 'm2', memberName: '李四', userName: '李四', inviteStatus: '1' },
        { id: 'm3', memberName: '王五', userName: '王五', inviteStatus: '0' },
        { id: 'm4', memberName: '赵六', userName: '赵六', inviteStatus: '1' },
      ];
      const data = inviteStatus != null ? members.filter((m) => String(m.inviteStatus) === String(inviteStatus)) : members;
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
] as MockMethod[];
