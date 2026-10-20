const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const bag = {};
vm.runInNewContext(compile(fs.readFileSync('src/utils/auth/logoutResult.ts', 'utf8')), { exports: bag });
const source = fs.readFileSync('src/api/sys/user.ts', 'utf8');
const ast = ts.createSourceFile('user.ts', source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'doLogout');
let outcome, rejected = false;
const api = {};
vm.runInNewContext(compile(fn.getText(ast)), {
  exports: api, isLogoutSessionInvalid: bag.isLogoutSessionInvalid, Api: { Logout: '/sys/logout' },
  defHttp: { get: async (request, options) => {
    assert.equal(request.headers['X-Access-Token'], 'old-session');
    assert.equal(request.headers.Authorization, 'old-session');
    assert.equal(options.withToken, false);
    assert.equal(options.errorMessageMode, 'none');
    if (rejected) throw outcome;
    return outcome;
  } },
});
(async () => {
  for (const response of [{ success: true }, { success: false, message: 'Token无效!' }, { message: 'Token无效！' }, { code: 401 }, { code: '401' }]) {
    outcome = response; await api.doLogout('old-session');
  }
  for (const response of [null, {}, { success: false, message: '数据库异常' }, { code: 403, message: '无权限' }, { message: 'Token校验服务异常' }]) {
    outcome = response; await assert.rejects(api.doLogout('old-session'));
  }
  rejected = true;
  outcome = { response: { status: 401 } }; await api.doLogout('old-session');
  for (const error of [new Error('Network Error'), { code: 'ECONNABORTED' }, { response: { status: 500, data: { message: 'Token无效!' } } }, { response: { status: 403 } }]) {
    outcome = error; await assert.rejects(api.doLogout('old-session'), e => e === error);
  }
  console.log('PASS logout: success/invalid session completes; network/timeout/403/500/business failures preserved; old token pinned');
})().catch(e => { console.error(e); process.exitCode = 1; });
