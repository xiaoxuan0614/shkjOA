import { defHttp } from '/@/utils/http/axios';
import type { UserOption } from './userOptions';

const roleCode = 'project_management';
export async function loadProjectManagerOptions(): Promise<UserOption[]> {
  const roles: any = await defHttp.get({ url: '/sys/role/list', params: { roleCode, pageNo: 1, pageSize: 100 } });
  const matches = (roles?.records || []).filter((role: any) => role.roleCode === roleCode && role.id);
  if (matches.length !== 1) throw new Error('未能确认项目经理角色，请检查角色配置');
  const roleId = matches[0].id;
  const options = new Map<string, UserOption>();
  for (let pageNo = 1; pageNo <= 100; pageNo++) {
    const page: any = await defHttp.get({ url: '/sys/user/userRoleList', params: { roleId, pageNo, pageSize: 100 } });
    if (!Array.isArray(page?.records)) throw new Error('项目经理列表返回异常，请重试');
    for (const user of page.records) {
      if (user.id && (user.realname || user.username)) options.set(String(user.id), {
        value: String(user.id), label: user.realname || user.username, username: user.username,
      });
    }
    const total = Number(page.total);
    if (Number.isFinite(total) ? pageNo * 100 >= total : page.records.length < 100) return [...options.values()];
  }
  throw new Error('项目经理列表页数超限，请联系管理员');
}
