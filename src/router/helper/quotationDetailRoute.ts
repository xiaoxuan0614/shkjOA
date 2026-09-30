/** BACK模式不会加载modules/plan.ts；为已有项目/报价入口补齐共享隐藏详情页。 */
export function needsQuotationDetailRoute(routes: { path: string; children?: any[] }[]): boolean {
  const paths: string[] = [];
  function visit(rows: { path: string; children?: any[] }[], parent = '') {
    rows.forEach(row => {
      const path = row.path.startsWith('/') ? row.path : `${parent}/${row.path}`;
      paths.push(path);
      if (row.children) visit(row.children, path);
    });
  }
  visit(routes);
  return !paths.includes('/plan/material-draft/editor') && paths.some(path =>
    path === '/plan/material-draft' || path.startsWith('/project/detail/')
  );
}

/** 待办可直达合同页；菜单未返回隐藏页时补路由，业务权限仍由合同页校验。 */
export function needsContractDetailRoute(routes: { path: string; children?: any[] }[], parent = ''): boolean {
  return !routes.some(row => {
    const path = row.path.startsWith('/') ? row.path : `${parent}/${row.path}`;
    return path === '/project/contract' || (row.children && !needsContractDetailRoute(row.children, path));
  });
}

/** Personal workflow access is authorized by instance/task identity, not project menus. */
export function needsWorkflowApplicationsRoute(routes: { path: string; children?: any[] }[], parent = ''): boolean {
  return !routes.some(row => {
    const path = row.path.startsWith('/') ? row.path : `${parent}/${row.path}`;
    return path === '/workflow/applications' || (row.children && !needsWorkflowApplicationsRoute(row.children, path));
  });
}
