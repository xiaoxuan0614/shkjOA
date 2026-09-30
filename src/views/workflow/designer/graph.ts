import { newId, newNode } from '../workflow';
import type { WorkflowNode, WorkflowStage, WorkflowDefinition, WorkflowPredicate } from '../workflow.types';
export type NodeKind = 'APPROVAL' | 'CC' | 'CONDITION' | 'PARALLEL' | 'NOTICE' | 'TASK' | 'SEQUENCE' | 'SUBPROCESS';
export interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}
export interface DesignBranch {
  id: string;
  name: string;
  fallback?: boolean;
  groups: ConditionRow[][];
  children: DesignNode[];
  predicate?: WorkflowPredicate;
  originalGroups?: string;
  wrapper?: boolean;
}
export interface DesignNode {
  id: string;
  kind: NodeKind;
  name: string;
  approval?: WorkflowNode;
  stageCondition?: WorkflowPredicate;
  branches?: DesignBranch[];
  config: {
    source?: string;
    users?: string[];
    field?: string;
    channels?: string[];
    template?: string;
    buttons?: string[];
    approvalType?: string;
    returnType?: string;
    emptyType?: string;
    callback?: boolean;
    delay?: boolean;
    delayMinutes?: number;
    levels?: number;
    task?: string;
  };
}
export const kinds: { kind: NodeKind; label: string; color: string; icon: string }[] = [
  { kind: 'APPROVAL', label: '审批节点', color: '#5644ef', icon: 'user' },
  { kind: 'CC', label: '抄送节点', color: '#f08b43', icon: 'send' },
  { kind: 'CONDITION', label: '条件分支', color: '#e0bd35', icon: 'branches' },
  { kind: 'PARALLEL', label: '并行分支', color: '#c96bd1', icon: 'partition' },
  { kind: 'NOTICE', label: '通知节点', color: '#419bd5', icon: 'notice' },
  { kind: 'TASK', label: '任务节点', color: '#81ba54', icon: 'task' },
];
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function branch(name: string, fallback = false): DesignBranch {
  return { id: newId('branch'), name, fallback, groups: [[{ field: '', operator: 'EQ', value: '' }]], children: [] };
}
export function createDesignNode(kind: NodeKind): DesignNode {
  const n: DesignNode = {
    id: newId('design'),
    kind,
    name: kind === 'CONDITION' ? '条件分支' : kind === 'PARALLEL' ? '并行分支' : '未命名节点',
    config: {},
  };
  if (kind === 'APPROVAL') {
    n.approval = newNode();
    n.approval.name = n.name;
  }
  if (kind === 'CONDITION' || kind === 'PARALLEL')
    n.branches = [branch(kind === 'CONDITION' ? '条件1' : '分支1'), branch(kind === 'CONDITION' ? '条件2' : '分支2', kind === 'CONDITION')];
  return n;
}
export function fromNodes(nodes: WorkflowNode[]): DesignNode[] {
  return nodes.map((n) => {
    const behavior = n.options?.behavior;
    const kind: NodeKind = behavior?.kind === 'WORK' ? 'TASK' : behavior?.kind || 'APPROVAL';
    const config: DesignNode['config'] = {};
    if (kind !== 'APPROVAL') {
      config.users = clone(n.userIds || []);
      const singleRule = !n.userIds?.length && !n.roleIds?.length && n.approverRules?.length === 1 ? n.approverRules[0] : undefined;
      const field = singleRule?.type === 'FORM_USERS' ? singleRule : undefined;
      config.source = field ? 'field' : singleRule?.type === 'INITIATOR' ? 'initiator' : 'users';
      config.field = field?.fieldKey;
      config.template = behavior?.notificationTemplate;
      config.channels = clone(behavior?.channels || ['SITE']);
      config.delayMinutes = behavior?.notificationDelayMinutes;
      config.task = behavior?.description;
    }
    return { id: n.key, kind, name: n.name, approval: clone(n), config };
  });
}
export function flatten(nodes: DesignNode[]): DesignNode[] {
  return nodes.flatMap((n) => [n, ...(n.branches || []).flatMap((b) => flatten(b.children))]);
}
export const buttonCodes: Record<string, string> = {
  保存: 'SAVE',
  提交: 'SUBMIT',
  同意: 'APPROVE',
  拒绝: 'REJECT',
  退回: 'RETURN',
  加签: 'ADD_SIGN',
  打印: 'PRINT',
  转办: 'TRANSFER',
};
export function executionBlockers(nodes: DesignNode[]): string[] {
  const reasons = new Set<string>();
  for (const n of flatten(nodes)) {
    if (n.config.callback || n.approval?.options?.behavior?.callbackEnabled) reasons.add('节点回调尚未定义，请关闭后发布');
    if (n.config.channels?.some((c) => !['SITE', '站内信'].includes(c))) reasons.add('仅支持站内信，请明确调整节点通知通道');
    if (n.config.delay && n.config.delayMinutes == null) reasons.add('请填写延迟通知分钟数');
    if (n.config.source === 'levels' && !Number.isInteger(n.config.levels)) reasons.add('请填写连续主管层级数');
    if (n.config.emptyType === 'transfer' && n.config.users?.length !== 1) reasons.add('无人时转交必须选择一名人员');
    if (n.config.source === 'field' && !n.config.field) reasons.add('请选择人员来源字段');
  }
  return [...reasons];
}
export function executableNodes(nodes: DesignNode[]): WorkflowNode[] {
  const blockers = executionBlockers(nodes);
  if (blockers.length) throw new Error(blockers[0]);
  return flatten(nodes)
    .filter((n) => ['APPROVAL', 'CC', 'NOTICE', 'TASK'].includes(n.kind))
    .map((n) => {
      const result = clone(n.approval || { ...newNode(), key: n.id });
      result.name = n.name;
      result.options ||= {};
      const c = n.config;
      const behavior = { ...result.options.behavior };
      if (n.kind !== 'APPROVAL') {
        behavior.kind = n.kind === 'TASK' ? 'WORK' : (n.kind as 'CC' | 'NOTICE');
        result.userIds = c.users || [];
        // Preserve existing roles/organization rules when the person source has not been changed.
        if (c.source === 'initiator') result.approverRules = [{ type: 'INITIATOR' }];
        if (c.source === 'field') result.approverRules = [{ type: 'FORM_USERS', fieldKey: c.field }];
        if (c.task !== undefined) behavior.description = c.task;
      }
      if (n.kind === 'APPROVAL' && c.source === 'field') result.approverRules = [{ type: 'FORM_USERS', fieldKey: c.field }];
      if (c.source === 'levels') {
        result.approverRules = [{ type: 'SUPERVISOR_CHAIN', levels: c.levels }];
        result.options.mode = 'SEQUENTIAL';
      }
      if (c.approvalType !== undefined) behavior.autoApprove = c.approvalType === 'auto';
      if (c.returnType !== undefined) behavior.returnMode = c.returnType === 'choose' ? 'PREVIOUS' : c.returnType === 'start' ? 'START' : 'DISABLED';
      if (c.emptyType !== undefined) {
        behavior.emptyApprover = c.emptyType === 'auto' ? 'AUTO_APPROVE' : c.emptyType === 'transfer' ? 'TRANSFER' : 'FAIL';
        if (c.emptyType === 'transfer') behavior.fallbackUserId = c.users?.[0];
        else delete behavior.fallbackUserId;
      }
      if (c.buttons !== undefined)
        behavior.buttons = {
          ...behavior.buttons,
          ...Object.fromEntries(Object.entries(buttonCodes).map(([label, code]) => [code, c.buttons!.includes(label)])),
        };
      if (c.channels !== undefined) behavior.channels = c.channels.map((v) => (v === '站内信' ? 'SITE' : v));
      if (c.template !== undefined) behavior.notificationTemplate = c.template;
      if (c.delayMinutes !== undefined) behavior.notificationDelayMinutes = c.delayMinutes;
      if (c.delay === false) behavior.notificationDelayMinutes = 0;
      if (c.callback !== undefined) behavior.callbackEnabled = c.callback;
      if (Object.keys(behavior).length) result.options.behavior = behavior;
      return result;
    });
}
export function removeDesignNode(nodes: DesignNode[], id: string): boolean {
  const index = nodes.findIndex((n) => n.id === id);
  if (index >= 0) {
    nodes.splice(index, 1);
    return true;
  }
  return nodes.some((n) => n.branches?.some((b) => removeDesignNode(b.children, id)));
}

