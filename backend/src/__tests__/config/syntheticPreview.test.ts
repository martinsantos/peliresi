import { describe, expect, it } from 'vitest';
import { assertSyntheticPreviewDatabase, assertSyntheticPreviewRuntime, syntheticPreviewEnabled, syntheticPreviewRequestAllowed } from '../../config/syntheticPreview';

const safe = (): NodeJS.ProcessEnv => ({
  SITREP_SYNTHETIC_PREVIEW: 'true', NODE_ENV: 'test', SITREP_QA_EXECUTOR: 'preview-container', ALLOW_SYNTHETIC_QA: '1',
  HOST: '127.0.0.1', ENABLE_ANALYTICS: 'false',
  DATABASE_URL: 'postgresql://qa:synthetic@127.0.0.1:55441/sitrep_ephemeral_qa_1a93?schema=proposal_operations_20261021',
  DISABLE_EMAILS: 'true', PUSH_MANIFEST_NOTICES_ENABLED: 'false', BLOCKCHAIN_ENABLED: 'false',
  EMAIL_EXTERNAL_ALERTS_ENABLED: 'false', SITREP_PAUSE_BACKGROUND_JOBS: 'true',
});

describe('synthetic preview safety gate', () => {
  it('leaves existing operation unchanged unless explicitly requested', () => {
    expect(syntheticPreviewEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(syntheticPreviewEnabled({ SITREP_SYNTHETIC_PREVIEW: 'false', NODE_ENV: 'production' })).toBe(false);
  });
  it('allows only the isolated synthetic configuration', () => expect(syntheticPreviewEnabled(safe())).toBe(true));
  it('rejects mismatched clients without treating the header as authentication', () => {
    for (const path of ['/preview/identity', '/health', '/health/live', '/health/ready']) {
      expect(syntheticPreviewRequestAllowed(true, 'GET', path, undefined)).toBe(true);
      expect(syntheticPreviewRequestAllowed(true, 'HEAD', path, undefined)).toBe(true);
      expect(syntheticPreviewRequestAllowed(true, 'POST', path, undefined)).toBe(false);
    }
    for (const path of ['/auth/login', '/manifiestos', '/health/live/other', '/preview/identity/other']) {
      expect(syntheticPreviewRequestAllowed(true, 'GET', path, undefined)).toBe(false);
      expect(syntheticPreviewRequestAllowed(true, 'POST', path, '1')).toBe(true);
      expect(syntheticPreviewRequestAllowed(true, 'POST', path, '1, 1')).toBe(false);
    }
    expect(syntheticPreviewRequestAllowed(false, 'POST', '/manifiestos', undefined)).toBe(true);
    expect(syntheticPreviewRequestAllowed(false, 'POST', '/manifiestos', '1')).toBe(false);
  });
  it.each([
    ['SITREP_SYNTHETIC_PREVIEW', 'yes'], ['NODE_ENV', 'production'], ['SITREP_QA_EXECUTOR', 'other'],
    ['ALLOW_SYNTHETIC_QA', '0'], ['GITHUB_ACTIONS', 'true'], ['DISABLE_EMAILS', 'false'], ['PUSH_MANIFEST_NOTICES_ENABLED', 'true'],
    ['HOST', '0.0.0.0'], ['ENABLE_ANALYTICS', 'true'], ['PUBLIC_DEMO_MODE', 'true'],
    ['BLOCKCHAIN_ENABLED', 'true'], ['EMAIL_EXTERNAL_ALERTS_ENABLED', 'true'], ['SITREP_PAUSE_BACKGROUND_JOBS', 'false'],
    ['TRAINING_DATABASE_URL', 'postgresql://school@127.0.0.1/school'], ['EMAIL_NOTIFICATION_FAMILIES', 'all'],
    ['SMTP_HOST', 'mail.example.invalid'], ['VAPID_PRIVATE_KEY', 'unexpected'], ['BLOCKCHAIN_RPC_URL', 'https://example.invalid'],
    ['DATABASE_URL', 'postgresql://qa:synthetic@127.0.0.1:55441/real?schema=proposal_operations_20261021'],
    ['DATABASE_URL', 'postgresql://qa:synthetic@remote.invalid:55441/sitrep_ephemeral_qa_1a93?schema=proposal_operations_20261021'],
    ['DATABASE_URL', 'postgresql://qa:synthetic@127.0.0.1:55441/sitrep_ephemeral_qa_1a93?schema=public'],
    ['DATABASE_URL', 'not-a-url'],
  ])('rejects an unsafe %s setting', (key, value) => {
    expect(() => syntheticPreviewEnabled({ ...safe(), [key]: value })).toThrow(/SYNTHETIC_PREVIEW_/);
  });
  it('checks the actual connected database identity', () => {
    expect(() => assertSyntheticPreviewDatabase([{ name: 'sitrep_ephemeral_qa_1a93', port: 55441, address: '127.0.0.1', schema: 'proposal_operations_20261021', directory: '/qa/ephemeral-pg' }])).not.toThrow();
    expect(() => assertSyntheticPreviewDatabase([{ name: 'production', port: 55441, address: '127.0.0.1', schema: 'proposal_operations_20261021', directory: '/qa/ephemeral-pg' }])).toThrow(/DATABASE_IDENTITY/);
    expect(() => assertSyntheticPreviewDatabase([{ name: 'sitrep_ephemeral_qa_1a93', port: 5432, address: '127.0.0.1', schema: 'proposal_operations_20261021', directory: '/qa/ephemeral-pg' }])).toThrow(/DATABASE_IDENTITY/);
    expect(() => assertSyntheticPreviewDatabase([{ name: 'sitrep_ephemeral_qa_1a93', port: 55441, address: '127.0.0.1', schema: 'public', directory: '/qa/ephemeral-pg' }])).toThrow(/DATABASE_IDENTITY/);
    expect(() => assertSyntheticPreviewDatabase([{ name: 'sitrep_ephemeral_qa_1a93', port: 55441, address: '127.0.0.1', schema: 'proposal_operations_20261021', directory: '/var/lib/postgresql/data' }])).toThrow(/DATABASE_IDENTITY/);
    expect(() => assertSyntheticPreviewDatabase([])).toThrow(/DATABASE_IDENTITY/);
  });
  it('requires the limited Linux container used by synthetic QA', () => {
    const runtime = { platform: 'linux', container: true, cpu: '100000 100000', memory: '2147483648', swap: '0',
      ipv4Routes: 'Iface Destination Gateway\neth0 00001BAC 00000000', ipv6Routes: '' };
    expect(() => assertSyntheticPreviewRuntime(runtime)).not.toThrow();
    for (const changed of [{ platform: 'darwin' }, { container: false }, { cpu: 'max 100000' },
      { cpu: '200000 100000' }, { memory: 'max' }, { memory: '2147483649' }, { swap: '1' },
      { ipv4Routes: 'Iface Destination Gateway\neth0 00000000 010011AC' },
      { ipv6Routes: '00000000000000000000000000000000 00 00000000000000000000000000000000 00 eth0' }]) {
      expect(() => assertSyntheticPreviewRuntime({ ...runtime, ...changed })).toThrow(/UNSAFE_RUNTIME/);
    }
  });
});
