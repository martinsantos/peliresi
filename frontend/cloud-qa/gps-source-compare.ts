import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase,root} from './safety.ts';
await assertCloudDatabase();
const out=process.env.QA_ARTIFACTS!;
const manifest=JSON.parse(readFileSync(path.join(out,'source-manifest.json'),'utf8')) as Record<string,string>;
const mismatches:string[]=[];
for(const [name,expected] of Object.entries(manifest)){
  const file=path.resolve(root,name);
  assert.ok(file.startsWith(path.resolve(root)+path.sep));
  try{
    const info=lstatSync(file);
    if(!info.isFile()||createHash('sha256').update(readFileSync(file)).digest('hex')!==expected)mismatches.push(name);
  }catch{mismatches.push(name);}
}
const report={files:Object.keys(manifest).length,mismatches,equal:mismatches.length===0,syntheticPreview:true};
writeFileSync(path.join(out,'source-comparison.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
assert.deepEqual(mismatches,[],'Preview source must match the staged working tree');
