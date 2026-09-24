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
