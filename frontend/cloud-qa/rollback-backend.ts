import path from 'node:path';
import { root } from './safety.ts';

/** Only the dedicated, isolated rollback rehearsal may load the old build. */
export function qaBackendEntry(env = process.env): string {
  const version = env.QA_COMPAT_BACKEND || 'current';
  if (version === 'current') return path.join(root, 'backend/dist/index.js');
  if (version === 'closure-67f330a7'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-operational-ui-current2026103070') {
    return path.join(root, 'backend/dist-qa-closure-67f330a7/index.js');
  }
  if (version === 'receipt-link-67f330a7'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-receipt-link-20261030') {
    return path.join(root, 'backend/dist-qa-closure-67f330a7/index.js');
  }
  if (version === 'receipt-document-before'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-receipt-document-20261030') {
    return path.join(root, 'backend/dist-qa-closure-67f330a7/index.js');
  }
  if (version === 'receipt-document-after'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-receipt-document-20261030') {
    return path.join(root, 'backend/dist-qa-receipt-document-20261030/index.js');
  }
  if (version === 'actor-receipt-438e5b02'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-actor-receipt-20261030') {
    return path.join(root, 'backend/dist-qa-receipt-document-20261030/index.js');
  }
  if (version === 'eventual-site-before'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-eventual-site-20261030') {
    return path.join(root, 'backend/dist-qa-receipt-document-20261030/index.js');
  }
  if (version === 'eventual-site-after'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-eventual-site-20261030') {
    return path.join(root, 'backend/dist-qa-eventual-site-20261030/index.js');
  }
  if (version === 'eventual-context-before'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-eventual-context-20261030') {
    return path.join(root, 'backend/dist-qa-eventual-site-20261030/index.js');
  }
  if (version === 'eventual-context-after'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-eventual-context-20261030') {
    return path.join(root, 'backend/dist-qa-eventual-context-20261030/index.js');
  }
  if (version === 'eventual-notice-after'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-eventual-notices-20261030') {
    return path.join(root, 'backend/dist-qa-eventual-notices-20261030/index.js');
  }
  if (version === 'eventual-draft'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-eventual-draft-20261030') {
    return path.join(root, 'backend/dist-qa-eventual-notices-20261030/index.js');
  }
  if (version === 'eventual-event-draft'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-eventual-event-draft-20261030') {
    return path.join(root, 'backend/dist-qa-eventual-notices-20261030/index.js');
  }
  if (version === 'eventual-edit-lock'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-eventual-edit-lock-20261030') {
    return path.join(root, 'backend/dist-qa-eventual-notices-20261030/index.js');
  }
  if (version === 'addendum-recovery'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-adenda-recovery-20261030') {
    return path.join(root, 'backend/dist-qa-eventual-notices-20261030/index.js');
  }
  if (version === 'fleet-freshness'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-fleet-freshness-20261030') {
    return path.join(root, 'backend/dist-qa-eventual-notices-20261030/index.js');
  }
  if (version === 'signature-representatives'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-signature-representatives-20261030') {
    return path.join(root, 'backend/dist-qa-signature-representatives-20261030/index.js');
  }
  if (version === 'operation-reminders'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-operation-reminders-20261030') {
    return path.join(root, 'backend/dist-qa-operation-reminders-20261030/index.js');
  }
  if (version === 'manifest-owner-before'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-manifest-owner-20261030') {
    return path.join(root, 'backend/dist-qa-operation-reminders-20261030/index.js');
  }
  if (version === 'manifest-owner-after'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-manifest-owner-20261030') {
    return path.join(root, 'backend/dist-qa-manifest-owner-20261030/index.js');
  }
  if (version === 'manifest-followup'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-followup-notice-20261030') {
    return path.join(root, 'backend/dist-qa-followup-notice-20261030/index.js');
  }
  if (version === 'closure-d7d29dde'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-operational-ui-current2026103080') {
    return path.join(root, 'backend/dist-qa-closure-d7d29dde/index.js');
  }
  if (version === 'closure-52b3bec4'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-operational-ui-current2026103090') {
    return path.join(root, 'backend/dist-qa-closure-52b3bec4/index.js');
  }
  if (version === 'approval-notice-fix'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-approval-notice-20261030') {
    return path.join(root, 'backend/dist-qa-approval-notice-20261030/index.js');
  }
  if (version === 'approval-notice-short'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-approval-notice-short-20261030') {
    return path.join(root, 'backend/dist-qa-approval-notice-short-20261030/index.js');
  }
  if (version === 'certificate-layout'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-certificate-layout-20261030') {
    return path.join(root, 'backend/dist-qa-approval-notice-short-20261030/index.js');
  }
  if (version === 'actor-overview'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-actor-overview-20261031') {
    return path.join(root, 'backend/dist-qa-actor-overview-20261031/index.js');
  }
  if (version === 'inspection-opening'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-inspection-opening-20261031') {
    return path.join(root, 'backend/dist-qa-actor-overview-20261031/index.js');
  }
  if (version === 'pwa-continuity'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-pwa-continuity-20261031') {
    return path.join(root, 'backend/dist-qa-actor-overview-20261031/index.js');
  }
  if (version === 'closure-c95cd81e'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-operational-ui-current2026103110') {
    return path.join(root, 'backend/dist-qa-actor-overview-20261031/index.js');
  }
  if (version === 'closure-971727a3'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-operational-ui-current2026103111') {
    return path.join(root, 'backend/dist-qa-actor-overview-20261031/index.js');
  }
  if (version === 'support-notices-20261031'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-support-notices-20261031') {
    return path.join(root, 'backend/dist-qa-support-notices-20261031/index.js');
  }
  if (version === 'support-mail-20261031'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-support-mail-20261031') {
    return path.join(root, 'backend/dist-qa-support-mail-20261031/index.js');
  }
  if (version === 'support-refresh-20261031'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-support-refresh-20261031') {
    return path.join(root, 'backend/dist-qa-support-mail-20261031/index.js');
  }
  if (version === 'support-feedback-20261031'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-support-feedback-20261031') {
    return path.join(root, 'backend/dist-qa-support-mail-20261031/index.js');
  }
  if (version === 'closure-ce2eb1cb'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-operational-ui-current2026103112') {
    return path.join(root, 'backend/dist-qa-support-mail-20261031/index.js');
  }
  if (version === 'certificate-receipt-ux'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-certificate-receipt-ux-20261030') {
    return path.join(root, 'backend/dist-qa-closure-d7d29dde/index.js');
  }
  if (version === 'help-gps-consistency'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-help-gps-consistency-20261030') {
    return path.join(root, 'backend/dist-qa-closure-d7d29dde/index.js');
  }
  if (version === 'inspection-company'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-inspection-representative-20261030') {
    return path.join(root, 'backend/dist-qa-psip-company-20261030-v2/index.js');
  }
  if (version === 'inspection-deadline-company-before'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-inspection-deadline-company-20261030') {
    return path.join(root, 'backend/dist-qa-psip-company-20261030-v2/index.js');
  }
  if (version === 'inspection-deadline-company-after'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-inspection-deadline-company-20261030') {
    return path.join(root, 'backend/dist-qa-psip-deadline-company-20261030-v3/index.js');
  }
  if (version === 'inspection-deadline-direct'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-inspection-deadline-company-20261030') {
    return path.join(root, 'backend/dist-qa-psip-deadline-company-20261030-v4/index.js');
  }
  if (version === 'inspection-deadline-authority'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-inspection-deadline-company-20261030') {
    return path.join(root, 'backend/dist-qa-psip-deadline-company-20261030-v5/index.js');
  }
  if (version === 'inspection-deadline-polished'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-inspection-deadline-company-20261030') {
    return path.join(root, 'backend/dist-qa-psip-deadline-company-20261030-v6/index.js');
  }
  if (version === '17152d81'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-rollback-partial-20261030') {
    return path.join(root, '.qa-rollback-partial-20261030/snapshot/backend/dist/index.js');
  }
  if (version === '8fb6277e'
    && env.QA_ARTIFACTS === '/work/sitrep/.qa-rollback-partial-20261030') {
    return path.join(root, '.qa-rollback-partial-20261030/snapshot-8fb/backend/dist/index.js');
  }
  throw new Error('Destino de backend no autorizado para el ensayo aislado');
}
