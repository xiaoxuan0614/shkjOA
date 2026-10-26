import type { DesignNode } from './graph';

/** Canvas representation; graph.ts maps source to the API sourceKind. */
export interface RelatedDepartmentDesign {
  source: 'DEPARTMENTS' | 'MEMBERS';
  fieldKey: string;
  itemIdPath?: string;
  departmentMode: 'ALL' | 'ANY';
  headMode: 'ANY' | 'ALL';
  emptyPolicy: 'FAIL';
}
export const relatedDepartmentPending = '当前服务未开启关联部门主管能力，请刷新服务能力后重试';
export function newRelatedDepartmentDesign(): RelatedDepartmentDesign {
  return {source:'DEPARTMENTS',fieldKey:'',departmentMode:'ALL',headMode:'ANY',emptyPolicy:'FAIL'};
}
export function relatedDepartmentFields(fields: {key:string;name:string;type:string}[], source: RelatedDepartmentDesign['source']) {
  const types = source === 'MEMBERS' ? ['user','users','member','members'] : ['department','departments'];
  return fields.filter(field => types.includes(field.type)).map(field => ({value:field.key,label:field.name}));
}
export function relatedDepartmentSummary(node: DesignNode): string {
  const rule = node.config.relatedDepartment;
  if (!rule?.fieldKey) return '关联部门主管 · 请配置来源字段';
  return `关联部门主管 · ${rule.departmentMode === 'ALL' ? '全部部门' : '任一部门'}通过`;
}
