/** 不猜测公司归属：只接受唯一、类型明确的公司根节点。 */
export function resolveCompanyRoot(nodes: any[]) {
  if (!Array.isArray(nodes) || nodes.length !== 1) throw new Error('请先确认唯一的公司根节点，不能自动选择公司');
  const root = nodes[0];
  if (!root?.id || !['', '0'].includes(String(root.parentId ?? '')) || String(root.orgCategory) !== '1') {
    throw new Error('公司根节点配置不正确，请先核实组织结构');
  }
  return root;
}

export function departmentCreateValues(values: Record<string, any>, companyId: string) {
  if (!companyId) throw new Error('缺少所属公司，不能新增部门');
  const fields = Object.fromEntries(Object.entries(values).filter(([key]) =>
    ['departName', 'departNameAbbr', 'departOrder', 'mobile', 'fax', 'address', 'memo'].includes(key)));
  return { ...fields, parentId: companyId, orgCategory: '2' };
}