function groupsOf(p?: WorkflowPredicate): ConditionRow[][] {
  if (!p) return [[{ field: '', operator: 'EQ', value: '' }]];
  if (p.junction === 'AND' && !p.children?.length) return [clone(p.conditions || [])];
  if (p.junction === 'OR' && !p.conditions?.length && p.children?.every((c) => c.junction === 'AND' && !c.children?.length))
    return p.children.map((c) => clone(c.conditions || []));
  return []; // Arbitrary recursive predicates are preserved verbatim until explicitly replaced.
}
export function fromDefinition(def: WorkflowDefinition): DesignNode[] {
  if (!def.stages) return fromNodes(def.nodes);
  const convert = (stage: WorkflowStage): DesignNode => {
    if (stage.kind === 'TASK') {
      const approval = def.nodes.find((n) => n.key === stage.nodeKey);
      if (!approval) throw new Error(`结构引用不存在的审批节点：${stage.nodeKey}`);
      return {
        ...fromNodes([approval])[0],
        id: stage.key,
        stageCondition: clone(stage.condition || null) || undefined,
      };
    }
    const kind = stage.kind === 'EXCLUSIVE' ? 'CONDITION' : stage.kind;
    const sequence = kind === 'SEQUENCE' || kind === 'SUBPROCESS';
    const children = sequence ? [{ key: `${stage.key}_content`, kind: 'SEQUENCE' as const, children: stage.children }] : stage.children || [];
    return {
      id: stage.key,
      kind,
      name: kind === 'SUBPROCESS' ? '内嵌子流程' : kind === 'SEQUENCE' ? '顺序组' : kind === 'CONDITION' ? '条件分支' : '并行分支',
      config: {},
      stageCondition: stage.condition,
      branches: children.map((child, index) => {
        const groups = groupsOf(child.condition);
        const wrapper = child.kind === 'SEQUENCE' && !sequence;
        const bare = { ...child };
        delete bare.condition;
        return {
          id: child.key,
          name: sequence ? '按顺序执行' : `分支${index + 1}`,
          fallback: kind === 'CONDITION' && index === children.length - 1 && !child.condition,
          groups,
          predicate: child.condition,
          originalGroups: JSON.stringify(groups),
          wrapper,
          children: sequence ? (stage.children || []).map(convert) : wrapper ? (child.children || []).map(convert) : [convert(bare)],
        };
      }),
    };
  };
  return def.stages.map(convert);
}
export function executableGraph(nodes: DesignNode[], structured = false): Pick<WorkflowDefinition, 'nodes' | 'stages'> {
  const approvals = executableNodes(nodes);
  const predicate = (b: DesignBranch) =>
    b.fallback
      ? undefined
      : b.predicate && b.originalGroups === JSON.stringify(b.groups)
        ? clone(b.predicate)
        : { junction: 'OR' as const, children: b.groups.map((conditions) => ({ junction: 'AND' as const, conditions: clone(conditions) })) };
  const convert = (node: DesignNode): WorkflowStage => {
    const base = { key: node.id, ...(node.stageCondition ? { condition: clone(node.stageCondition) } : {}) };
    if (['APPROVAL', 'CC', 'NOTICE', 'TASK'].includes(node.kind)) return { ...base, kind: 'TASK', nodeKey: node.approval?.key || node.id };
    if (node.kind === 'SEQUENCE' || node.kind === 'SUBPROCESS')
      return { ...base, kind: node.kind, children: (node.branches?.[0]?.children || []).map(convert) };
    return {
      ...base,
      kind: node.kind === 'CONDITION' ? 'EXCLUSIVE' : 'PARALLEL',
      children: (node.branches || []).map((b) => {
        const children = b.children.map(convert);
        const result: WorkflowStage = !b.wrapper && children.length === 1 ? children[0] : { key: b.id, kind: 'SEQUENCE', children };
        if (node.kind === 'CONDITION') {
          delete result.condition;
          const p = predicate(b);
          if (p) result.condition = p;
        } else if (b.predicate) result.condition = clone(b.predicate);
        return result;
      }),
    };
  };
  return { nodes: approvals, ...(structured || nodes.some((n) => n.kind !== 'APPROVAL' || n.stageCondition) ? { stages: nodes.map(convert) } : {}) };
}
