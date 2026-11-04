import api from './api';
import { safeDraftValue } from './registrationDraft';
export type DraftSelection = { file:File; anio?:number };
export type DraftFiles = Record<string,DraftSelection>;
export type CloudActorDraft = {version:number;data:Record<string,unknown>;savedAt:string;expiresAt:string;files:{kind:string;name:string;mime:string;size:number;sha256:string;year:number|null}[]};
const url=(scope:string)=>'/actores/borradores/'+encodeURIComponent(scope);
export const actorFormDraftService={
  read:async(scope:string):Promise<CloudActorDraft|null>=>(await api.get(url(scope))).data.data.draft ?? null,
  save:async(scope:string,version:number,data:Record<string,unknown>,requestId:string):Promise<CloudActorDraft>=>(await api.put(url(scope),{version,data:safeDraftValue(data),requestId})).data.data.draft,
  remove:async(scope:string,version:number)=>{await api.delete(url(scope),{data:{version}});},
  upload:async(scope:string,kind:string,version:number,selection:DraftSelection):Promise<CloudActorDraft>=>{
    const form=new FormData();form.append('file',selection.file);form.append('version',String(version));if(selection.anio!==undefined)form.append('year',String(selection.anio));
    return (await api.put(url(scope)+'/archivos/'+encodeURIComponent(kind),form,{headers:{'Content-Type':'multipart/form-data'}})).data.data.draft;
  },
  removeFile:async(scope:string,kind:string,version:number):Promise<CloudActorDraft>=>(await api.delete(url(scope)+'/archivos/'+encodeURIComponent(kind),{data:{version}})).data.data.draft,
  download:async(scope:string,file:CloudActorDraft['files'][number]):Promise<DraftSelection>=>{
    const response=await api.get(url(scope)+'/archivos/'+encodeURIComponent(file.kind),{responseType:'blob'});
    return {file:new File([response.data],file.name,{type:file.mime}),...(file.year!==null?{anio:file.year}:{})};
  },
};
