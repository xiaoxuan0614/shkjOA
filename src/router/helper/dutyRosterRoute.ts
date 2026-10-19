export function needsDutyRosterDetailRoute(routes: { path: string; children?: any[] }[]): boolean {
  const paths = new Set<string>();
  function visit(rows: typeof routes, parent = '') {
    for (const row of rows) {
      const path = row.path.startsWith('/') ? row.path : `${parent}/${row.path}`;
      paths.add(path);
      if (row.children) visit(row.children, path);
    }
  }
  visit(routes);
  return paths.has('/operation/list') && !paths.has('/operation/detail');
}
