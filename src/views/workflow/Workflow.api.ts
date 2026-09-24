import { defHttp } from '/@/utils/http/axios';
import type {
  DirectoryEntry,
  InstanceForm,
  InstanceActions,
  PageResult,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowModel,
  WorkflowVersion,
  FormField,
  FieldPermission,
} from './workflow.types';

// Apifox 8679942，2026-09-22：显式校验业务结果，不以HTTP 200替代成功。
async function request<T>(method: 'get' | 'post', path: string, params?: object): Promise<T> {
  const response = await defHttp[method](
    { url: `/workflow/${path}`, ...(method === 'get' ? { params } : { data: params }) },
    { isTransformResponse: false, errorMessageMode: 'none', successMessageMode: 'none' }
  );
  if (!response || response.success !== true || response.code !== 200) throw new Error(response?.message || '审批服务返回异常，请稍后重试');
  return response.result as T;
}
export const listModels = (pageNo = 1, pageSize = 10) => request<PageResult<WorkflowModel>>('get', 'model/list', { pageNo, pageSize });
// The running backend uses primitive booleans; explicitly send optional defaults.
export function normalizeDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  const result = JSON.parse(JSON.stringify(definition)) as WorkflowDefinition;
  for (const field of result.formFields || []) field.required ??= false;
  for (const node of result.nodes) {
    node.allowSelf ??= false;
    for (const rule of node.approverRules || []) rule.includeChildren ??= false;
  }
  if (result.policy?.starters) result.policy.starters.includeChildren ??= false;
  for (const reader of result.policy?.readers || []) if (reader.audience) reader.audience.includeChildren ??= false;
  return result;
}
export const saveModel = (definition: WorkflowDefinition, revision?: number) =>
  request<WorkflowModel>('post', 'model/save', { definition: normalizeDefinition(definition), ...(revision == null ? {} : { revision }) });
export const publishModel = (key: string, revision: number) => request<WorkflowModel>('post', 'model/publish', { key, revision });
export const enableModel = (key: string, revision: number, enabled: boolean) =>
  request<WorkflowModel>('post', 'model/enable', { key, revision, enabled });
export const modelVersions = (key: string) => request<WorkflowVersion[]>('get', 'model/versions', { key });
export const operateModel = (data: {
  key: string;
  revision: number;
  operation: 'COPY' | 'ARCHIVE' | 'RESTORE' | 'ROLLBACK';
  newKey?: string;
  name?: string;
  version?: number;
}) => request<WorkflowModel>('post', 'model/operate', data);
export const directory = (kind: 'users' | 'roles' | 'departments' | 'positions', keyword = '', pageNo = 1, departmentId?: string) =>
  request<PageResult<DirectoryEntry>>('get', `directory/${kind}`, {
    keyword,
    pageNo,
    pageSize: 30,
    ...(kind === 'users' && departmentId ? { departmentId } : {}),
  });
export const availableModels = (pageNo = 1, pageSize = 10) =>
  request<PageResult<Pick<WorkflowModel, 'process_key' | 'name' | 'business_type' | 'published_version'>>>('get', 'model/available', {
    pageNo,
    pageSize,
  });
export const modelForm = (processKey: string) =>
  request<{
    processKey: string;
    name: string;
    businessType: string;
    version: number;
    fields: FormField[];
    fieldPermissions: Record<string, FieldPermission>;
  }>('get', 'model/form', { processKey });
export const previewModel = (processKey: string, data: object) => request<Record<string, unknown>>('post', 'model/preview', { processKey, data });
export const startInstance = (data: { processKey: string; businessId: string; requestId: string; data: object }) =>
  request<WorkflowInstance>('post', 'instance/start', data);
export const myInstances = (pageNo = 1) => request<PageResult<WorkflowInstance>>('get', 'instance/mine', { pageNo, pageSize: 10 });
export const myTasks = (pageNo = 1) => request<PageResult<WorkflowInstance['tasks'][number]>>('get', 'task/mine', { pageNo, pageSize: 10 });
export const instanceDetail = (instanceId: string) => request<WorkflowInstance>('get', 'instance/detail', { instanceId });
export const instanceActions = (instanceId: string) => request<InstanceActions>('get', 'instance/actions', { instanceId });
export const handleInstance = (data: {
  instanceId: string;
  taskId?: string;
  requestId: string;
  action: 'APPROVE' | 'REJECT' | 'WITHDRAW';
  comment?: string;
}) => request<WorkflowInstance>('post', 'instance/handle', data);
export async function uploadAttachment(file: File): Promise<{ id: string; fileName: string }> {
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('附件大小需为1字节至10MB');
  const response = await defHttp.uploadFile({ url: '/workflow/attachment/upload' }, { file, name: 'file' }, { isReturnResponse: true });
  const body = (response as any)?.data || response;
  if (body?.success !== true || body?.code !== 200 || !body?.result?.id) throw new Error(body?.message || '附件上传失败');
  return body.result;
}

export const instanceForm = (instanceId: string) => request<InstanceForm>('get', 'instance/form', { instanceId });
