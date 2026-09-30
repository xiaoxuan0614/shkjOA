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
  userIds?: string[] | null;
  roleIds?: string[] | null;
  departmentIds?: string[] | null;
  positionIds?: string[] | null;
  includeChildren?: boolean;
}
export interface FormField {
  key: string;
  name: string;
  type: string;
  required?: boolean;
}
export interface ApprovalRule {
  fieldKey?: string;
  levels?: number;
  type:
    | 'DEPARTMENT_MEMBERS'
    | 'DEPARTMENT_HEADS'
    | 'INITIATOR_DEPARTMENT_HEADS'
    | 'DIRECT_SUPERVISOR'
    | 'POSITION_USERS'
    | 'FORM_USERS'
    | 'SUPERVISOR_CHAIN'
    | 'INITIATOR';
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
    behavior?: NodeBehavior;
    mode?: string;
    threshold?: number;
    predicate?: WorkflowPredicate;
    timeoutMinutes?: number;
    escalationUserIds?: string[];
    ccUserIds?: string[];
  };
}
export interface WorkflowDefinition {
  settings?: WorkflowSettings;
  key: string;
  name: string;
  businessType: string;
  nodes: WorkflowNode[];
  formFields?: FormField[];
  stages?: WorkflowStage[] | null;
  policy?: {
    starters?: Audience | null;
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
  updated_by_name?: string | null;
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
export interface WorkflowPerson {
  userId: string;
  userName?: string | null;
}
export interface WorkflowInstance {
  processName?: string;
  latestRound?: boolean;
  rootInstanceId?: string;
  previousInstanceId?: string | null;
  id: string;
  processKey: string;
  businessType: string;
  businessId: string;
  version: number;
  status: string;
  initiatorId: string;
  initiatorName?: string | null;
  handledUsers?: WorkflowPerson[];
  roundNo: number;
  title?: string;
  canResubmit?: boolean;
  snapshot: Record<string, unknown>;
  tasks: {
    id: string;
    name: string;
    nodeKey: string;
    instanceId: string;
    canHandle: boolean;
    pendingUsers?: WorkflowPerson[];
    kind?: 'APPROVAL' | 'CC' | 'NOTICE' | 'WORK';
    description?: string;
  }[];
  history: { actor_id: string; actor_name?: string; action: string; node_name?: string; comment_text?: string; created_at: string | number }[];
  fieldPermissions: Record<string, FieldPermission>;
}
export interface InstanceActions {
  tasks: {
    taskId: string;
    actions: string[];
    disabledActions?: Record<string, string>;
    reason?: string;
    members?: Record<string, unknown>[];
    returnTargets?: string[];
    returnTargetOptions?: { nodeKey: string; nodeName: string }[];
    editableFields?: string[];
    removableUserIds?: string[];
  }[];
  canResubmit?: boolean;
  resubmitReason?: string;
  canWithdraw: boolean;
  withdrawReason?: string;
}

export interface NodeBehavior {
  kind?: 'APPROVAL' | 'CC' | 'NOTICE' | 'WORK';
  autoApprove?: boolean;
  emptyApprover?: 'FAIL' | 'AUTO_APPROVE' | 'TRANSFER';
  fallbackUserId?: string;
  returnMode?: 'PREVIOUS' | 'START' | 'DISABLED';
  buttons?: Record<string, boolean>;
  notificationDelayMinutes?: number;
  notificationTemplate?: string;
  channels?: string[];
  description?: string;
  callbackEnabled?: boolean;
}
export interface WorkflowSettings {
  notifications?: Record<string, boolean>;
  channels?: string[];
  reminderHours?: number[];
  withdrawMode?: 'ANYTIME' | 'BEFORE_FIRST_APPROVAL' | 'DISABLED';
  duplicateApproval?: 'EVERY_NODE' | 'APPROVED_BEFORE' | 'CONSECUTIVE';
  undefinedInitiatorOption?: boolean;
  autoCompleteNextMonthDay?: number | null;
}
export interface DesignerCapabilities {
  nodeKinds: string[];
  channels: string[];
  disabledFeatures: Record<string, string>;
  designerMaxChars: number;
  definitionMaxChars: number;
}
export interface DesignerDraft {
  process_key: string;
  name: string;
  document: {
    schemaVersion?: number;
    definition?: WorkflowDefinition;
    nodes?: import('./designer/graph').DesignNode[];
    step?: number;
    modelRevision?: number | null;
    [key: string]: unknown;
  };
  revision: number;
  owner_id?: string;
  updated_by?: string;
  updated_at?: string | number;
}
