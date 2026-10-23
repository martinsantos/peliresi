import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertCloudEnvironment, backendRequire } from './safety.ts';
assertCloudEnvironment();
const sharp=backendRequire('sharp'),out=process.env.QA_ARTIFACTS!,dir=path.join(out,'pdf');
const pages=path.join(out,'pdf-pages');fs.mkdirSync(pages,{recursive:true});
if(process.env.QA_UI_ONLY!=='1'){
for(const surface of ['web-desktop','web-responsive','app']){
 const folder=path.join(out,'product-ux-e2e-'+(process.env.QA_BROWSER_ATTEMPT||'review5'));
 const entry=fs.readdirSync(folder).find(name=>name.startsWith('product-ux-reports-')&&name.endsWith('-'+surface));
 if(entry){const source=path.join(folder,entry,'reporte.pdf');if(fs.existsSync(source))fs.copyFileSync(source,path.join(dir,'reporte-'+surface+'.pdf'));}
}
const metadata:any[]=[],pictures:string[]=[];
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.pdf')).sort()){
 const source=path.join(dir,file),stem=file.slice(0,-4);
 const info=execFileSync('pdfinfo',[source],{encoding:'utf8'}),count=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
 if(!count)throw new Error('No pages: '+file);
 execFileSync('pdftoppm',['-r','90','-png',source,path.join(pages,stem)]);
 const rendered=fs.readdirSync(pages).filter(f=>/[-]\d+\.png$/.test(f)&&f.replace(/-\d+\.png$/,'')===stem).sort((a,b)=>Number(a.match(/(\d+)\.png$/)![1])-Number(b.match(/(\d+)\.png$/)![1]));
 if(rendered.length!==count)throw new Error('Stale or missing page: '+file);
 metadata.push({file,pages:count,sha256:createHash('sha256').update(fs.readFileSync(source)).digest('hex'),rendered});pictures.push(...rendered);
}
for(let first=0;first<pictures.length;first+=4){
 const group=pictures.slice(first,first+4),composites:any[]=[];
 for(const [i,file] of group.entries()){
  const left=(i%2)*500,top=Math.floor(i/2)*740;
  composites.push({input:await sharp(path.join(pages,file)).resize({width:480,height:680,fit:'inside'}).png().toBuffer(),left:left+10,top:top+35});
  composites.push({input:Buffer.from('<svg width="490" height="25"><text x="10" y="18" font-size="13" font-family="sans-serif" fill="#172c24">'+file+'</text></svg>'),left,top:top+6});
 }
 await sharp({create:{width:1000,height:1480,channels:3,background:'#e9efeb'}}).composite(composites).png().toFile(path.join(pages,'review-'+String(first/4+1).padStart(2,'0')+'.png'));
}
fs.writeFileSync(path.join(pages,'index.json'),JSON.stringify({documents:metadata,pageCount:pictures.length},null,2));
console.log(JSON.stringify({documents:metadata.length,pages:pictures.length,contactSheets:Math.ceil(pictures.length/4)}));

}
// Contact sheets retain every section screenshot, without changing its content.
const uiDir=path.join(out,'ui-pages');fs.mkdirSync(uiDir,{recursive:true});
const reviewRoot=process.env.QA_SECTION_ROOT||path.join(out,'product-ux-e2e-review4');
const uiIndex:any[]=[];
for(const surface of ['web-desktop','web-responsive','app']){
 const entry=fs.readdirSync(reviewRoot).find(name=>name.startsWith('product-ux-section-review-')&&name.endsWith('-'+surface));
 if(!entry)throw new Error('Missing section evidence: '+surface);
 const folder=path.join(reviewRoot,entry);
 const files=fs.readdirSync(folder).filter(f=>/^section-\d+\.png$/.test(f)).sort((a,b)=>Number(a.match(/\d+/)![0])-Number(b.match(/\d+/)![0]));
 if(files.length!==22)throw new Error('Incomplete section review: '+surface);
 const rows=surface==='web-desktop'?3:2,cols=surface==='web-desktop'?2:3,width=1800,height=1800,cw=width/cols,ch=height/rows;
 for(let first=0;first<files.length;first+=6){
  const composites:any[]=[];
  for(const [i,file] of files.slice(first,first+6).entries()){
   const left=(i%cols)*cw,top=Math.floor(i/cols)*ch;
   composites.push({input:await sharp(path.join(folder,file)).resize({width:cw-20,height:ch-45,fit:'inside'}).png().toBuffer(),left:left+10,top:top+35});
   composites.push({input:Buffer.from('<svg width="550" height="25"><text x="10" y="18" font-size="15" font-family="sans-serif" fill="#172c24">'+surface+' / '+file+'</text></svg>'),left,top:top+6});
  }
  const name=surface+'-'+String(first/6+1).padStart(2,'0')+'.png';
  await sharp({create:{width,height,channels:3,background:'#e9efeb'}}).composite(composites).png().toFile(path.join(uiDir,name));
  uiIndex.push({surface,file:name,screenshots:files.slice(first,first+6).map(f=>path.relative(out,path.join(folder,f)))});
 }
}
fs.writeFileSync(path.join(uiDir,'index.json'),JSON.stringify(uiIndex,null,2));
console.log(JSON.stringify({sectionScreenshots:66,contactSheets:uiIndex.length}));
