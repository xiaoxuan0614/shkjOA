/** 候选状态、分期授权和整单版本规则；角色管理者资格由后端 permissions 决定。 */
export interface QuotationAccess {
  canApprove: boolean;
  canManage: boolean;
  canViewQuote?: boolean;
  canViewCost?: boolean;
  canViewRate?: boolean;
  canEditPrice: boolean;
  canExport: boolean;
  canRevise: boolean;
}
export const noQuotationAccess: QuotationAccess = { canApprove: false, canManage: false, canViewCost: false, canViewRate: false, canViewQuote: false, canEditPrice: false, canExport: false, canRevise: false };
export function canEditDraftQuotation(record: any, canEdit: boolean) {
  return !!record?.id && String(record.status) === '-1' && String(record.adopted) === '0' && canEdit;
}
/** Navigation intent is not authorization; use the freshly loaded record and edit capability. */
export function canContinueCreatedQuotation(query: Record<string, unknown>, record: any, canEdit: boolean) {
  return query.from === 'project-detail' && query.mode === 'edit' && query.continueCreated === '1'
    && !!record?.id && String(record.status) === '-1' && String(record.adopted) === '0' && canEdit;
}
export function isQuotationApplicant(record: any, user: any) {
  if (!record?.createBy) return false;
  const identities = [user?.username, user?.id, user?.userId].filter(Boolean).map(String);
  return identities.includes(String(record.createBy));
}

/** 列表判断菜单、提交人和业务状态；入口不代表分期授权，最终由详情及操作接口校验。 */
export function quotationListCapabilities(record: any, hasButton: (code: string) => boolean, user: any = {}) {
  const status = String(record?.status ?? '-1');
  const adopted = String(record?.adopted) === '1';
  const applicant = isQuotationApplicant(record, user);
  const allowed = (name: string) => record?.version != null && hasButton(`plan:quotation:${name}`);
  return {
    edit: allowed('edit') && ['-1', '0', '1'].includes(status),
    approve: allowed(record?.approvalRoute === 'MARKET' ? 'lock' : 'technicalApprove') && status === '2',
    price: record?.approvalRoute !== 'MARKET' && allowed('price') && status === '1',
    export: allowed('export') && status === '1' && String(record?.priced) === '1',
    submit: allowed('submit') && ['-1', '0'].includes(status),
    withdraw: allowed('withdraw') && applicant && status === '2',
    void: allowed('delete') && !adopted && ['-1', '0', '1'].includes(status),
  };
}
export function normalizeQuotationAccess(value: any): QuotationAccess {
  const canManage = value?.canManage === true;
  return {
    canManage,
    canRevise: value?.canRevise === true,
    canApprove: value?.canApprove === true,
    canViewQuote: value?.canViewQuote === true,
    canViewCost: value?.canViewCost === true,
    canViewRate: canManage && value?.canViewRate === true,
    canEditPrice: canManage || value?.canEditPrice === true,
    canExport: canManage || value?.canExport === true,
  };
}

/** 报价自身编辑不接受合同签订的价格修改授权；合同入口继续使用原能力判断。 */
export function quotationDetailCapabilities(record: any, access: QuotationAccess, user: any, hasButton: (code: string) => boolean) {
  return quotationCapabilities(record, { ...access, canEditPrice: false }, user, hasButton);
}

/** 明细字段独立判定；新建报价的成本录入不依赖不存在的候选单权限。 */
export function quotationDetailFields(record: any, access: QuotationAccess, creating = false, marketEntry = false) {
  return {
    cost: access.canManage || access.canViewCost === true || creating,
    rate: access.canManage,
    quote: access.canManage || access.canViewQuote === true || (creating && marketEntry),
  };
}
export function quotationVersion(value: unknown): number {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0)
    throw new Error('报价缺少有效版本号，请刷新并确认后端已更新');
  return Number(value);
}
export function assertQuotationVersion(record: any, latest: any) {
  if (quotationVersion(record.version) !== quotationVersion(latest.version)) throw new Error('报价已被修改，请刷新后核对内容再操作');
}
export function quotationCapabilities(record: any, access: QuotationAccess, user: any, hasButton: (code: string) => boolean = () => false) {
  const applicant = isQuotationApplicant(record, user);
  const status = String(record?.status ?? '-1');
  const adopted = String(record?.adopted) === '1';
  const content = access.canManage || access.canEditPrice || applicant;
  const edit = hasButton('plan:quotation:edit') && content && ['-1', '0', '1'].includes(status);
  return {
    edit,
    structure: edit && !adopted,
    editBase: edit && !adopted,
    submit: hasButton('plan:quotation:submit') && content && ['-1', '0'].includes(status),
    approve: access.canApprove && hasButton(record?.approvalRoute === 'MARKET' ? 'plan:quotation:lock' : 'plan:quotation:technicalApprove') && status === '2',
    withdraw: hasButton('plan:quotation:withdraw') && applicant && status === '2',
    void: hasButton('plan:quotation:delete') && content && !adopted && ['-1', '0', '1'].includes(status),
    price: hasButton('plan:quotation:price') && access.canManage && status === '1',
    export: hasButton('plan:quotation:export') && access.canExport && status === '1' && String(record?.priced) === '1',
  };
}
