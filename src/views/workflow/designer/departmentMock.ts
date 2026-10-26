import type { RelatedDepartmentDesign } from './relatedDepartment';

// Synthetic directory and state machine: no API, real user ID or server storage.
export interface MockDepartment { id: string; name: string; heads: {id: string; name: string}[] }
export type MockVote = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface MockRun {
  operations: MockVote;
  groups: { department: MockDepartment; votes: Record<string, MockVote> }[];
  error: string;
}
export const mockDepartments: MockDepartment[] = [
  {id:'mock-tech',name:'技术部',heads:[{id:'mock-tech-head-a',name:'技术主管 A'},{id:'mock-tech-head-b',name:'技术主管 B'}]},
  {id:'mock-engineering',name:'工程部',heads:[{id:'mock-engineering-head',name:'工程主管'}]},
  {id:'mock-quality',name:'质量部',heads:[{id:'mock-quality-head',name:'质量主管'}]},
  {id:'mock-product',name:'产品部',heads:[{id:'mock-product-head',name:'产品主管'}]},
  {id:'mock-service',name:'客服部',heads:[{id:'mock-service-head',name:'客服主管'}]},
  {id:'mock-delivery',name:'交付部',heads:[{id:'mock-delivery-head',name:'交付主管'}]},
  {id:'mock-empty',name:'未配置主管的部门',heads:[]},
];
export function createMockRun(ids: string[], rule: RelatedDepartmentDesign): MockRun {
  const unique = [...new Set(ids)];
  const departments = unique.map(id => mockDepartments.find(d => d.id === id));
  let error = '';
  if (rule.source !== 'DEPARTMENTS' || rule.fieldKey !== 'departments') error = '请关联受邀部门字段后重新模拟。';
  else if (rule.departmentMode !== 'ALL' || rule.headMode !== 'ANY' || rule.emptyPolicy !== 'FAIL') error = '维修内协必须全部部门通过、同部门任一主管通过、无主管停止。';
  else if (!unique.length) error = '请至少选择一个受邀部门。';
  else if (departments.some(d => !d)) error = '存在无效部门，请重新选择。';
  else if (departments.some(d => !d!.heads.length)) error = '受邀部门未配置主管：停止发起，不自动跳过，请补齐主管后重试。';
  const groups = error ? [] : departments.map(d => ({
    department: JSON.parse(JSON.stringify(d)) as MockDepartment,
    votes: Object.fromEntries(d!.heads.map(h => [h.id, 'PENDING' as MockVote])),
  }));
  return { operations:'PENDING', groups, error };
}
export function groupState(group: MockRun['groups'][number]): MockVote {
  const votes = Object.values(group.votes);
  if (votes.includes('REJECTED')) return 'REJECTED';
  return votes.includes('APPROVED') ? 'APPROVED' : 'PENDING';
}
export function mockRunState(run: MockRun): 'BLOCKED' | 'OPERATIONS' | 'DEPARTMENTS' | 'APPROVED' | 'REJECTED' {
  if (run.error || !run.groups.length) return 'BLOCKED';
  if (run.operations === 'REJECTED') return 'REJECTED';
  if (run.operations !== 'APPROVED') return 'OPERATIONS';
  if (run.groups.some(g => groupState(g) === 'REJECTED')) return 'REJECTED';
  return run.groups.every(g => groupState(g) === 'APPROVED') ? 'APPROVED' : 'DEPARTMENTS';
}
export function voteOperations(run: MockRun, vote: Exclude<MockVote, 'PENDING'>) {
  if (mockRunState(run) === 'OPERATIONS') run.operations = vote;
}
export function voteDepartment(run: MockRun, departmentId: string, headId: string, vote: Exclude<MockVote, 'PENDING'>) {
  if (mockRunState(run) !== 'DEPARTMENTS') return;
  const group = run.groups.find(g => g.department.id === departmentId);
  if (!group || groupState(group) !== 'PENDING' || group.votes[headId] !== 'PENDING') return;
  group.votes[headId] = vote;
}
