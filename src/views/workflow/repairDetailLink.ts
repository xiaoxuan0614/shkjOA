import type { WorkflowInstance } from './workflow.types';

export function repairApprovalOrderId(instance: WorkflowInstance | undefined, visible: Record<string, unknown>): string {
  if (instance?.businessType !== 'REPAIR_OPS_APPLICATION') return '';
  // businessId identifies the business application, not the repair order.
  if (instance.fieldPermissions?.orderId === 'HIDDEN') return '';
  return typeof visible.orderId === 'string' ? visible.orderId.trim() : '';
}
