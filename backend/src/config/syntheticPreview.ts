const SYNTHETIC_SCHEMAS = new Set(['proposal_operations_20261021', 'inspection_field_20261103']);

/**
 * A rehearsal is allowed only in the isolated ephemeral QA database.
 * A UI label alone is never proof that requests are separated from production.
 */
export function syntheticPreviewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const requested = env.SITREP_SYNTHETIC_PREVIEW;
  if (requested === undefined || requested === 'false') return false;
  if (requested !== 'true') throw new Error('SYNTHETIC_PREVIEW_INVALID_SETTING');
  if (env.GITHUB_ACTIONS === 'true') throw new Error('SYNTHETIC_PREVIEW_UNSAFE_EXECUTOR');

  const required: Record<string, string> = {
    NODE_ENV: 'test', SITREP_QA_EXECUTOR: 'preview-container', ALLOW_SYNTHETIC_QA: '1',
    HOST: '127.0.0.1', ENABLE_ANALYTICS: 'false',
    DISABLE_EMAILS: 'true', PUSH_MANIFEST_NOTICES_ENABLED: 'false', BLOCKCHAIN_ENABLED: 'false',
    EMAIL_EXTERNAL_ALERTS_ENABLED: 'false', SITREP_PAUSE_BACKGROUND_JOBS: 'true',
  };
  for (const [key, value] of Object.entries(required)) {
    if (env[key] !== value) throw new Error(`SYNTHETIC_PREVIEW_UNSAFE_${key}`);
  }
  if (env.PUBLIC_DEMO_MODE === 'true') throw new Error('SYNTHETIC_PREVIEW_UNSAFE_PUBLIC_DEMO_MODE');
  for (const key of ['TRAINING_DATABASE_URL', 'EMAIL_NOTIFICATION_FAMILIES', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
    'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'BLOCKCHAIN_RPC_URL', 'BLOCKCHAIN_CONTRACT_ADDRESS']) {
    if (env[key]) throw new Error(`SYNTHETIC_PREVIEW_UNSAFE_${key}`);
  }

  let db: URL;
  try { db = new URL(env.DATABASE_URL || ''); }
  catch { throw new Error('SYNTHETIC_PREVIEW_UNSAFE_DATABASE'); }
  if (db.protocol !== 'postgresql:' || db.hostname !== '127.0.0.1' || db.port !== '55441'
    || db.pathname !== '/sitrep_ephemeral_qa_1a93' || !SYNTHETIC_SCHEMAS.has(db.searchParams.get('schema') || '')) {
    throw new Error('SYNTHETIC_PREVIEW_UNSAFE_DATABASE');
  }
  return true;
}

/** Version handshake only: this is not authentication or network isolation. */
export function syntheticPreviewRequestAllowed(enabled: boolean, method: string, path: string, header: string | undefined): boolean {
  if (!enabled) return header === undefined;
  const identityOrHealth = (method === 'GET' || method === 'HEAD')
    && ['/preview/identity', '/health', '/health/live', '/health/ready'].includes(path);
  return identityOrHealth ? header === undefined || header === '1' : header === '1';
}

/** Verify the connected server, not merely the configured connection string. */
export function assertSyntheticPreviewDatabase(rows: Array<{ name: string; port: number; address: string; schema: string; directory: string }>): void {
  if (rows.length !== 1 || rows[0].name !== 'sitrep_ephemeral_qa_1a93'
    || rows[0].port !== 55441 || rows[0].address !== '127.0.0.1'
    || !SYNTHETIC_SCHEMAS.has(rows[0].schema) || rows[0].directory !== '/qa/ephemeral-pg') {
    throw new Error('SYNTHETIC_PREVIEW_DATABASE_IDENTITY');
  }
}

export function assertSyntheticPreviewRuntime(proof: { platform: string; container: boolean; cpu: string; memory: string; swap: string; ipv4Routes: string; ipv6Routes: string; swapDevices?: string }): void {
  const cpu = proof.cpu.trim().split(/\s+/).map(Number), memory = Number(proof.memory.trim());
  const ipv4 = proof.ipv4Routes.trim().split('\n').slice(1).map(line => line.trim().split(/\s+/));
  const ipv6 = proof.ipv6Routes.trim().split('\n').filter(Boolean).map(line => line.trim().split(/\s+/));
  const externalDefault = ipv4.some(row => row[1] === '00000000' && row[0] !== 'lo')
    || ipv6.some(row => row[0] === '00000000000000000000000000000000' && row[1] === '00' && row[row.length - 1] !== 'lo');
  if (proof.platform !== 'linux' || !proof.container || cpu.length !== 2
    || !cpu.every(value => Number.isFinite(value) && value > 0) || cpu[0] > cpu[1]
    || !Number.isFinite(memory) || memory <= 0 || memory > 2147483648 || !(proof.swap.trim() === '0' || (proof.swap.trim() === 'max' && /^Filename\s+Type\s+Size\s+Used\s+Priority\s*$/.test(proof.swapDevices || '')))
    || !proof.ipv4Routes.startsWith('Iface') || externalDefault) {
    throw new Error('SYNTHETIC_PREVIEW_UNSAFE_RUNTIME');
  }
}
