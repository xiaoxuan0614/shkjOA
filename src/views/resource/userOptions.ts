import { defHttp } from '/@/utils/http/axios';

/**
 * 用户选择器 - 加载全量用户选项(支持前端模糊查询)
 * 供客户(销售/维保/客户经理)、供应商(对接人)等选择负责人用
 */
export interface UserOption {
  label: string;
  value: string;
  username?: string;
  phone?: string;
}

let userOptionsCache: UserOption[] | null = null;

function parseUserPage(payload: any) {
  let page = payload;
  for (let depth = 0; depth < 3 && page?.result && !Array.isArray(page) && !Array.isArray(page.records); depth += 1) {
    page = page.result;
  }
  const records = Array.isArray(page) ? page : page?.records || page?.list || page?.data?.records || [];
  const size = Number(page?.size || page?.pageSize || records.length || 1);
  const total = Number(page?.total || records.length);
  return {
    records: Array.isArray(records) ? records : [],
    current: Number(page?.current || page?.pageNo || 1),
    pages: Number(page?.pages || Math.ceil(total / size) || 1),
  };
}

/**
 * 加载全部系统用户。首次请求后根据后端分页信息补齐剩余页；force=true 时跳过缓存重新加载。
 */
export async function loadUserOptions(force = false): Promise<UserOption[]> {
  if (!force && userOptionsCache?.length) return userOptionsCache;

  const pageSize = 1000;
  const firstPayload: any = await defHttp.get({ url: '/sys/user/list', params: { pageNo: 1, pageSize } });
  const firstPage = parseUserPage(firstPayload);
  const totalPages = Math.min(Math.max(firstPage.pages, 1), 100);
  const remainingPages =
    totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            defHttp.get({ url: '/sys/user/list', params: { pageNo: index + 2, pageSize } }).then(parseUserPage)
          )
        )
      : [];
  const users = [...firstPage.records, ...remainingPages.flatMap((page) => page.records)];
  const seen = new Set<string>();
  const options = users
    .map((user: any) => {
      const value = user.id ?? user.userId;
      const label = user.realname ?? user.realName ?? user.nickname ?? user.username ?? user.name;
      const username = user.username ?? user.userName ?? user.account;
      const phone = user.phone ?? user.mobile ?? user.mobilePhone;
      return value == null || label == null
        ? null
        : {
            label: String(label),
            value: String(value),
            ...(username == null ? {} : { username: String(username) }),
            ...(phone == null ? {} : { phone: String(phone) }),
          };
    })
    .filter((option): option is UserOption => {
      if (!option || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });

  if (options.length) userOptionsCache = options;
  return options;
}
