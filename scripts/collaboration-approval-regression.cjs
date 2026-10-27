const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const paths=['src/views/todo/collaborationApproval.ts'];
for(const path of paths){
 const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:m.exports,module:m});
 const {parseApprovalCandidates:parse,approvalAssignments:payload}=m.exports;
 const department=(id,user)=>({departmentId:id,departmentName:id,members:[{value:user,label:user}]});
 const base={assignmentMode:'WITH_APPROVAL',taskId:'t',nodeKey:'head',departments:[]};
 assert.equal(JSON.stringify(payload(parse(base,'t'),{},true)),'{}');
 const head=parse({...base,departments:[department('d1','u1'),department('d2','u2')]},'t');
 assert.equal(JSON.stringify(payload(head,{d1:['u1'],d2:['u2']},true)),JSON.stringify({departmentAssignments:[{departmentId:'d1',assignedUserIds:['u1']},{departmentId:'d2',assignedUserIds:['u2']}]}));
 const second=parse({...base,nodeKey:'departments',departments:[department('d1','u1')]},'t');
 assert.equal(JSON.stringify(payload(second,{d1:['u1']},true)),JSON.stringify({assignedUserIds:['u1']}));
 assert.equal(JSON.stringify(payload(undefined,{d1:['u1']},false)),'{}');
 assert.throws(()=>payload(head,{d1:['u1']},true),/选择/);
 assert.throws(()=>payload({...base,departments:[{departmentId:'d1',departmentName:'部门',members:[]}]},{},true),/暂无可选/);
 assert.throws(()=>payload({...head,departments:[department('d1','u1'),department('d2','u1')]},{d1:['u1'],d2:['u1']},true),/重复/);
 assert.throws(()=>payload(second,{d1:['stranger']},true),/有效/);
 assert.throws(()=>parse(base,'wrong'),/不匹配/);
 assert.throws(()=>parse({...base,departments:null},'t'),/不匹配/);
 console.log('PASS '+path+': empty, head reuse, department, rejection, missing/duplicate/invalid members and stale task');
}
