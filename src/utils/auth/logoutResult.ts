/** 仅用于注销响应：会话已失效时，仍须完成本地退出。 */
export function isLogoutSessionInvalid(data: unknown, httpStatus?: number): boolean {
  if (httpStatus === 401) return true;
  // 网络错误、服务端故障及权限不足不能伪装成注销成功。
  if (httpStatus !== undefined && httpStatus !== 200) return false;
  if (!data || typeof data !== 'object') return false;
  const result = data as { code?: unknown; message?: unknown };
  if (result.code === 401 || result.code === '401') return true;
  return typeof result.message === 'string' && /^token无效[!！]?$/i.test(result.message.trim());
}
