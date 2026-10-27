import type { InstanceActions, WorkflowInstance } from './workflow.types';

export function visibleTaskButtons<T extends { value: string; label: string }>(
  buttons: T[], task: WorkflowInstance['tasks'][number], allowed: InstanceActions['tasks'][number] | undefined, businessType?: string
): T[] {
  return buttons.filter(action =>
    (!['APPROVE', 'REJECT', 'COMPLETE'].includes(action.value) || task.canHandle) &&
    allowed?.actions?.includes(action.value) &&
    (task.kind !== 'WORK' || !['APPROVE', 'REJECT'].includes(action.value)) &&
    (businessType !== 'PROJECT_CONTRACT' || action.value !== 'EDIT_DATA')
  );
}
