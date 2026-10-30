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
