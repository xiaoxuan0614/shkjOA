const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/views/project/internalAcceptanceAccess.ts','utf8');
const exportsObject={};let requests=0;
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject,require:()=>({defHttp:{get:async()=>{requests++;return {success:true,result:[{id:'ops',departName:'运维部'}]};}}})});
async function main(){
 const check=exportsObject.readInternalAcceptanceAccess;
 assert.equal(await check({userId:'u',roleCodes:['operations_manager']}),true);
 assert.equal(await check({userId:'u',roleCodes:['admin']}),true);
 assert.equal(requests,0,'主管及管理员直接复用登录身份');
 assert.equal(await check({userId:'u',departmentIds:['ops'],roleCodes:['project_management']}),false,'普通部门成员不授内验资格');
 assert.equal(await check({userId:'u',responsibleDepartmentIds:['ops'],roleCodes:[]}),true);
 assert.equal(await check({userId:'u',responsibleDepartmentIds:['other'],roleCodes:[]}),false);
 assert.equal(await check({userId:'',roleCodes:['operations_manager']}),false);
 console.log('运维主管/admin、真实负责部门、普通成员拒绝及身份缺失检查通过');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
