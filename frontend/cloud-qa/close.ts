import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { assertCloudEnvironment, root } from './safety.ts';
assertCloudEnvironment();
const output=process.env.QA_ARTIFACTS!;
let processes:Array<{pid:number;file:string}>=[];
try{processes=JSON.parse(await readFile(path.join(output,'processes.json'),'utf8'));}catch{}
const stopped=[];
for(const item of processes){
  let command='';
  try{command=execFileSync('ps',['-p',String(item.pid),'-o','args='],{encoding:'utf8'});}catch{continue;}
  if(!command.includes(path.join(root,'frontend/cloud-qa',item.file)))throw Error('PID identity mismatch');
  process.kill(item.pid,'SIGTERM');stopped.push(item);
}
await writeFile(path.join(output,'closure.json'),JSON.stringify({at:new Date().toISOString(),stopped}));
