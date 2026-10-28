const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sfc = require('@vue/compiler-sfc');
const path = require('node:path');
const mobile = path.resolve('../SHKKJ-uniapp');
function load(file) {
  const exports = {};
  new Function('exports', ts.transpile(fs.readFileSync(file, 'utf8'), { module: ts.ModuleKind.CommonJS }))(exports);
  return exports;
}
async function main() {
  const pc = load('src/utils/newPassword.ts');
  const app = load(mobile + '/src/utils/newPassword.ts');
  assert.equal(fs.readFileSync('src/utils/newPassword.ts', 'utf8'), fs.readFileSync(mobile + '/src/utils/newPassword.ts', 'utf8'));
  for (const policy of [pc, app]) {
    for (const value of ['', '12345678', 'abcdefgh', 'ABCDEFGH', 'abcdefgh1', 'Abcd123', 'Abcd1234567890123', 'Abcd 123', 'Abcd123\n', '密码Abcd12', 'Password123!', 'Admin123!']) assert(policy.newPasswordError(value), 'weak input must fail');
    for (const value of ['River27!', 'Abcd1234', 'Abcd123456789012', 'stone27!']) assert.equal(policy.newPasswordError(value), '');
    assert(policy.newPasswordError('River27!', 'River27!'));
    await assert.rejects(policy.createNewPasswordRule().validator(null, '12345678'));
    await policy.createNewPasswordRule().validator(null, 'River27!');
    await assert.rejects(policy.createNewPasswordRule(() => 'River27!').validator(null, 'River27!'));
  }
  const files = [
    'src/layouts/default/header/components/user-dropdown/UpdatePassword.vue',
    'src/layouts/default/header/components/notify/ChangePasswordModal.vue',
    'src/views/system/usersetting/commponents/UserPasswordModal.vue',
    'src/views/system/usersetting/commponents/UserPasswordNotBindPhone.vue',
    mobile + '/src/pages/customer/mine.vue',
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    assert(text.includes('NEW_PASSWORD_HINT'));
    assert(!text.includes('createPasswordLengthRule'));
    const { descriptor, errors } = sfc.parse(text, { filename: file });
    assert.deepEqual(errors, []);
    const script = sfc.compileScript(descriptor, { id: 'password' });
    assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: 'password', compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
  }
  const mobileSource = fs.readFileSync(files[4], 'utf8');
  assert(mobileSource.indexOf('newPasswordError(passwordForm.password') < mobileSource.indexOf('await authApi.updatePassword'));
  const legacy = load('src/utils/password.ts');
  assert.equal(legacy.isPasswordLengthValid('123456'), true, 'existing login length rule stays unchanged');
  console.log('PASS dual-client password policy: length 8/16, categories, weak passwords, whitespace, old-password equality, legacy login and 5 SFCs');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
