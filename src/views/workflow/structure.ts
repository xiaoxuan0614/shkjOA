import type { WorkflowDefinition, WorkflowPredicate, WorkflowStage, WorkflowCondition } from './workflow.types';
export function structureErrors(definition: WorkflowDefinition): string[] {
  const errors: string[] = [],
    fields = new Set((definition.formFields || []).map((f) => f.key));
  const atom = (c: WorkflowCondition) => {
    if (
      !c ||
      !fields.has(c.field) ||
      c.field.includes('[]') ||
      !['EQ', 'NE', 'GT', 'GE', 'LT', 'LE'].includes(c.operator) ||
      typeof c.value !== 'string' ||
      !c.value.trim()
    )
      errors.push('条件需使用有效的单值字段、运算符和值');
    else if (['GT', 'GE', 'LT', 'LE'].includes(c.operator) && !Number.isFinite(Number(c.value))) errors.push('大小比较的条件值必须为数字');
  };
  const predicate = (p: WorkflowPredicate, depth = 0) => {
    if (!p || depth > 8) {
      errors.push('组合条件深度最多8层（根为0）');
      return;
    }
    if (!['AND', 'OR'].includes(p.junction)) errors.push('条件组合必须为AND或OR');
    const size = (p.conditions?.length || 0) + (p.children?.length || 0);
    if (size < 1 || size > 30) errors.push('每组条件需1至30项');
    p.conditions?.forEach(atom);
    p.children?.forEach((c) => predicate(c, depth + 1));
  };
  definition.nodes.forEach((n) => {
    if (n.condition) atom(n.condition);
    if (n.options?.predicate) predicate(n.options.predicate);
  });
  if (definition.nodes.length && definition.nodes.every((n) => n.condition || n.options?.predicate)) errors.push('至少保留一个无节点条件的审批节点');
  if (definition.stages != null) {
    const keys = new Set<string>(),
      refs = new Map<string, number>();
    let count = 0;
    if (!definition.stages.length) errors.push('结构化流程不能为空');
    const visit = (stages: WorkflowStage[], depth: number) => {
      if (depth > 8) {
        errors.push('流程结构深度最多8层（根为0）');
        return;
      }
      for (const s of stages) {
        count++;
        if (!s.key || keys.has(s.key)) errors.push('结构标识不能为空或重复');
        keys.add(s.key);
        if (s.condition) predicate(s.condition);
        if (s.kind === 'TASK') {
          if (!definition.nodes.some((n) => n.key === s.nodeKey)) errors.push('结构引用了不存在的审批节点');
          refs.set(s.nodeKey || '', (refs.get(s.nodeKey || '') || 0) + 1);
          if (s.children?.length) errors.push('审批任务不能包含子结构');
        } else {
          if (!['SEQUENCE', 'PARALLEL', 'EXCLUSIVE', 'SUBPROCESS'].includes(s.kind)) errors.push('未知流程结构');
          if (!s.children?.length) errors.push('每条分支或结构组至少包含一个审批节点');
          if (s.kind === 'EXCLUSIVE' && s.children?.length) {
            if (s.children[s.children.length - 1].condition) errors.push('条件分支最后一条必须为默认路线');
            if (s.children.slice(0, -1).some((c) => !c.condition)) errors.push('默认路线只能放在条件分支末尾');
          }
          visit(s.children || [], depth + 1);
        }
      }
    };
    visit(definition.stages, 0);
    if (count > 100) errors.push('流程结构块最多100个');
    if (definition.nodes.some((n) => refs.get(n.key) !== 1)) errors.push('每个审批节点必须在结构中恰好引用一次');
  }
  return [...new Set(errors)];
}
