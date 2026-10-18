import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordAccountChanges, recordAccountMail, renderAccountMail, type AccountMailEvent } from '../../services/account-mail.service';
const insert = vi.fn();
const tx = { emailQueue: { create: insert } } as never;
const recipient = { id: 'qa', email: 'previous@example.invalid', emailVerified: true, rol: 'GENERADOR', activo: true };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('DISABLE_EMAILS', 'true'); vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', ''); vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE', new Date(Date.now() - 1000).toISOString()); });
afterEach(() => vi.unstubAllEnvs());
describe('atomic account outbox', () => {
  it.each<AccountMailEvent>(['created', 'enabled', 'disabled', 'deleted', 'roleChanged', 'emailChanged', 'passwordChanged'])('%s stays terminal while delivery is disabled', async event => {
    await recordAccountMail(tx, recipient, event);
    expect(insert).toHaveBeenCalledWith({ data: expect.objectContaining({ estado: 'SUPRIMIDO', error: 'EMAIL_DISABLED', to: recipient.email, prioridad: 'CRITICA', tipo: 'TRANSACCIONAL' }) });
    const content = renderAccountMail(event);
    expect(content.html).toContain('SITREP'); expect(content.subject).not.toContain(recipient.email);
    expect(content.html).not.toContain('password='); expect(content.html).not.toContain('token=');
  });
  it('requires a separate account family activation even if SMTP is enabled', async () => {
    vi.stubEnv('DISABLE_EMAILS', 'false');
    await recordAccountMail(tx, recipient, 'created');
    expect(insert.mock.calls[0][0].data).toMatchObject({ estado: 'SUPRIMIDO', error: 'EVENT_NOT_ENABLED' });
  });
  it('does not notify an unverified address', async () => {
    vi.stubEnv('DISABLE_EMAILS', 'false'); vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'cuentas');
    await recordAccountMail(tx, { ...recipient, emailVerified: false }, 'created');
    expect(insert.mock.calls[0][0].data).toMatchObject({ estado: 'SUPRIMIDO', error: 'RECIPIENT_NOT_VERIFIED' });
  });
  it('records a sendable outbox item only with all gates passed, without sending', async () => {
    vi.stubEnv('DISABLE_EMAILS', 'false'); vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'cuentas');
    await recordAccountMail(tx, recipient, 'passwordChanged');
    expect(insert.mock.calls[0][0].data).toMatchObject({ estado: 'PENDIENTE', error: 'NOTIFICATION_READY' });
    expect(insert).toHaveBeenCalledTimes(1);
  });
  it('propagates persistence failure so the account transaction can roll back', async () => {
    insert.mockRejectedValue(new Error('outbox unavailable'));
    await expect(recordAccountMail(tx, recipient, 'deleted')).rejects.toThrow('outbox unavailable');
  });
  it('does not create mail when watched fields did not change', async () => {
    await recordAccountChanges(tx, recipient, { ...recipient }); expect(insert).not.toHaveBeenCalled();
  });
  it('reports address, role and deactivation changes to the old verified address, not the new one', async () => {
    await recordAccountChanges(tx, recipient, { email: 'new@example.invalid', rol: 'OPERADOR', activo: false });
    expect(insert).toHaveBeenCalledTimes(3);
    for (const [call] of insert.mock.calls) expect(call.data.to).toBe(recipient.email);
    expect(insert.mock.calls.map(([call]) => call.data.subject)).toEqual([
      '[SITREP] Correo de cuenta modificado', '[SITREP] Permisos de cuenta modificados', '[SITREP] Cuenta deshabilitada',
    ]);
  });
});
