import { AsyncLocalStorage } from 'node:async_hooks';

// Scope is established only from a verified JWT, never a query string/header flag.
export const TRAINING_REALM = 'sitrep-capacitacion-v1';
const scope = new AsyncLocalStorage<{ training: boolean }>();
export const isTrainingSession = () => scope.getStore()?.training === true;
export const inTrainingSession = <T>(operation: () => T): T => scope.run({ training: true }, operation);
export const inOperationalSession = <T>(operation: () => T): T => scope.run({ training: false }, operation);

/** Same PostgreSQL server/database; separate schema and restricted DB principal.
 * Never permit falling back to public when the training configuration is absent.
 */
export function trainingConnectionUrl(operational: string, training: string): string {
  const prod = new URL(operational);
  const school = new URL(training);
  if (prod.protocol !== 'postgresql:' || school.protocol !== 'postgresql:'
    || prod.hostname !== school.hostname || prod.port !== school.port || prod.pathname !== school.pathname
    || school.searchParams.get('schema') !== 'sitrep_training'
    || !school.username || school.username === prod.username) {
    throw new Error('Capacitación requiere esquema sitrep_training y usuario exclusivo en la misma base');
  }
  school.searchParams.set('connection_limit', '2');
  school.searchParams.set('pool_timeout', '5');
  return school.toString();
}

/** Resolve the delegate on EACH access. Do not retain a training delegate in a
 * process-global cache or outside its asynchronous request.
 */
export function contextualClient<T extends object>(operational: T, training: () => T): T {
  return new Proxy(operational, {
    get(_target, key) {
      const client = isTrainingSession() ? training() : operational;
      const value = Reflect.get(client, key);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}
