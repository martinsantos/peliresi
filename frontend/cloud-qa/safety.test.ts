import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCloudEnvironment, assertPreviewResourceLimits, externalKeys } from './safety.ts';

const previewProof = { platform: 'linux', docker: true, root: '/work/sitrep', cpu: '100000 100000', memory: '2147483648', swap: '0' };
test('preview requires actual bounded Linux container, not an unrestricted host', () => {
  assert.doesNotThrow(() => assertPreviewResourceLimits(previewProof));
  for (const patch of [{platform:'darwin'}, {docker:false}, {root:'/var/www/sitrep'}, {cpu:'max 100000'},
    {cpu:'200000 100000'}, {cpu:'0 100000'}, {memory:'max'}, {memory:'4294967296'}, {swap:'2147483648'}]) {
    assert.throws(() => assertPreviewResourceLimits({...previewProof, ...patch}));
  }
});

const safe: NodeJS.ProcessEnv = {
  CI:'true', GITHUB_ACTIONS:'true', GITHUB_REPOSITORY:'martinsantos/peliresi',
  GITHUB_REF:'refs/heads/codex/sitrep-cloud-qa-20261002', ALLOW_SYNTHETIC_QA:'1',
  DATABASE_URL:'postgresql://qa@127.0.0.1:55440/sitrep_night_qa_20260926?schema=public',
  PORT:'3037', NODE_ENV:'test', NODE_APP_INSTANCE:'qa', DISABLE_EMAILS:'true',
  BLOCKCHAIN_ENABLED:'false', ENABLE_ANALYTICS:'false',
  FRONTEND_URL:'http://127.0.0.1:4177', CORS_ORIGIN:'http://127.0.0.1:4177', VITE_API_URL:'/api',
  ...Object.fromEntries(externalKeys.map(key=>[key,''])),
};
test('the explicitly isolated cloud target is accepted',()=>assert.doesNotThrow(()=>assertCloudEnvironment(safe)));
test('manifest candidate has no permission to use production or delivery', () => {
  const candidate = { ...safe, GITHUB_REF: 'refs/heads/codex/sitrep-manifiestos-v2-20261014' };
  assert.doesNotThrow(() => assertCloudEnvironment(candidate));
  assert.throws(() => assertCloudEnvironment({ ...candidate, DISABLE_EMAILS: 'false' }));
  assert.throws(() => assertCloudEnvironment({ ...candidate, DATABASE_URL: 'postgresql://qa@23.105.176.45:5432/trazabilidad_rrpp' }));
});
test('mail QA branch uses the same isolated target and delivery locks', () => {
  const mail = { ...safe, GITHUB_REF: 'refs/heads/codex/sitrep-mail-safety-20261011' };
  assert.doesNotThrow(() => assertCloudEnvironment(mail));
  assert.throws(() => assertCloudEnvironment({ ...mail, DISABLE_EMAILS: 'false' }));
  assert.throws(() => assertCloudEnvironment({ ...mail, SMTP_HOST: 'smtp.example.invalid' }));
});
test('UI/UX review branch uses the same isolated target and delivery locks', () => {
  const review = { ...safe, GITHUB_REF: 'refs/heads/codex/sitrep-uiux-review-20261016' };
  assert.doesNotThrow(() => assertCloudEnvironment(review));
  assert.throws(() => assertCloudEnvironment({ ...review, DISABLE_EMAILS: 'false' }));
  assert.throws(() => assertCloudEnvironment({ ...review, VAPID_PUBLIC_KEY: 'public-key' }));
  assert.throws(() => assertCloudEnvironment({ ...review, DATABASE_URL: 'postgresql://qa@23.105.176.45:5432/trazabilidad_rrpp' }));
});
for(const[key,value] of Object.entries({
  CI:'false', GITHUB_ACTIONS:'false', GITHUB_REPOSITORY:'martinsantos/another-project',
  GITHUB_REF:'refs/heads/main', ALLOW_SYNTHETIC_QA:'0', NODE_ENV:'production', NODE_APP_INSTANCE:'0',
  DISABLE_EMAILS:'false', BLOCKCHAIN_ENABLED:'true', ENABLE_ANALYTICS:'true', PORT:'3002',
  FRONTEND_URL:'https://sitrep.ultimamilla.com.ar', CORS_ORIGIN:'https://sitrep.ultimamilla.com.ar',
  VITE_API_URL:'https://sitrep.ultimamilla.com.ar/api',
  ...Object.fromEntries(externalKeys.map(key=>[key,'must-not-be-present'])),
}))test('rejects unsafe '+key,()=>assert.throws(()=>assertCloudEnvironment({...safe,[key]:value})));
for(const url of [
  'postgresql://qa@23.105.176.45:55440/sitrep_night_qa_20260926',
  'postgresql://qa@127.0.0.1:5432/sitrep_night_qa_20260926',
  'postgresql://qa@127.0.0.1:55440/trazabilidad_rrpp',
  '',
])test('rejects foreign database '+url,()=>assert.throws(()=>assertCloudEnvironment({...safe,DATABASE_URL:url})));
