/** 新建页仅预览线路；主单创建后始终以后端固定的 approvalRoute 为准。 */
export function previewQuotationRoute(departmentIds: string[], tree: any[]): string {
  const all: any[] = [];
  const visit = (rows: any[]) => rows.forEach(row => { all.push(row); visit(row.children || []); });
  visit(tree);
  const member = (name: string) => {
    const matches = all.filter(row => String(row.departName ?? row.title ?? '').trim() === name
      && String(row.delFlag ?? '0') === '0' && (row.status == null || String(row.status) === '1'));
    return matches.length === 1 && departmentIds.includes(String(matches[0].id));
  };
  return member('技术部') ? 'TECHNICAL' : member('市场部') ? 'MARKET' : '';
}
