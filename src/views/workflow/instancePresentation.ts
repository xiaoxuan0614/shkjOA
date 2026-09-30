import type { InstanceActions, WorkflowInstance, WorkflowPerson } from './workflow.types';
export const processName = (instance: Pick<WorkflowInstance, 'processName'>) => instance.processName?.trim() || '流程名称暂不可用';
export const roundLabel = (latest?: boolean) => (latest === true ? '最新轮次' : latest === false ? '历史轮次' : '轮次状态暂不可用');
export function returnOptions(task?: InstanceActions['tasks'][number]) {
  if (!task?.actions?.includes('RETURN') || !Array.isArray(task.returnTargetOptions)) return [];
  return task.returnTargetOptions
    .filter((o) => typeof o.nodeKey === 'string' && !!o.nodeKey.trim() && typeof o.nodeName === 'string' && !!o.nodeName.trim())
    .map((o) => ({ value: o.nodeKey, label: o.nodeName }));
}

export function peopleNames(people?: WorkflowPerson[] | null): string {
  return (people || []).map(person => person.userName?.trim() || person.userId).filter(Boolean).join('、') || '—';
}
