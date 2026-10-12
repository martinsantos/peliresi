import { describe, expect, it } from 'vitest';
import { contextualClient, inTrainingSession, inOperationalSession, isTrainingSession, trainingConnectionUrl } from '../../lib/trainingScope';

describe('training datastore boundary', () => {
  const prod = 'postgresql://operational:secret@127.0.0.1:55440/qa?schema=public';
  const school = 'postgresql://school:secret@127.0.0.1:55440/qa?schema=sitrep_training';
  it('requires a different principal and exact schema; limits the pool', () => {
    const url = new URL(trainingConnectionUrl(prod, school));
    expect(url.searchParams.get('connection_limit')).toBe('2');
    for (const invalid of [prod, school.replace('sitrep_training', 'public'), school.replace('school:', 'operational:'), school.replace('/qa?', '/production?'), school.replace('55440', '5432')]) {
      expect(() => trainingConnectionUrl(prod, invalid)).toThrow();
    }
  });
  it('keeps concurrent async requests and their transactions in different stores', async () => {
    const operational = { namespace: 'production', transaction() { return this.namespace; } };
    const training = { namespace: 'training', transaction() { return this.namespace; } };
    const client = contextualClient(operational, () => training);
    const result = await Promise.all([
      inTrainingSession(async () => { await new Promise(resolve => setTimeout(resolve, 5)); return [client.namespace, client.transaction(), isTrainingSession()]; }),
      (async () => { await Promise.resolve(); return [client.namespace, client.transaction(), isTrainingSession()]; })(),
    ]);
    expect(result).toEqual([['training', 'training', true], ['production', 'production', false]]);
    expect(client.namespace).toBe('production');
  });
  it('restores scope after checking the real supervising admin or throwing', () => {
    inTrainingSession(() => {
      expect(inOperationalSession(isTrainingSession)).toBe(false);
      expect(isTrainingSession()).toBe(true);
    });
    expect(() => inTrainingSession(() => { throw new Error('Stop'); })).toThrow('Stop');
    expect(isTrainingSession()).toBe(false);
  });
  it('fails closed when training is unavailable, without invoking the operational delegate', () => {
    const client = contextualClient({ namespace: 'production' }, () => { throw new Error('Training unavailable'); });
    expect(() => inTrainingSession(() => client.namespace)).toThrow('Training unavailable');
    expect(client.namespace).toBe('production');
  });
});
