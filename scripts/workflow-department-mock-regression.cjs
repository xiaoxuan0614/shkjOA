const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const base = 'src/views/workflow/';
const exportsMock = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(base+'designer/departmentMock.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText, {exports:exportsMock});
const {createMockRun, mockRunState, voteOperations, voteDepartment, groupState, mockDepartments} = exportsMock;
const rule = {source:'DEPARTMENTS',fieldKey:'departments',departmentMode:'ALL',headMode:'ANY',emptyPolicy:'FAIL'};
let run = createMockRun(['mock-tech','mock-tech','mock-engineering'],rule);
assert.equal(run.groups.length,2);
assert.equal(mockRunState(run),'OPERATIONS');
voteDepartment(run,'mock-tech','mock-tech-head-a','APPROVED');
assert.equal(groupState(run.groups[0]),'PENDING','no department vote before operations approval');
voteOperations(run,'APPROVED');
assert.equal(mockRunState(run),'DEPARTMENTS');
voteDepartment(run,'mock-tech','unknown-head','APPROVED');
assert.equal(groupState(run.groups[0]),'PENDING');
voteDepartment(run,'mock-tech','mock-tech-head-a','APPROVED');
assert.equal(mockRunState(run),'DEPARTMENTS','one department cannot complete the entire request');
voteDepartment(run,'mock-tech','mock-tech-head-b','REJECTED');
assert.equal(groupState(run.groups[0]),'APPROVED','other head cannot vote after ANY finishes');
voteDepartment(run,'mock-engineering','mock-engineering-head','APPROVED');
assert.equal(mockRunState(run),'APPROVED');
voteOperations(run,'REJECTED');
assert.equal(mockRunState(run),'APPROVED','terminal run cannot be changed');
run = createMockRun(['mock-tech','mock-engineering'],rule);
voteOperations(run,'APPROVED');
voteDepartment(run,'mock-engineering','mock-engineering-head','REJECTED');
assert.equal(mockRunState(run),'REJECTED');
voteDepartment(run,'mock-tech','mock-tech-head-a','APPROVED');
assert.equal(groupState(run.groups[0]),'PENDING','rejection stops remaining tasks');
run = createMockRun(['mock-tech'],rule);
voteOperations(run,'REJECTED');
assert.equal(mockRunState(run),'REJECTED');
for (const ids of [[],['unknown'],['mock-empty'],['mock-tech','mock-empty']]) {
  run = createMockRun(ids,rule); assert.equal(mockRunState(run),'BLOCKED'); assert.equal(run.groups.length,0);
  voteOperations(run,'APPROVED'); assert.equal(mockRunState(run),'BLOCKED');
}
assert.equal(mockRunState(createMockRun(['mock-tech'],{...rule,fieldKey:''})),'BLOCKED');
assert.equal(mockRunState(createMockRun(['mock-tech'],{...rule,departmentMode:'ANY'})),'BLOCKED');
assert.equal(mockRunState(createMockRun(['mock-tech'],{...rule,source:'MEMBERS'})),'BLOCKED');
run = createMockRun(mockDepartments.filter(d => d.heads.length).map(d => d.id),rule);
voteOperations(run,'APPROVED');
for (const g of run.groups) voteDepartment(run,g.department.id,g.department.heads[0].id,'APPROVED');
assert.equal(mockRunState(run),'APPROVED');
// Two departments sharing a supervisor remain two independently handled groups.
run = createMockRun(['mock-tech','mock-engineering'],rule);
run.groups[1].votes = {'mock-tech-head-a':'PENDING'};
voteOperations(run,'APPROVED');
voteDepartment(run,'mock-tech','mock-tech-head-a','APPROVED');
assert.equal(mockRunState(run),'DEPARTMENTS');
voteDepartment(run,'mock-engineering','mock-tech-head-a','APPROVED');
assert.equal(mockRunState(run),'APPROVED');
for (const file of ['designer/RelatedDepartmentConfig.vue','designer/RepairInternalMock.vue','designer/FlowSettings.vue','components/WorkflowEditor.vue','index.vue']) {
  const filename=base+file, source=fs.readFileSync(filename,'utf8');
  const {descriptor,errors}=sfc.parse(source); assert.deepEqual(errors,[]);
  sfc.compileScript(descriptor,{id:file});
  assert.deepEqual(sfc.compileTemplate({source:descriptor.template.content,filename,id:file}).errors,[]);
  if(file.includes('Mock')) {
    assert.ok(!source.includes('Workflow.api') && !source.includes('fetch('));
    assert.ok(source.includes('workflow-mock:repair-internal:v1'));
  }
}
for (const file of ['index.vue','components/WorkflowEditor.vue']) {
  const source=fs.readFileSync(base+file,'utf8');
  assert.ok(source.includes('localMockEnabled = import.meta.env.DEV'));
  assert.ok(source.includes('v-if="localMockEnabled'));
}
console.log('PASS department Mock: parallel ALL/ANY, rejection, terminal guards, missing heads, duplicates, many departments, cross-department head, SFC and isolation checks');
