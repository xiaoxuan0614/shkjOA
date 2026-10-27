import type { WorkflowInstance } from './workflow.types';

// One opening's freshly fetched detail, not a shared or time-based cache.
export async function readInitialDetail(
  instanceId: string,
  initial: WorkflowInstance | undefined,
  fetchDetail: (id: string) => Promise<WorkflowInstance>
): Promise<WorkflowInstance> {
  const data = initial?.id === instanceId ? initial : await fetchDetail(instanceId);
  if (data.id !== instanceId) throw new Error('审批实例不匹配，请重新打开');
  // The drawer assigns fieldPermissions after loading its versioned form.
  return { ...data };
}
