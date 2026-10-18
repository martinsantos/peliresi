import { afterEach, expect, it, vi } from 'vitest';
import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { createServer, type Server } from 'node:http';
vi.mock('../../config/config', () => ({ config: { JWT_SECRET: 'qa-training-multipart' } }));
import { trainingSession } from '../../middlewares/trainingSession';
import { isTrainingSession, TRAINING_REALM } from '../../lib/trainingScope';

const servers: Server[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); })));
});
it('retains verified training scope through real multipart parsing without a database or providers', async () => {
  vi.stubEnv('TRAINING_DATABASE_URL', 'postgresql://school@localhost/qa?schema=sitrep_training');
  const app = express();
  app.use(trainingSession);
  app.post('/api/soporte', async (_req, _res, next) => { await Promise.resolve(); next(); },
    multer({ storage: multer.memoryStorage() }).single('file'), (req, res) => {
      res.json({ training: isTrainingSession(), bytes: req.file?.size, description: req.body.description });
    });
  const server = createServer(app); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as import('node:net').AddressInfo).port;
  for (const training of [true, false]) {
    const form = new FormData(); form.set('description', 'Práctica'); form.set('file', new Blob(['test']), 'qa.txt');
    const token = jwt.sign({ id: 'synthetic', ...(training ? { realm: TRAINING_REALM, impersonatedBy: 'admin' } : {}) }, 'qa-training-multipart');
    const response = await fetch(`http://127.0.0.1:${port}/api/soporte`, { method: 'POST', body: form, headers: { Authorization: 'Bearer ' + token } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ training, bytes: 4, description: 'Práctica' });
  }
});
