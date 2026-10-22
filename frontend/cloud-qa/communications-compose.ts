import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd(),dir=path.join(process.env.QA_ARTIFACTS!,'gallery');
const catalogue=JSON.parse(fs.readFileSync(path.join(dir,'catalogue.json'),'utf8'));
const ids=new Set<string>();
for(const entry of catalogue.cases){
  if(ids.has(entry.id))throw Error('Duplicate case: '+entry.id);
  ids.add(entry.id);
  if(!entry.title||!entry.roles.length)throw Error('Incomplete case: '+entry.id);
  for(const ref of [entry.emailRef,entry.toastRef,...Object.values(entry.inboxRefs||{}),...Object.values(entry.inboxReadRefs||{}),...Object.values(entry.mailRefs||{}).map((m:any)=>m.ref)].filter(Boolean)){
    if(!catalogue.blobs[ref as string])throw Error('Missing render: '+ref);
  }
}
for(const file of catalogue.coverage.files){
  const source=fs.readFileSync(path.join(root,file.file));
  if(crypto.createHash('sha256').update(source).digest('hex')!==file.sha256)throw Error('Source mismatch: '+file.file);
}
const json=(value:any)=>JSON.stringify(value).replace(/</g,'\\u003c');
let html=fs.readFileSync(path.join(root,'frontend/cloud-qa/communications-gallery.html'),'utf8');
const originalCSS=fs.readFileSync(path.join(process.env.QA_WEB_BUILD!,'assets',fs.readdirSync(path.join(process.env.QA_WEB_BUILD!,'assets')).find(name=>name.endsWith('.css')&&fs.readFileSync(path.join(process.env.QA_WEB_BUILD!,'assets',name),'utf8').includes('.institutional'))!),'utf8');
const offlineCSS=originalCSS.replace(/@import\s*(?:"[^"]*"|'[^']*'|url\([^)]*\))[^;]*;/g,'');
if(offlineCSS.includes('fonts.googleapis.com')||!offlineCSS.startsWith('.institutional'))throw Error('Invalid offline stylesheet');
html=html.replace('__CATALOGUE__',()=>json(catalogue)).replace('__PRODUCT_CSS__',()=>json(offlineCSS));
if(html.includes('__CATALOGUE__')||html.includes('__PRODUCT_CSS__'))throw Error('Unresolved placeholder');
fs.writeFileSync(path.join(dir,'index.html'),html);
console.log(JSON.stringify({cases:ids.size,sourceFilesVerified:catalogue.coverage.files.length,bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex')}));
