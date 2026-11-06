import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { mailboxProof, requestMailboxProof } from '../../services/mailboxProof.service';

const owner = { id: 'actor-qa', email: 'actual@example.invalid', nombre: 'Práctica' };
const destination = 'nueva@example.invalid';
function transaction() {
  const update = vi.fn().mockResolvedValue({});
  const create = vi.fn().mockResolvedValue({});
  const tx = { usuario: { update }, emailQueue: { create } } as unknown as Prisma.TransactionClient;
  return { tx, update, create };
}

describe('confirmación del buzón', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubEnv('DISABLE_EMAILS', 'true'); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it('ata el cambio a la casilla anterior y al enlace vigente sin cambiar el login al solicitarlo', async () => {
    const { tx, update, create } = transaction();
    await requestMailboxProof(tx, owner, destination, 'change');
    const data = update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('email');
    expect(data.passwordResetToken).toBeNull();
    const message = create.mock.calls[0][0].data;
    expect(message).toMatchObject({ to: destination, estado: 'SUPRIMIDO' });
    const token = message.html.match(/token=(m\.actor-qa\.[a-f0-9]{64})/)[1];
    expect(data.emailVerificationToken).not.toContain(token);
    const digest = createHash('sha256').update(token).digest('hex');
    expect(mailboxProof(data.emailVerificationToken, digest, owner.email)).toEqual({ purpose: 'change', email: destination });
    expect(mailboxProof(data.emailVerificationToken, digest, destination)).toBeNull();
    await requestMailboxProof(tx, owner, destination, 'change');
    expect(mailboxProof(update.mock.calls[1][0].data.emailVerificationToken, digest, owner.email)).toBeNull();
    vi.advanceTimersByTime(86_400_000);
    expect(mailboxProof(data.emailVerificationToken, digest, owner.email)).toBeNull();
  });
});
