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
const syncBaseline=process.env.SITREP_QA_RUN==='sync-baseline-20261029';
const syncTab=process.env.SITREP_QA_RUN==='sync-crosstab-20261029';
const roleBaseline=process.env.SITREP_QA_RUN==='sync-role-baseline-20261029';
const roleFix=process.env.SITREP_QA_RUN==='sync-role-fix-20261029';
const tripBaseline=process.env.SITREP_QA_RUN==='trip-scope-baseline-20261029';
const tripFix=process.env.SITREP_QA_RUN==='trip-scope-fix-20261029';
const deliveryBaseline=process.env.SITREP_QA_RUN==='delivery-lost-baseline-20261029';
const deliveryFix=process.env.SITREP_QA_RUN==='delivery-lost-fix-20261029';
const deliveryNoticeBaseline=process.env.SITREP_QA_RUN==='delivery-notice-baseline-20261029';
const deliveryNotice=process.env.SITREP_QA_RUN==='delivery-notice-atomic-20261029';
const gpsStorageBaseline=process.env.SITREP_QA_RUN==='gps-storage-baseline-20261029';
const gpsStorageFix=process.env.SITREP_QA_RUN==='gps-storage-fix-20261029';
assert.ok(!process.env.SITREP_QA_RUN||connectionAudit||crossTab||syncBaseline||syncTab||roleBaseline||roleFix||tripBaseline||tripFix||deliveryBaseline||deliveryFix||deliveryNoticeBaseline||deliveryNotice||gpsStorageBaseline||gpsStorageFix,'Unknown QA run');
const artifacts=connectionAudit?'/work/sitrep/.qa-gps-connection-20261029':crossTab?'/work/sitrep/.qa-gps-crosstab-20261029':syncBaseline?'/work/sitrep/.qa-sync-baseline-20261029':syncTab?'/work/sitrep/.qa-sync-crosstab-20261029':roleBaseline?'/work/sitrep/.qa-sync-role-baseline-20261029':roleFix?'/work/sitrep/.qa-sync-role-fix-20261029':tripBaseline?'/work/sitrep/.qa-trip-scope-baseline-20261029':tripFix?'/work/sitrep/.qa-trip-scope-fix-20261029':deliveryBaseline?'/work/sitrep/.qa-delivery-lost-baseline-20261029':deliveryFix?'/work/sitrep/.qa-delivery-lost-fix-20261029':deliveryNoticeBaseline?'/work/sitrep/.qa-delivery-notice-baseline-20261029':deliveryNotice?'/work/sitrep/.qa-delivery-notice-atomic-20261029':gpsStorageBaseline?'/work/sitrep/.qa-gps-storage-baseline-20261029':gpsStorageFix?'/work/sitrep/.qa-gps-storage-fix-20261029':'/work/sitrep/.qa-gps-lost-response-20261029';
const compiled=connectionAudit?'/work/sitrep/.qa-gps-lost-response-20261029':syncBaseline?'/work/sitrep/.qa-gps-crosstab-20261029':deliveryBaseline?'/work/sitrep/.qa-trip-scope-fix-20261029':deliveryNoticeBaseline?'/work/sitrep/.qa-delivery-lost-fix-20261029':gpsStorageBaseline?'/work/sitrep/.qa-delivery-notice-atomic-20261029':artifacts;
Object.assign(process.env,{
  CI:'true',SITREP_QA_EXECUTOR:'preview-container',GITHUB_REPOSITORY:'martinsantos/peliresi',
  GITHUB_REF:'refs/heads/codex/sitrep-training-20261018',GITHUB_SHA:connectionAudit?'e0b77d09-connection-audit':crossTab?'a8115926-with-gps-crosstab-uncommitted':syncBaseline?'eb0596a4-sync-baseline':syncTab?'eb0596a4-with-sync-crosstab-uncommitted':roleBaseline?'85858bf7-sync-role-baseline':roleFix?'85858bf7-with-sync-role-uncommitted':tripBaseline?'2b2bfada-trip-scope-baseline':tripFix?'2b2bfada-with-trip-scope-uncommitted':deliveryBaseline?'38c2f60b-delivery-baseline':deliveryFix?'38c2f60b-with-delivery-uncommitted':deliveryNoticeBaseline?'b6a2b1a8-delivery-notice-baseline':deliveryNotice?'b6a2b1a8-with-delivery-notices-uncommitted':gpsStorageBaseline?'738ce48e-gps-storage-baseline':gpsStorageFix?'738ce48e-with-gps-storage-uncommitted':'f44cf957-with-gps-retry-uncommitted',
  ALLOW_SYNTHETIC_QA:'1',DATABASE_URL:'postgresql://qa@127.0.0.1:55440/sitrep_night_qa_20260926?schema=proposal_operations_20261021'+(deliveryNotice||gpsStorageBaseline||gpsStorageFix?'&connection_limit=4&pool_timeout=10':''),
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
// The multi-role scenario is enabled only in these disposable preview processes.
if(deliveryFix||deliveryNoticeBaseline||deliveryNotice||gpsStorageBaseline||gpsStorageFix)Object.assign(process.env,{VITE_MANIFEST_TRANSPORT_HANDOFF_ENABLED:'true'});
if(roleBaseline||roleFix||tripBaseline||tripFix||deliveryFix||deliveryNoticeBaseline||deliveryNotice||gpsStorageBaseline||gpsStorageFix)Object.assign(process.env,{ACTOR_MULTIROLE_ENABLED:'true',VITE_ACTOR_MULTIROLE_ENABLED:'true'});
if(tripBaseline||tripFix||deliveryFix||deliveryNoticeBaseline||deliveryNotice||gpsStorageBaseline||gpsStorageFix)Object.assign(process.env,{ENTERPRISE_ENABLED:'true',VITE_ENTERPRISE_ENABLED:'true'});
if(deliveryNoticeBaseline)process.env.QA_DELIVERY_NOTICE_BASELINE='true';
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
  deliveryBackendTests:{cwd:backend,command:'./node_modules/.bin/vitest',args:['run','src/__tests__/controllers/manifiestoDelivery.idempotency.test.ts','src/__tests__/controllers/manifiestoGps.idempotency.test.ts','src/__tests__/controllers/transportHandoffAccess.test.ts','--maxWorkers=1','--no-file-parallelism']},
  deliveryNoticeTests:{cwd:backend,command:'./node_modules/.bin/vitest',args:['run','src/__tests__/controllers/manifiestoDelivery.idempotency.test.ts','src/__tests__/services/manifestDeliveryNotice.test.ts','src/__tests__/services/manifestRuleCompanyNotice.test.ts','src/__tests__/subscribers/manifestOperationalNotice.test.ts','src/__tests__/services/notification-mail.test.ts','--maxWorkers=1','--no-file-parallelism']},
  deliveryNoticeFrontendTests:{cwd:frontend,command:'./node_modules/.bin/vitest',args:['run','src-v6/__tests__/components/CompanyNoticeAction.test.tsx','src-v6/__tests__/utils/notificationNavigation.test.ts','--maxWorkers=1','--no-file-parallelism']},
  gpsStorageTests:{cwd:frontend,command:'./node_modules/.bin/vitest',args:['run','src-v6/__tests__/services/gpsCoordination.test.ts','src-v6/__tests__/services/gpsQueue.test.ts','src-v6/__tests__/hooks/useGPSTracking.test.tsx','src-v6/__tests__/hooks/useGPSTracking.safety.test.tsx','src-v6/__tests__/components/mobile/GpsStatusPanel.test.tsx','src-v6/__tests__/pages/CargasEnCursoPage.test.tsx','src-v6/__tests__/hooks/manifestWorkflowOffline.test.tsx','--maxWorkers=1','--no-file-parallelism']},
  deliveryFrontendTests:{cwd:frontend,command:'./node_modules/.bin/vitest',args:['run','src-v6/__tests__/services/deliveryCommand.test.ts','src-v6/__tests__/services/tripSnapshot.test.ts','src-v6/__tests__/components/mobile/TripActionBar.test.tsx','src-v6/__tests__/services/offlineSyncEvents.test.ts','src-v6/__tests__/services/offlineSyncSessionBoundary.test.ts','src-v6/__tests__/services/offlineQueueRetention.test.ts','src-v6/__tests__/services/syncQueuePolicy.test.ts','src-v6/__tests__/hooks/usePendingDeliveryIds.test.tsx','src-v6/__tests__/hooks/useOfflineSync.context.test.tsx','src-v6/__tests__/hooks/useActiveTripRecovery.context.test.tsx','src-v6/__tests__/hooks/manifestWorkflowOffline.test.tsx','src-v6/__tests__/pages/CargasEnCursoPage.test.tsx','src-v6/__tests__/pages/ManifestActions.test.tsx','src-v6/__tests__/pages/ManifiestoActorNavigation.test.tsx','src-v6/__tests__/hooks/useGPSTracking.safety.test.tsx','--maxWorkers=1','--no-file-parallelism']},
  frontendTests:{cwd:frontend,command:'./node_modules/.bin/vitest',args:['run','src-v6/__tests__/hooks/useFleetGps.test.ts','src-v6/__tests__/pages/RelevoGpsPage.test.tsx','src-v6/__tests__/pages/CargasEnCursoPage.test.tsx','src-v6/__tests__/services/limitedTransportGps.test.ts','src-v6/__tests__/services/fleetGps.test.ts','src-v6/__tests__/services/gpsQueue.test.ts','--maxWorkers=1','--no-file-parallelism']},
  crossTests:{cwd:frontend,command:'./node_modules/.bin/vitest',args:['run','src-v6/__tests__/services/gpsCoordination.test.ts','src-v6/__tests__/services/gpsTransition.test.ts','src-v6/__tests__/services/offlineSyncSessionBoundary.test.ts','src-v6/__tests__/hooks/useGPSTracking.test.tsx','src-v6/__tests__/hooks/useGPSTracking.safety.test.tsx','src-v6/__tests__/pages/CargasEnCursoPage.test.tsx','src-v6/__tests__/hooks/manifestWorkflowOffline.test.tsx','src-v6/__tests__/pages/TransportLegs.test.tsx','--maxWorkers=1','--no-file-parallelism']},
  syncTests:{cwd:frontend,command:'./node_modules/.bin/vitest',args:['run','src-v6/__tests__/services/offlineSyncSessionBoundary.test.ts','src-v6/__tests__/services/syncQueuePolicy.test.ts','src-v6/__tests__/services/syncFailureClassification.test.ts','src-v6/__tests__/services/gpsCoordination.test.ts','src-v6/__tests__/services/gpsTransition.test.ts','src-v6/__tests__/hooks/useGPSTracking.safety.test.tsx','src-v6/__tests__/hooks/useOfflineSync.context.test.tsx','src-v6/__tests__/hooks/restrictedBackground.test.tsx','src-v6/__tests__/components/OfflineSyncNotice.test.tsx','--maxWorkers=1','--no-file-parallelism']},
  tripScopeTests:{cwd:frontend,command:'./node_modules/.bin/vitest',args:['run','src-v6/__tests__/services/tripSnapshot.test.ts','src-v6/__tests__/services/offlineSyncSessionBoundary.test.ts','src-v6/__tests__/services/gpsCoordination.test.ts','src-v6/__tests__/services/gpsTransition.test.ts','src-v6/__tests__/hooks/useGPSTracking.safety.test.tsx','src-v6/__tests__/hooks/restrictedBackground.test.tsx','src-v6/__tests__/hooks/useActiveTripRecovery.context.test.tsx','src-v6/__tests__/hooks/manifiestoListOffline.test.tsx','src-v6/__tests__/pages/mobile/MobileProposalContinuity.test.tsx','src-v6/__tests__/layouts/MobileLayout.test.tsx','src-v6/__tests__/components/OfflineSyncNotice.test.tsx','--maxWorkers=1','--no-file-parallelism']},
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
  syncBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/sync-cross-tab.playwright.config.ts','--project=web-desktop','--project=app']},
  syncApp:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/sync-cross-tab.playwright.config.ts','--project=app']},
  syncAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/sync-cross-tab-audit.ts']},
  roleFixture:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/sync-role-fixture.ts']},
  roleBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/sync-role.playwright.config.ts','--project=web-desktop','--project=app']},
  roleAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/sync-role-audit.ts']},
  tripScopeFixture:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/trip-scope-fixture.ts']},
  tripScopeBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/trip-scope.playwright.config.ts','--project=web-desktop','--project=app']},
  tripScopeAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/trip-scope-audit.ts']},
  deliveryBaselineBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/delivery-lost-baseline.playwright.config.ts','--project=web-desktop','--project=app']},
  deliveryBaselineAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/delivery-lost-baseline-audit.ts']},
  deliveryFixture:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/delivery-recovery-fixture.ts']},
  deliveryBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/delivery-recovery.playwright.config.ts','--project=web-desktop','--project=app']},
  deliveryOfflineBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/delivery-recovery.playwright.config.ts','--project=web-desktop','--project=app','--grep','offline delivery survives closing']},
  deliveryAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/delivery-recovery-audit.ts']},
  deliveryNoticeAtomic:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/delivery-notice-atomic.ts']},
  deliveryNoticeCompany:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/delivery-notice-company.ts']},
  deliveryNoticeCompanyBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/delivery-notice-company.playwright.config.ts','--project=web-desktop','--project=app']},
  gpsStorageBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/gps-storage-baseline.playwright.config.ts','--project=web-desktop','--project=app']},
  gpsStorageAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-storage-baseline-audit.ts']},
  gpsStorageFixBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/gps-storage-fix.playwright.config.ts','--project=web-desktop','--project=app']},
  gpsStorageFixAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-storage-fix-audit.ts']},
  deliveryGpsFixture:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-delivery-fixture.ts']},
  deliveryGpsBrowser:{cwd:frontend,command:'./node_modules/.bin/playwright',args:['test','--config','cloud-qa/gps-delivery.playwright.config.ts','--project=web-desktop','--project=app']},
  deliveryGpsAudit:{cwd:root,command:process.execPath,args:['--experimental-strip-types','frontend/cloud-qa/gps-delivery-audit.ts']},
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
