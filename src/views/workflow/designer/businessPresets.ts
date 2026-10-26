import { newDefinition } from '../workflow';
import { createDesignNode } from './graph';
import type { WorkflowDefinition } from '../workflow.types';
import { newRelatedDepartmentDesign } from './relatedDepartment';

// Local UI preset identity, never a backend businessType.
export const repairInternalChoice = 'LOCAL_REPAIR_INTERNAL';
export const repairInternalPending = '维修内协邀请新版模板待后端接入，仅可本地暂存；不会覆盖已发布流程。';
export function isRepairInternal(definition: WorkflowDefinition) {
  return definition.businessType === 'REPAIR_OPS_APPLICATION' && definition.key === 'repair_ops_collaboration';
}
export function repairInternalPreset() {
  const definition = newDefinition();
  definition.key = 'repair_ops_collaboration';
  definition.name = '维修内协邀请';
  definition.businessType = 'REPAIR_OPS_APPLICATION';
  // Proposed semantic fields for local design only; replace from verified catalog before enabling writes.
  definition.formFields = [{key:'departments',name:'受邀部门（业务提供，待协议确认）',type:'departments'}];
  const operations = createDesignNode('APPROVAL');
  operations.name = '运维主管审批'; operations.approval!.name = operations.name;
  const departments = createDesignNode('APPROVAL');
  departments.name = '受邀部门主管审批'; departments.approval!.name = departments.name;
  departments.config.source = 'relatedDepartment';
  departments.config.relatedDepartment = {...newRelatedDepartmentDesign(),fieldKey:'departments'};
  // Do not guess the operations manager role ID or replace existing business models.
  return {definition,nodes:[operations,departments]};
}

export function editorSteps(skipForm: boolean) {
  return (skipForm ? [0,2,3,4] : [0,1,2,3,4]);
}
