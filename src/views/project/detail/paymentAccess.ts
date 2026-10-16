/** 复用回款管理菜单授权及现有财务身份范围；身份未加载时不试探请求。 */
export function canViewPaymentTab(userId: string, roles: string[], menus: { path: string; children?: any[] }[]) {
  if (!userId || !roles.some(role => role === 'admin' || role === 'finance_staff')) return false;
  const containsPayment = (items: typeof menus, parent = ''): boolean => items.some(item => {
    const path = (item.path.startsWith('/') ? item.path : `${parent}/${item.path}`).replace(/\/+$/, '');
    return path === '/payment/list' || containsPayment(item.children || [], path);
  });
  return containsPayment(menus);
}
