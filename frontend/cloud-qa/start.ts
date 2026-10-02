import { spawn, execFileSync } from 'node:child_process';
import { openSync } from 'node:fs';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const output=process.env.QA_ARTIFACTS!;
await mkdir(output,{recursive:true});
const processes=['runtime.ts','server.ts'].map(file=>{
  const log=openSync(path.join(output,file+'.log'),'a');
  const child=spawn(process.execPath,['--experimental-strip-types',path.join(root,'frontend/cloud-qa',file)],{
    cwd:root,env:process.env,detached:true,stdio:['ignore',log,log],
  });
  child.unref();
  return {pid:child.pid!,file};
});
await writeFile(path.join(output,'processes.json'),JSON.stringify(processes));
for(const endpoint of ['http://127.0.0.1:3037/api/health','http://127.0.0.1:4177/app/login']){
  let ready=false;
  for(let i=0;i<45;i++){
    try{const res=await fetch(endpoint,{signal:AbortSignal.timeout(1000)});if(res.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,600));
  }
  if(!ready){
    for(const item of processes)console.error(await readFile(path.join(output,item.file+'.log'),'utf8'));
    throw Error('Cloud QA startup failed: '+endpoint);
  }
}
await writeFile(path.join(output,'runtime-proof.json'),JSON.stringify({
  source:process.env.GITHUB_SHA,backend:path.join(root,'backend/dist/index.js'),
  database:'sitrep_night_qa_20260926',emails:false,push:false,blockchain:false,
  processes,runner:execFileSync('uname',['-a'],{encoding:'utf8'}).trim(),
},null,2));
console.log('Actual backend, web and app ready on VM loopback');
