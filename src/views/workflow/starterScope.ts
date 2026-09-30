import type { Audience } from './workflow.types';
export const audienceKeys = ['userIds', 'roleIds', 'departmentIds', 'positionIds'] as const;
export function hasStarterSelection(value: Audience) {
  return audienceKeys.some((key) => Array.isArray(value[key]) && !!value[key]?.length);
}
export function starterMode(value: Audience | null | undefined): 'ALL' | 'SPECIFIED' | 'EMPTY' {
  return value == null ? 'ALL' : hasStarterSelection(value) ? 'SPECIFIED' : 'EMPTY';
}
export function serializeStarters(value: Audience | null | undefined): Audience | null {
  if (value == null) return null;
  if (!hasStarterSelection(value)) throw new Error('请选择至少一个发起范围，或明确选择“全部人”');
  return { ...JSON.parse(JSON.stringify(value)), includeChildren: value.includeChildren === true };
}
export function starterSummary(value: Audience | null | undefined) {
  const mode = starterMode(value);
  return mode === 'ALL' ? '所有人可发起' : mode === 'EMPTY' ? '未配置有效发起范围，当前无人可发起' : '已设置发起范围';
}
