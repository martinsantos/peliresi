import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCloudEnvironment, externalKeys } from './safety.ts';

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
