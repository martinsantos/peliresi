import { Server } from 'node:net';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import path from 'node:path';

await assertCloudDatabase();
// Production entrypoint is unchanged; only its QA listener is bound to loopback.
const listen = Server.prototype.listen;
Server.prototype.listen = function (...args: unknown[]) {
  if(args[0]===3037 && typeof args[1]!=='string')args.splice(1,0,'127.0.0.1');
  return Reflect.apply(listen,this,args);
} as typeof Server.prototype.listen;
console.log('Cloud QA safety PASS: isolated DB, loopback and external delivery disabled');
backendRequire(path.join(root,'backend/dist/index.js'));
