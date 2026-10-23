import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config/config';
import { admissionFamily, createApiAdmission, networkAdmissionIdentity, verifiedAdmissionIdentity } from '../../middlewares/apiAdmission';
import { createAuthenticationLimiters } from '../../middlewares/authRateLimit';
import { TestAdmissionStore } from '../helpers/admissionStore';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
  })));
});
const token = (id: string, extra = {}) => jwt.sign({ id, ...extra }, config.JWT_SECRET, { expiresIn: 300 });
const requestWithToken = (value: string) => ({ headers: { authorization: 'Bearer ' + value } });
async function fixture(store = new TestAdmissionStore(), limit = 3, auth = false) {
  const app = express(); app.set('trust proxy', 1); app.use(express.json());
  app.use('/api', createApiAdmission(store, { limit }));
  if (auth) {
    const limits = createAuthenticationLimiters(store);
    app.post('/api/auth/login', ...limits.login, (req, res) => res.status(req.body.password === 'correct' ? 200 : 401).json({ success: req.body.password === 'correct' }));
    app.post('/api/auth/register', limits.registration, (_req, res) => res.status(201).json({ success: true }));
  }
  app.all('*', (_req, res) => res.json({ success: true }));
  const server = createServer(app); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const send = async (value?: string, path = '/api/notificaciones', method = 'GET', body?: object, extra: Record<string, string> = {}) => {
    const response = await fetch(base + path, { method, headers: { 'X-Forwarded-For': '198.51.100.20', ...(value ? { Authorization: 'Bearer ' + value } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, retry: response.headers.get('retry-after'), remaining: response.headers.get('ratelimit-remaining'), body: await response.json() };
  };
  return { store, send };
}

describe('identity and work-family admission', () => {
  it('admits multiple people behind one IP without pooling their quotas', async () => {
    const { send } = await fixture();
    const results = await Promise.all(['one','two','three'].flatMap(id => Array.from({ length: 3 }, () => send(token(id)))));
    expect(results.map(row => row.status)).toEqual(Array(9).fill(200));
  });
  it('isolates an abusive identity while protecting its other work families', async () => {
    const { send } = await fixture(); const session = token('one');
    for (let i=0; i<3; i++) expect((await send(session)).status).toBe(200);
    const blocked = await send(session);
    expect(blocked.status).toBe(429); expect(blocked.retry).toBe('60');
    expect(blocked.body).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 60 });
    expect((await send(token('two'))).status).toBe(200);
    expect((await send(session, '/api/manifiestos/id/ubicacion', 'POST', {})).status).toBe(200);
    expect((await send(session, '/api/manifiestos/id/aprobar', 'POST', {})).status).toBe(200);
    expect((await send(session, '/api/pdf/manifiesto/id')).status).toBe(200);
  });
  it('shares the same human quota across tokens, tabs, roles and impersonation', async () => {
    const { send } = await fixture();
    expect((await send(token('admin'))).status).toBe(200);
    expect((await send(token('admin', { rol: 'OPERADOR' }), '/api/notificaciones', 'GET', undefined, { 'X-SITREP-Activity': 'GENERADOR' })).status).toBe(200);
    expect((await send(token('actor', { impersonatedBy: 'admin' }))).status).toBe(200);
    expect((await send(token('admin', { jti: 'another-token' }))).status).toBe(429);
  });
  it('keeps anonymous, invalid and forged tokens within one network budget', async () => {
    const { send } = await fixture();
    expect((await send()).status).toBe(200);
    expect((await send('not-a-jwt')).status).toBe(200);
    expect((await send(jwt.sign({ id: 'forged' }, 'wrong-secret', { expiresIn: 300 }))).status).toBe(200);
    expect((await send(jwt.sign({ id: 'other-forged' }, 'wrong-secret', { expiresIn: 300 }))).status).toBe(429);
    expect((await send(token('real'))).status).toBe(200);
  });
  it('recovers after expiry, with independent middleware instances sharing storage', async () => {
    const store = new TestAdmissionStore(); const a = await fixture(store); const b = await fixture(store); const session = token('one');
    expect((await a.send(session)).status).toBe(200);
    expect((await b.send(session)).status).toBe(200);
    expect((await a.send(session)).status).toBe(200);
    expect((await b.send(session)).status).toBe(429);
    store.now += 60_000;
    const recovered = await b.send(session); expect(recovered.status).toBe(200); expect(recovered.remaining).toBe('2');
    expect(store.rows.size).toBe(1);
  });
  it('fails closed when shared counters are unavailable without leaking the store error', async () => {
    const store = new TestAdmissionStore(); vi.spyOn(store, 'consume').mockRejectedValue(new Error('secret-database-url'));
    const { send } = await fixture(store); const response = await send(token('one'));
    expect(response.status).toBe(503); expect(response.retry).toBe('5');
    expect(response.body.code).toBe('ADMISSION_UNAVAILABLE'); expect(JSON.stringify(response.body)).not.toContain('secret-database-url');
  });
  it('keeps liveness independent of the database while enforcing its IP cap', async () => {
    const store = new TestAdmissionStore(); vi.spyOn(store, 'consume').mockRejectedValue(new Error('db down'));
    const { send } = await fixture(store);
    for (let i=0; i<3; i++) expect((await send(undefined, '/api/health/live')).status).toBe(200);
    expect((await send(undefined, '/api/health/live')).status).toBe(429);
    expect(store.consume).not.toHaveBeenCalled();
    expect((await send(undefined, '/api/health/ready')).status).toBe(503);
  });
  it('does not let a token bypass the public login network quota', async () => {
    const { send } = await fixture();
    for (let i=0; i<3; i++) expect((await send(token('user-' + i), '/api/auth/login', 'POST', {})).status).toBe(200);
    expect((await send(token('user-4'), '/api/auth/login', 'POST', {})).status).toBe(429);
  });
});

describe('signed quota identities and route classification', () => {
  it('rejects expired, no-expiry, purpose, foreign realm and incorrect algorithm tokens', () => {
    const values = [jwt.sign({ id: 'one' }, config.JWT_SECRET, { expiresIn: -1 }), jwt.sign({ id: 'one' }, config.JWT_SECRET),
      token('one', { purpose: 'external-gps' }), token('one', { realm: 'another' }),
      jwt.sign({ id: 'one' }, config.JWT_SECRET, { algorithm: 'HS384', expiresIn: 300 }), token('one', { impersonatedBy: {} }), token('one', { trainingDirect: true })];
    for (const value of values) expect(verifiedAdmissionIdentity(requestWithToken(value))).toBeUndefined();
    expect(verifiedAdmissionIdentity(requestWithToken(token('one')))).toBe(JSON.stringify(['operational','one']));
  });
  it('groups IPv6 clients by prefix, not interchangeable interface addresses', () => {
    expect(networkAdmissionIdentity({ ip: '2001:db8:1234:5600::1' })).toBe(networkAdmissionIdentity({ ip: '2001:db8:1234:56ff::2' }));
    expect(networkAdmissionIdentity({ ip: '2001:db8:1234:5600::1' })).not.toBe(networkAdmissionIdentity({ ip: '2001:db8:1234:5700::1' }));
  });
  it('recognizes actual route families without arbitrary client-selected headers', () => {
    expect(admissionFamily({ method: 'POST', originalUrl: '/api/manifiestos/abc/ubicacion?x=1' })).toBe('gps');
    expect(admissionFamily({ method: 'POST', originalUrl: '/api/manifiestos/abc/aprobar' })).toBe('writes');
    expect(admissionFamily({ method: 'GET', originalUrl: '/api/pdf/manifiesto/abc' })).toBe('documents');
    expect(admissionFamily({ method: 'GET', originalUrl: '/api/manifiestos/abc/certificados/id.pdf' })).toBe('documents');
    expect(admissionFamily({ method: 'GET', originalUrl: '/api/notificaciones' })).toBe('reads');
    expect(admissionFamily({ method: 'GET', originalUrl: '/api/manifiestos/abc/certificados/cert/archivo' })).toBe('documents');
  });
});

describe('shared authentication failure counters', () => {
  it('enforces normalized identity failures across instances without blocking another person', async () => {
    const store = new TestAdmissionStore(); const a = await fixture(store, 600, true); const b = await fixture(store, 600, true);
    for (let i=0; i<5; i++) expect((await (i%2 ? a : b).send(undefined, '/api/auth/login', 'POST', { email: 'person@example.invalid', password: 'wrong' })).status).toBe(401);
    expect((await b.send(undefined, '/api/auth/login', 'POST', { email: ' PERSON@EXAMPLE.INVALID ', password: 'wrong' })).status).toBe(429);
    expect((await a.send(undefined, '/api/auth/login', 'POST', { email: 'different@example.invalid', password: 'correct' })).status).toBe(200);
  });
  it('releases successful logins, keeps registration capped and never stores cleartext identity', async () => {
    const { send, store } = await fixture(new TestAdmissionStore(), 600, true);
    for (let i=0; i<12; i++) expect((await send(undefined, '/api/auth/login', 'POST', { email: 'person@example.invalid', password: 'correct' })).status).toBe(200);
    for (let i=0; i<5; i++) expect((await send(undefined, '/api/auth/register', 'POST', { email: 'person@example.invalid' })).status).toBe(201);
    expect((await send(undefined, '/api/auth/register', 'POST', { email: 'another@example.invalid' })).status).toBe(429);
    expect([...store.rows.keys()].every(key => /^[a-f0-9]{64}$/.test(key))).toBe(true);
  });
});
