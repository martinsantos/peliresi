import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { assertCloudEnvironment, root } from './safety.ts';

// The product entrypoint runs unchanged on Node20. Only this disposable VM's
// listener is bound to loopback and its providers remain disabled.
export async function startMultiuserCluster(database: string) {
  assertCloudEnvironment();
  const url = new URL(database);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55440');
  assert.ok(['/sitrep_night_qa_20260926', '/sitrep_night_qa_restore_20261008'].includes(url.pathname));
  url.searchParams.delete('connection_limit'); url.searchParams.delete('pool_timeout');
  const binary = process.env.QA_NODE20!;
  assert.ok(path.isAbsolute(binary) && binary.startsWith('/opt/hostedtoolcache/node/20.'));
  const output = process.env.QA_ARTIFACTS!;
  const bootstrap = path.join(output, 'multiuser-worker.cjs');
  await writeFile(bootstrap, `const {Server}=require('node:net');
const listen=Server.prototype.listen;
Server.prototype.listen=function(...args){if(args[0]===3037&&typeof args[1]!=='string')args.splice(1,0,'127.0.0.1');return Reflect.apply(listen,this,args)};
require(${JSON.stringify(path.join(root, 'backend/dist/index.js'))});
setInterval(()=>process.send?.({kind:'sample',pid:process.pid,node:process.version,rss:process.memoryUsage().rss}),10000).unref();
process.send?.({kind:'online',pid:process.pid,node:process.version,rss:process.memoryUsage().rss});
`);
  const proofFile = path.join(output, 'multiuser-workers.json');
  const primaryCode = `const cluster=require('node:cluster'),fs=require('node:fs');
cluster.setupPrimary({exec:${JSON.stringify(bootstrap)},execArgv:['--max-old-space-size=384']});
const rows={},proof=${JSON.stringify(proofFile)};
function write(){fs.writeFileSync(proof,JSON.stringify({primary:process.pid,workers:Object.values(rows)}))}
function fork(){const w=cluster.fork();w.on('message',m=>{rows[w.id]={...rows[w.id],...m,id:w.id,at:new Date().toISOString()};write()})}
fork();fork();cluster.on('exit',()=>{if(!stopping)fork()});let stopping=false;
process.on('SIGTERM',()=>{stopping=true;for(const w of Object.values(cluster.workers))w?.process.kill('SIGTERM');cluster.disconnect(()=>process.exit(0))});
`;
  const log = await import('node:fs').then(fs => fs.openSync(path.join(output, 'multiuser-runtime.log'), 'a'));
  const child = spawn(binary, ['--max-old-space-size=128', '-e', primaryCode, path.join(root, 'frontend/cloud-qa/multiuser-cluster.ts')], {
    env: { ...process.env, DATABASE_URL: url.toString(), NODE_APP_INSTANCE: 'qa' }, stdio: ['ignore', log, log],
  });
  await writeFile(path.join(output, 'processes.json'), JSON.stringify([{ pid: child.pid, file: 'multiuser-cluster.ts' }]));
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:3037/api/health', { signal: AbortSignal.timeout(1000) });
      const workers = JSON.parse(await readFile(proofFile, 'utf8')).workers;
      if (response.ok && (await response.json()).db === 'connected' && workers.length === 2) { ready = true; break; }
    } catch { /* Bounded startup only. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Two actual backend workers must start before synthetic traffic');
  const proof = JSON.parse(await readFile(proofFile, 'utf8'));
  assert.ok(proof.workers.every((worker: { node: string }) => worker.node.startsWith('v20.19.')));
  return child;
}

export async function stopMultiuserCluster(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise<never>((_, reject) => setTimeout(() => reject(Error('QA cluster did not stop')), 15000).unref())]);
}
