export interface WorkflowCondition {
  field: string;
  operator: string;
  value: string;
}
export interface WorkflowPredicate {
  junction: 'AND' | 'OR';
  conditions?: WorkflowCondition[];
  children?: WorkflowPredicate[];
}
export interface WorkflowStage {
  key: string;
  kind: 'TASK' | 'SEQUENCE' | 'PARALLEL' | 'EXCLUSIVE' | 'SUBPROCESS';
  nodeKey?: string;
  condition?: WorkflowPredicate;
  children?: WorkflowStage[];
}
export interface InstanceForm {
  instanceId: string;
  processKey: string;
  businessType: string;
  version: number;
  fields: FormField[];
  fieldPermissions: Record<string, FieldPermission>;
}
export type FieldPermission = 'HIDDEN' | 'READ_ONLY' | 'EDITABLE';
export interface Audience {
  userIds?: string[];
  roleIds?: string[];
  departmentIds?: string[];
  positionIds?: string[];
  includeChildren?: boolean;
}
export interface FormField {
  key: string;
  name: string;
  type: string;
  required?: boolean;
}
export interface ApprovalRule {
  type: 'DEPARTMENT_MEMBERS' | 'DEPARTMENT_HEADS' | 'INITIATOR_DEPARTMENT_HEADS' | 'DIRECT_SUPERVISOR' | 'POSITION_USERS';
  departmentIds?: string[];
  positionIds?: string[];
  includeChildren?: boolean;
}
export interface WorkflowNode {
  key: string;
  name: string;
  userIds?: string[];
  roleIds?: string[];
  excludedUserIds?: string[] | null;
  allowSelf?: boolean;
  approverRules?: ApprovalRule[];
  fieldPermissions?: Record<string, FieldPermission>;
  condition?: { field: string; operator: string; value: string };
  options?: {
    mode?: string;
    threshold?: number;
    predicate?: WorkflowPredicate;
    timeoutMinutes?: number;
    escalationUserIds?: string[];
    ccUserIds?: string[];
  };
}
export interface WorkflowDefinition {
  key: string;
  name: string;
  businessType: string;
  nodes: WorkflowNode[];
  formFields?: FormField[];
  stages?: WorkflowStage[] | null;
  policy?: {
    starters?: Audience;
    readers?: { audience: Audience; scope: string }[];
    fields?: Record<string, FieldPermission>;
    initiatorFields?: Record<string, FieldPermission>;
  };
}
export interface WorkflowModel {
  process_key: string;
  name: string;
  business_type: string;
  draft_json: string;
  revision: number;
  published_version: number;
  enabled: number;
  archived: number;
  owner_id?: string;
  department_id?: string;
  managers_json?: string;
  updated_by?: string;
  updated_at?: string | number;
}
export interface WorkflowVersion {
  id: string;
  version_no: number;
  definition_json: string;
  published_by: string;
  published_at: string | number;
}
export interface PageResult<T> {
  records: T[];
  total: number;
  pageNo: number;
  pageSize: number;
}
export interface DirectoryEntry {
  id: string;
  name?: string;
  username?: string;
  code?: string;
  parent_id?: string | null;
}
export interface WorkflowInstance {
  id: string;
  processKey: string;
  businessType: string;
  businessId: string;
  version: number;
  status: string;
  initiatorId: string;
  roundNo: number;
  snapshot: Record<string, unknown>;
  tasks: { id: string; name: string; nodeKey: string; instanceId: string; canHandle: boolean }[];
  history: { actor_id: string; actor_name?: string; action: string; node_name?: string; comment_text?: string; created_at: string | number }[];
  fieldPermissions: Record<string, FieldPermission>;
}
export interface InstanceActions {
  tasks: { taskId: string; actions: string[]; disabledActions?: Record<string, string>; reason?: string; members?: Record<string, unknown>[] }[];
  canWithdraw: boolean;
  withdrawReason?: string;
}
