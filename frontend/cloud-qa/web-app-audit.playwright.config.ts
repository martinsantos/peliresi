import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
import handoff from './handoff.playwright.config';
const groups: Record<string,string[]> = {
 visual:['visual-surface.spec.ts'],
 'visual-detail-app':['visual-surface.spec.ts'],
 manual:['manual.spec.ts','manual-mobile-controls.spec.ts'],
 'message-continuity':['application-message-continuity.spec.ts'],
 navigation:['navigation.spec.ts','sessions.spec.ts','global-operation.spec.ts','circuit-login.spec.ts'],
 proposals:['proposal-operations.spec.ts'],
 documents:['adenda-operations.spec.ts','manifest-certificates.spec.ts'],
 transport:['transport-handoff.spec.ts','fleet-gps.spec.ts'],
 deadlines:['psip-deadlines.spec.ts'],legal:['psip-legal.spec.ts'],
 representatives:['actor-representation.spec.ts','manifest-multirole.spec.ts'],
 'external-participants':['manifest-multirole.spec.ts'],
 'actor-priority':['actor-onboarding.spec.ts'],
 actors:['actor-onboarding.spec.ts','actor-administration.spec.ts','actor-edit-history.spec.ts','circuit-transport-admin.spec.ts'],
 resilience:['public-recovery.spec.ts','registration-recovery.spec.ts','registration-unified.spec.ts'],
 mobile:['mobile-controls.spec.ts'],
 inspections:['inspection-exchange.spec.ts','inspection-hierarchy.spec.ts'],
 'inspection-context':['own-inspection-context.spec.ts'],
 eventuals:['manifest-exceptional.spec.ts'],
 publicforms:['public-wizard-layout.spec.ts','registration-documents.spec.ts'],
 inbox:['inbox.spec.ts','alert-repository.spec.ts','alert-catalogue.spec.ts'],
 maps:['map-provenance.spec.ts','map-symbol-alignment.spec.ts','monitor-live-popup.spec.ts','qr-camera.spec.ts'],
};
const group=process.env.QA_AUDIT_GROUP || 'visual';
if (!groups[group]) throw Error('Unknown audit group');
export default defineConfig({...base,projects:group==='transport'?handoff.projects:group==='visual-detail-app'?base.projects!.filter(project=>project.name==='app'):base.projects,grep:group==='external-participants'?/external reconciliation|external participant tracking/:group==='visual-detail-app'?/visual inventory: authenticated workspaces/:group==='actor-priority'?/verified draft, full declaration/:undefined,grepInvert:group==='representatives'?/external reconciliation|external participant tracking/:undefined,testMatch:groups[group],workers:1,retries:0,maxFailures:group==='visual'?0:1,timeout:300000,
 outputDir:path.join(process.env.QA_ARTIFACTS!, 'audit-'+group),
 reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!, 'audit-'+group+'.json')}]],
 use:{...base.use,serviceWorkers:'allow'},
});
