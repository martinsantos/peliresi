import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudEnvironment, root } from './safety.ts';
assertCloudEnvironment();
const output=process.env.QA_ARTIFACTS!;
let processes:Array<{pid:number;file:string}>=[];
try{processes=JSON.parse(await readFile(path.join(output,'processes.json'),'utf8'));}catch{}
const stopped=[];
const forced:number[]=[];
function commandFor(pid:number){
 try{return readFileSync('/proc/'+pid+'/cmdline','utf8').replaceAll('\0',' ');}
 catch(error){if(['ENOENT','ESRCH'].includes((error as NodeJS.ErrnoException).code||''))return '';throw error;}
}
function stillOwned(item:{pid:number;file:string}){
 return commandFor(item.pid).includes(path.join(root,'frontend/cloud-qa',item.file));
}
for(const item of processes){
 const command=commandFor(item.pid);if(!command)continue;
  if(!command.includes(path.join(root,'frontend/cloud-qa',item.file)))throw Error('PID identity mismatch');
 process.kill(item.pid,'SIGTERM');
 const until=Date.now()+3000;
 while(stillOwned(item)&&Date.now()<until)await new Promise(r=>setTimeout(r,100));
 if(stillOwned(item)){process.kill(item.pid,'SIGKILL');forced.push(item.pid);}
 const finalUntil=Date.now()+2000;
 while(stillOwned(item)&&Date.now()<finalUntil)await new Promise(r=>setTimeout(r,100));
 if(stillOwned(item))throw Error('Owned QA process did not stop');
 stopped.push(item);
}
await writeFile(path.join(output,'closure.json'),JSON.stringify({at:new Date().toISOString(),stopped,forced}));
