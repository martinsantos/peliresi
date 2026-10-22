import type { Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import prisma from '../lib/prisma';
import { scopedUploadRoot } from '../lib/trainingScope';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { cleanDraftData, draftScope, draftVersion, DRAFT_LIFETIME } from '../domain/actorFormDraft';
import { describeDocument } from '../services/documentAnalysis.service';

type Tx = Prisma.TransactionClient;
const include = { files: true } as const;
const expires = () => new Date(Date.now() + DRAFT_LIFETIME);
const privateRoot = () => scopedUploadRoot(process.env.UPLOADS_DIR || '/var/www/sitrep-uploads') + '-private-drafts';
const conflict = () => new AppError('El borrador cambió en otro dispositivo. Recuperá la versión de SITREP antes de continuar; tus datos siguen en pantalla.',409);
function identity(req: AuthRequest) { draftScope(req.params.scope, req.user); return { ownerId:req.user.id, scope:req.params.scope }; }
async function lock(tx: Tx, key: {ownerId:string;scope:string}) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`actor-draft:${key.ownerId}:${key.scope}`}))::text AS lock`;
  return tx.actorFormDraft.findUnique({where:{ownerId_scope:key},include});
}
function publicDraft(draft: Awaited<ReturnType<typeof lock>>) {
  if (!draft || draft.expiresAt <= new Date()) return null;
  return {version:draft.version,data:draft.data,savedAt:draft.updatedAt.toISOString(),expiresAt:draft.expiresAt.toISOString(),
    files:draft.files.map(({kind,name,mime,sha256,size,year})=>({kind,name,mime,sha256,size,year}))};
}
async function removePaths(paths: string[]) { for(const file of paths) if(file.startsWith(privateRoot()+path.sep)) await fs.rm(file,{force:true}).catch(()=>undefined); }
export async function readActorDraft(req:AuthRequest,res:Response,next:NextFunction) {
  try { const key=identity(req); const draft=await prisma.actorFormDraft.findUnique({where:{ownerId_scope:key},include});
    res.setHeader('Cache-Control','no-store');res.json({success:true,data:{draft:publicDraft(draft)}});
  }catch(error){next(error);}
}
export async function saveActorDraft(req:AuthRequest,res:Response,next:NextFunction) {
  const garbage:string[]=[];
  try {
    const key=identity(req),version=draftVersion(req.body.version),data=cleanDraftData(req.body.data);
    const requestId=req.body.requestId;
    if(typeof requestId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))throw new AppError('Identificador de guardado inválido',400);
    const hash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const draft=await prisma.$transaction(async tx=>{
      let current=await lock(tx,key);
      if(current && current.expiresAt<=new Date()) { garbage.push(...current.files.map(f=>f.path));await tx.actorFormDraft.delete({where:{id:current.id}});current=null; }
      if(current?.requestId===requestId) { if(current.requestHash!==hash || current.version!==version+1)throw conflict();return current; }
      if((current?.version||0)!==version)throw conflict();
      const record={data:data as Prisma.InputJsonValue,requestId,requestHash:hash,expiresAt:expires()};
      return current ? tx.actorFormDraft.update({where:{id:current.id},data:{...record,version:{increment:1}},include})
        : tx.actorFormDraft.create({data:{id:randomUUID(),...key,...record},include});
    });
    await removePaths(garbage);res.json({success:true,data:{draft:publicDraft(draft)}});
  }catch(error){next(error);}
}
export async function deleteActorDraft(req:AuthRequest,res:Response,next:NextFunction) {
  try { const key=identity(req),version=draftVersion(req.body.version);
    const garbage=await prisma.$transaction(async tx=>{const current=await lock(tx,key);if(!current)return [];
      if(current.version!==version)throw conflict();await tx.actorFormDraft.delete({where:{id:current.id}});return current.files.map(f=>f.path);});
    await removePaths(garbage);res.json({success:true});
  }catch(error){next(error);}
}
// Ownership is checked before accepting multipart bytes. No drafts are publicly served.
export function authorizeActorDraft(req:AuthRequest,_res:Response,next:NextFunction){try{identity(req);next();}catch(error){next(error);}}
export const uploadActorDraft = multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:3},fileFilter:(_req,file,done)=>{
  if(!['application/pdf','image/jpeg','image/png'].includes(file.mimetype))done(new AppError('Usá PDF, JPG o PNG de hasta 10 MiB',400));else done(null,true);
}}).single('file');
function kind(req:AuthRequest) {const value=req.params.kind;if(!/^[a-zA-Z0-9_-]{1,100}$/.test(value))throw new AppError('Tipo de adjunto inválido',400);return value;}
export async function saveActorDraftFile(req:AuthRequest,res:Response,next:NextFunction) {
  let candidate:string|undefined,persisted=false;const garbage:string[]=[];
  try {
    const key=identity(req),slot=kind(req),version=draftVersion(req.body.version),file=req.file;
    if(!file)throw new AppError('Seleccioná un archivo',400);
    const year=req.body.year===''||req.body.year===undefined?null:Number(req.body.year);
    if(year!==null&&(!Number.isInteger(year)||year<1900||year>2100))throw new AppError('Año inválido',400);
    await fs.mkdir(privateRoot(),{recursive:true,mode:0o700});candidate=path.join(privateRoot(),randomUUID());
    await fs.writeFile(candidate,file.buffer,{mode:0o600,flag:'wx'});
    const description=describeDocument({path:candidate,mimetype:file.mimetype});
    const draft=await prisma.$transaction(async tx=>{
      const current=await lock(tx,key);if(!current||current.expiresAt<=new Date())throw new AppError('Guardá primero el borrador',409);
      const old=current.files.find(f=>f.kind===slot),name=file.originalname.replace(/[\x00-\x1f/\\]/g,'_').slice(0,180);
      // A lost upload response can be retried, but never overwrite a different newer file.
      if(current.version!==version){if(current.version===version+1&&old?.sha256===description.sha256&&old.name===name&&old.year===year)return current;throw conflict();}
      if(current.files.length>=100&&!old)throw new AppError('El borrador admite hasta 100 adjuntos',400);
      if(current.files.reduce((sum,f)=>sum+(f.kind===slot?0:f.size),0)+file.size>50*1024*1024)throw new AppError('Los adjuntos del borrador superan 50 MiB',400);
      await tx.actorFormDraftFile.upsert({where:{draftId_kind:{draftId:current.id,kind:slot}},
        create:{id:randomUUID(),draftId:current.id,kind:slot,name,mime:description.mimeType,path:candidate!,sha256:description.sha256,size:file.size,year},
        update:{name,mime:description.mimeType,path:candidate!,sha256:description.sha256,size:file.size,year}});
      if(old)garbage.push(old.path);
      return tx.actorFormDraft.update({where:{id:current.id},data:{version:{increment:1},expiresAt:expires()},include});
    });
    persisted=draft.files.some(f=>f.path===candidate);await removePaths(garbage);
    res.json({success:true,data:{draft:publicDraft(draft)}});
  }catch(error){next(error);}finally{if(candidate&&!persisted)await removePaths([candidate]);}
}
export async function readActorDraftFile(req:AuthRequest,res:Response,next:NextFunction) {
  try {const key=identity(req),slot=kind(req),draft=await prisma.actorFormDraft.findUnique({where:{ownerId_scope:key},include});
    const file=draft&&draft.expiresAt>new Date()?draft.files.find(f=>f.kind===slot):null;
    if(!file||!file.path.startsWith(privateRoot()+path.sep))throw new AppError('Adjunto no disponible',404);
    const bytes=await fs.readFile(file.path);if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new AppError('No se pudo verificar el adjunto. Se conserva el borrador.',409);
    res.set({'Cache-Control':'no-store','Content-Type':file.mime,'X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`});res.send(bytes);
  }catch(error){next(error);}
}
export async function deleteActorDraftFile(req:AuthRequest,res:Response,next:NextFunction) {
  const garbage:string[]=[];
  try{const key=identity(req),slot=kind(req),version=draftVersion(req.body.version);
    const draft=await prisma.$transaction(async tx=>{const current=await lock(tx,key);if(!current||current.expiresAt<=new Date())throw conflict();
      if(current.version!==version)throw conflict();const file=current.files.find(f=>f.kind===slot);if(!file)return current;
      await tx.actorFormDraftFile.delete({where:{id:file.id}});garbage.push(file.path);
      return tx.actorFormDraft.update({where:{id:current.id},data:{version:{increment:1},expiresAt:expires()},include});});
    await removePaths(garbage);res.json({success:true,data:{draft:publicDraft(draft)}});
  }catch(error){next(error);}
}
