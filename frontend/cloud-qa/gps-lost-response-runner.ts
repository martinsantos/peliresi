import assert from 'node:assert/strict';
import {mkdirSync,openSync,closeSync} from 'node:fs';
import {cp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {assertCloudDatabase,root} from './safety.ts';
import {synchronizeManual} from './manual-build.ts';

// Loopback-only, synthetic preview. No secrets, production hosts or workflows.
const connectionAudit=process.env.SITREP_QA_RUN==='connection-20261029';
const crossTab=process.env.SITREP_QA_RUN==='crosstab-20261029';
assert.ok(!process.env.SITREP_QA_RUN||connectionAudit||crossTab,'Unknown QA run');
const artifacts=connectionAudit?'/work/sitrep/.qa-gps-connection-20261029':crossTab?'/work/sitrep/.qa-gps-crosstab-20261029':'/work/sitrep/.qa-gps-lost-response-20261029';
const compiled=connectionAudit?'/work/sitrep/.qa-gps-lost-response-20261029':artifacts;
Object.assign(process.env,{
  CI:'true',SITREP_QA_EXECUTOR:'preview-container',GITHUB_REPOSITORY:'martinsantos/peliresi',
  GITHUB_REF:'refs/heads/codex/sitrep-training-20261018',GITHUB_SHA:connectionAudit?'e0b77d09-connection-audit':crossTab?'a8115926-with-gps-crosstab-uncommitted':'f44cf957-with-gps-retry-uncommitted',
  ALLOW_SYNTHETIC_QA:'1',DATABASE_URL:'postgresql://qa@127.0.0.1:55440/sitrep_night_qa_20260926?schema=proposal_operations_20261021',
  PORT:'3037',NODE_ENV:'test',NODE_APP_INSTANCE:'qa',FRONTEND_URL:'http://127.0.0.1:4177',CORS_ORIGIN:'http://127.0.0.1:4177',VITE_API_URL:'/api',
  TRAINING_DATABASE_URL:'',TRAINING_DIRECT_LOGIN_UNTIL:'2000-01-01T00:00:00Z',
  DISABLE_EMAILS:'true',PUSH_MANIFEST_NOTICES_ENABLED:'false',EMAIL_NOTIFICATION_FAMILIES:'',EMAIL_EXTERNAL_ALERTS_ENABLED:'false',
  EMAIL_EXTERNAL_ALERTS_ALLOWLIST:'',SMTP_HOST:'',SMTP_USER:'',SMTP_PASS:'',VAPID_PUBLIC_KEY:'',VAPID_PRIVATE_KEY:'',
  BLOCKCHAIN_ENABLED:'false',BLOCKCHAIN_RPC_URL:'',BLOCKCHAIN_CONTRACT_ADDRESS:'',ENABLE_ANALYTICS:'false',
  MANIFEST_PROPOSALS_ENABLED:'true',MANIFEST_REVIEW_AUTHORITY_BY_ROLE:'true',MANIFEST_TRANSPORT_HANDOFF_ENABLED:'true',TRANSPORT_MULTI_GPS_ENABLED:'true',
  VITE_MANIFEST_PROPOSALS_ENABLED:'true',VITE_TRANSPORT_MULTI_GPS_ENABLED:'true',
  QA_TRACE_CONNECTIONS:connectionAudit?'true':'false',
  QA_ARTIFACTS:artifacts,QA_WEB_BUILD:path.join(compiled,'web'),QA_APP_BUILD:path.join(compiled,'app'),
});
delete process.env.GITHUB_ACTIONS;
assert.equal(path.resolve(root),'/work/sitrep');await assertCloudDatabase();
mkdirSync(artifacts,{recursive:true,mode:0o700});
const phase=process.argv[2];
if(phase==='manual'){
  const source=path.join(artifacts,'manual-source');
  await cp(path.join(root,'docs/manual'),source,{recursive:true,filter:item=>!path.basename(item).startsWith('._')&&path.basename(item)!=='.env'});
  await synchronizeManual(source,path.join(artifacts,'manual'),true);
  await synchronizeManual(source,path.join(artifacts,'manual'),false);
  console.log('manual: frozen and byte-verified');process.exit(0);
}
const frontend=path.join(root,'frontend');
const backend=path.join(root,'backend');
const commands:Record<string,{cwd:string;command:string;args:string[]}>= {
  backendBuild:{cwd:backend,command:'npm',args:['run','build']},
  backendTests:{cwd:backend,command:'./node_modules/.bin/vitest',args:['run','src/__tests__/controllers/transportHandoffAccess.test.ts','src/__tests__/controllers/manifiestoGps.idempotency.test.ts','src/__tests__/subscribers/transitDurationAlert.subscriber.test.ts','src/__tests__/jobs/transitDurationSweep.test.ts','src/__tests__/services/transitDurationPolicy.test.ts','--maxWorkers=1','--no-file-parallelism']},
  frontendTests:{cwd:frontend,command:'./node_modules/.bin/vitest',args:['run','src-v6/__tests__/hooks/useFleetGps.test.ts','src-v6/__tests__/pages/RelevoGpsPage.test.tsx','src-v6/__tests__/pages/CargasEnCursoPage.test.tsx','src-v6/__tests__/services/limitedTransportGps.test.ts','src-v6/__tests__/services/fleetGps.test.ts','src-v6/__tests__/services/gpsQueue.test.ts','--maxWorkers=1','--no-file-parallelism']},
  crossTests:{cwd:frontend,command:'./node_modules/.bin/vitest',args:['run','src-v6/__tests__/services/gpsCoordination.test.ts','src-v6/__tests__/services/gpsTransition.test.ts','src-v6/__tests__/services/offlineSyncSessionBoundary.test.ts','src-v6/__tests__/hooks/useGPSTracking.test.tsx','src-v6/__tests__/hooks/useGPSTracking.safety.test.tsx','src-v6/__tests__/pages/CargasEnCursoPage.test.tsx','src-v6/__tests__/hooks/manifestWorkflowOffline.test.tsx','src-v6/__tests__/pages/TransportLegs.test.tsx','--maxWorkers=1','--no-file-parallelism']},
  types:{cwd:frontend,command:'./node_modules/.bin/tsc',args:['-b']},
  manualTests:{cwd:root,command:process.execPath,args:['--experimental-strip-types','--test','frontend/cloud-qa/manual-content.test.ts']},
  web:{cwd:frontend,command:'./node_modules/.bin/vite',args:['build','--outDir',path.join(artifacts,'web')]},
  app:{cwd:frontend,command:'./node_modules/.bin/vite',args:['build','--config','vite.config.app.ts','--outDir',path.join(artifacts,'app')]},
  fixture:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-order-fixture.ts']},
  start:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/start.ts']},
  browser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/gps-lost-response.playwright.config.ts','--project=web-desktop','--project=app']},
  audit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-lost-response-audit.ts']},
  order:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/gps-order.playwright.config.ts','--project=web-desktop','--project=app']},
  orderAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-order-audit.ts']},
  compare:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-source-compare.ts']},
  forensics:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-connection-forensics.ts']},
  connectionProbe:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-connection-probe.ts']},
  connectionAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-connection-audit.ts']},
  connectionTraceAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-connection-trace-audit.ts']},
  crossFixture:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-transition-fixture.ts']},
  crossBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/gps-cross-tab.playwright.config.ts','--project=web-desktop','--project=app']},
  crossApp:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/gps-cross-tab.playwright.config.ts','--project=app']},
  crossAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-cross-tab-audit.ts']},
  close:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/close.ts']},
};
assert.ok(phase&&commands[phase],'Unknown QA phase');
const selected=commands[phase],log=openSync(path.join(artifacts,phase+'.log'),'w',0o600);
try{
  const result=spawnSync(selected.command,selected.args,{cwd:selected.cwd,env:process.env,stdio:['ignore',log,log]});
  if(result.error)throw result.error;
  console.log(`${phase}: exit ${result.status}; log ${path.join(artifacts,phase+'.log')}`);
  if(result.status!==0)process.exitCode=result.status??1;
}finally{closeSync(log);}
