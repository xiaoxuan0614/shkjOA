/** 字典值允许数字回显，提交统一为字符串。 */
export const isProjectPurchase = (value: unknown) => String(value ?? '') === '1';

/** 编辑时省略关联字段会保留旧关联，必须用空字符串明确清除。 */
export function purchaseProjectPayload(values: Record<string, any>, projectId: string, editing: boolean) {
  if (isProjectPurchase(values.purchaseType)) {
    return { projectId, periodId: values.periodId, projectName: values.projectName };
  }
  return editing ? { projectId: '', periodId: '' } : {};
}
