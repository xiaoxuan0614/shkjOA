import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const target = process.argv[2];
if (!['test', 'production'].includes(target)) throw new Error('Usage: node scripts/package-dual.mjs test|production');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobile = path.resolve(root, '../SHKKJ-uniapp');
const api = target === 'production' ? 'https://oa.shouhuikeji.com/shouhuiApi' : 'https://oa-test.shouhuikeji.com/shouhuiApi';
const now = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium', hour12: false }).format(new Date());
const startedAt = now();
const stamp = startedAt.replaceAll('-', '').replace(' ', '-').replaceAll(':', '');
const release = path.join(root, 'release-packages', `${stamp}-${target}`);
fs.mkdirSync(release); // Fail rather than overwrite a previous run in the same second.
const record = { target, api, pcBase: '/', h5Base: '/h5/', timezone: 'Asia/Shanghai (UTC+08:00)', startedAt, node: process.version, status: 'running', deployed: false, steps: [], archives: [] };
const saveRecord = () => fs.writeFileSync(path.join(release, 'build-record.json'), JSON.stringify(record, null, 2));
saveRecord();
console.log(`Release: ${release}`);
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unavailable';
}
function run(name, command, args, cwd, env = process.env) {
  const step = { name, command: [command, ...args], startedAt: now() };
  record.steps.push(step);
  saveRecord();
  const log = fs.openSync(path.join(release, `${name}.log`), 'w');
  try {
    const r = spawnSync(command, args, { cwd, env, stdio: ['ignore', log, log] });
    step.exitCode = r.status;
    step.finishedAt = now();
    saveRecord();
    if (r.error || r.status !== 0) throw new Error(`${name} failed; inspect ${name}.log (${r.error?.message || r.status})`);
    console.log(`${name}: passed at ${step.finishedAt}`);
  } finally { fs.closeSync(log); }
}
function verify(dir, configFile, base) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(https?:|data:|#|\/\/)/.test(ref)) continue;
    const local = ref.split('?')[0].replace(new RegExp(`^${base}`), '');
    assert(fs.existsSync(path.join(dir, local)), `Missing entry asset ${ref}`);
  }
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(dir, configFile), 'utf8'), sandbox, { timeout: 1000 });
  const config = Object.values(sandbox.window)[0];
  assert(config, 'Missing runtime configuration');
  if (base === '/') {
    assert.equal(config.VITE_GLOB_API_URL, api);
    assert.equal(config.VITE_GLOB_DOMAIN_URL, api);
  } else {
    assert.equal(config.VITE_SERVER_BASEURL, api);
    assert.equal(config.VITE_UPLOAD_BASEURL, api);
    assert.equal(config.VITE_APP_PUBLIC_BASE, base);
    assert.equal(config.VITE_APP_PROXY, 'false');
    assert(html.includes('/h5/'), 'Missing H5 base');
  }
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(file);
      else assert(!/\.map$|^\.env|\.(pem|key)$/i.test(entry.name), `Unexpected sensitive/source file: ${file}`);
    }
  }
  walk(dir);
}
try {
  record.pcCommit = git(root, ['rev-parse', 'HEAD']);
  record.h5Commit = git(mobile, ['rev-parse', 'HEAD']);
  record.pcWorkingTree = git(root, ['status', '--short']);
  record.h5WorkingTree = git(mobile, ['status', '--short']);
  record.pnpm = spawnSync('pnpm', ['--version'], { encoding: 'utf8' }).stdout?.trim();
  const pcDir = path.join(release, 'pc');
  const h5Dir = path.join(release, 'h5');
  run('pc-build', 'npm', ['run', 'build'], root, { ...process.env, OA_BUILD_OUTPUT_DIR: pcDir, VITE_GLOB_API_URL: api, VITE_GLOB_DOMAIN_URL: api, VITE_GLOB_API_URL_PREFIX: '', VITE_PUBLIC_PATH: '/', VITE_USE_MOCK: 'false' });
  const generated = ['src/pages.json', 'src/manifest.json'].map(name => ({ file: path.join(mobile, name), bytes: fs.readFileSync(path.join(mobile, name)) }));
  try {
    run('h5-build', process.execPath, [path.join(mobile, 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'), 'build', '-p', 'h5'], mobile, {
      ...process.env, NODE_ENV: 'production', VITE_SERVER_BASEURL: api, VITE_UPLOAD_BASEURL: api,
      VITE_APP_PUBLIC_BASE: '/h5/', VITE_APP_PROXY: 'false', VITE_DELETE_CONSOLE: 'true', VITE_SHOW_SOURCEMAP: 'false', UNI_OUTPUT_DIR: h5Dir,
    });
  } finally {
    for (const { file, bytes } of generated) fs.writeFileSync(file, bytes);
  }
  verify(pcDir, '_app.config.js', '/');
  verify(h5Dir, 'app.config.js', '/h5/');
  for (const [name, dir] of [['pc', pcDir], ['h5', h5Dir]]) {
    const archive = path.join(release, `oa-${name}-${target}.zip`);
    run(`${name}-zip`, 'zip', ['-qr', archive, '.'], dir);
    run(`${name}-integrity`, 'unzip', ['-tq', archive], root);
    record.archives.push({ file: archive, bytes: fs.statSync(archive).size, sha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex') });
  }
  record.status = 'passed';
} catch (error) {
  record.status = 'failed';
  record.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  record.finishedAt = now();
  saveRecord();
  console.log(`Result: ${record.status}. Record: ${path.join(release, 'build-record.json')}`);
}
