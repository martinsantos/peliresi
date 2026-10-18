import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createAuthenticationLimiters } from '../../middlewares/authRateLimit';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
  })));
});
async function fixture() {
  const app = express(); app.use(express.json());
  const limits = createAuthenticationLimiters();
  app.post('/login', ...limits.login, async (req, res) => {
    // Only the middleware is under test here. Real login is exercised in cloud HTTP/E2E.
    if (req.body.password === 'qa-valid') {
      await new Promise(resolve => setTimeout(resolve, 20)); res.json({ success: true });
    } else res.status(401).json({ success: false });
  });
  app.post('/register', limits.registration, (_req, res) => res.status(201).json({ success: true }));
  const server = createServer(app); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return async (body: object, route = '/login') => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await response.arrayBuffer(); return { status: response.status, retry: response.headers.get('retry-after') };
  };
}
describe('shared Wi-Fi authentication', () => {
  it('admits fifty distinct correct logins concurrently from one IP', async () => {
    const send = await fixture();
    const responses = await Promise.all(Array.from({ length: 50 }, (_, i) => send({ email: `qa-${i}@example.invalid`, password: 'qa-valid' })));
    expect(responses.filter(row => row.status === 200)).toHaveLength(50);
  });
  it('blocks repeated failed attempts on one normalized account without blocking another account', async () => {
    const send = await fixture();
    for (let i = 0; i < 5; i++) expect((await send({ email: 'qa@example.invalid', password: 'wrong' })).status).toBe(401);
    const blocked = await send({ email: ' QA@EXAMPLE.INVALID ', password: 'wrong' });
    expect(blocked.status).toBe(429); expect(Number(blocked.retry)).toBeGreaterThan(0);
    expect((await send({ email: 'other@example.invalid', password: 'qa-valid' })).status).toBe(200);
  });
  it('does not spend the failure quota on successful entries', async () => {
    const send = await fixture();
    for (let i = 0; i < 12; i++) expect((await send({ email: 'qa@example.invalid', password: 'qa-valid' })).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await send({ email: 'qa@example.invalid', password: 'wrong' })).status).toBe(401);
    expect((await send({ email: 'qa@example.invalid', password: 'wrong' })).status).toBe(429);
  });
  it('keeps the same CUIT failure quota with and without separators', async () => {
    const send = await fixture();
    for (let i = 0; i < 5; i++) expect((await send({ cuit: '99-00000001-0', password: 'wrong' })).status).toBe(401);
    expect((await send({ cuit: '99000000010', password: 'wrong' })).status).toBe(429);
  });
  it('caps failed attempts across different accounts from the same network', async () => {
    const send = await fixture();
    for (let i = 0; i < 100; i++) expect((await send({ email: `wrong-${i}@example.invalid`, password: 'wrong' })).status).toBe(401);
    expect((await send({ email: 'wrong-101@example.invalid', password: 'wrong' })).status).toBe(429);
  });
  it('keeps registration at five requests per minute from the same IP', async () => {
    const send = await fixture();
    for (let i = 0; i < 5; i++) expect((await send({ email: `new-${i}@example.invalid` }, '/register')).status).toBe(201);
    expect((await send({ email: 'sixth@example.invalid' }, '/register')).status).toBe(429);
  });
});
