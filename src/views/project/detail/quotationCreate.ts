export const QUOTATION_ADD_PERMISSION = 'plan:quotation:add';
export function canCreateProjectQuotation(status: unknown, departmentAllowed: boolean, hasPermission: (code: string) => boolean, priced?: unknown) {
  return String(priced) !== '1' && status === 'NOT_STARTED' && departmentAllowed && hasPermission(QUOTATION_ADD_PERMISSION);
}

export async function createProjectQuotation(periodId: string, name: string, deps: {
  allowed: () => boolean;
  readProject: (params: { periodId: string }) => Promise<any>;
  add: (params: { periodId: string; candidateName: string }) => Promise<any>;
}) {
  if (!periodId || !deps.allowed()) throw new Error('当前项目状态或权限不允许新增报价');
  const candidateName = name.trim();
  if (!candidateName || candidateName.length > 100) throw new Error('请填写100字以内的报价名称');
  const latest = await deps.readProject({ periodId });
  if (String(latest?.priced) === '1') throw new Error('该分期已有已定价报价单，不可新增报价，请刷新项目详情');
  if (!deps.allowed() || String(latest?.periodId) !== periodId || latest.status !== 'NOT_STARTED') throw new Error('项目状态已变化，仅未开始项目可新增报价');
  const created = await deps.add({ periodId, candidateName });
  if (!created?.id || String(created.periodId) !== periodId) throw new Error('创建响应缺少有效报价信息，请刷新报价列表确认，勿重复新增');
  return created;
}
