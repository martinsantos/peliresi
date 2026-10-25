import { useEffect, useRef, useState } from 'react';
import api, { getAccessToken } from '../services/api';
import { registrationSessionOwner } from '../services/registrationSession';
import { clearRegistrationDraft, readRegistrationDraft, writeRegistrationDraft, safeDraftValue, type RegistrationDraft } from '../services/registrationDraft';
import { actorFormDraftService as cloud, type CloudActorDraft, type DraftFiles } from '../services/actorFormDraft.service';
import { getApiErrorMessage } from '../utils/api-error';
import { useInspectionDraftOwnership } from './useInspectionDraftOwnership';

/** Administrative form recovery, not a second actor or a new server session. */
export function useActorRegistrationDraft(type: 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA', actorId: string | undefined,
  data: Record<string, unknown>, onRestore: (value: Record<string, unknown>, files?: DraftFiles) => void, dirty: boolean, files: DraftFiles = {}) {
  const owner = registrationSessionOwner(getAccessToken());
  const scope = `admin:${type}:${actorId || 'new'}`;
  const [verified, setVerified] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState<RegistrationDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false), [saving, setSaving] = useState(false), [conflict, setConflict] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const remote = useRef<CloudActorDraft | null>(null), known = useRef(false), conflictRef = useRef(false), generation = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingWrite = useRef<{version:number;data:Record<string,unknown>;requestId:string}|null>(null);
  const filesRef = useRef(files); filesRef.current=files;
  const uploaded = useRef<DraftFiles>({}), synced = useRef('');
  const fileSignature = JSON.stringify(Object.entries(files).map(([kind,entry])=>[kind,entry.file.name,entry.file.size,entry.file.lastModified,entry.anio]));
  const dataRef = useRef(data); dataRef.current = data;
  const restoreRef = useRef(onRestore); restoreRef.current = onRestore;
  const previousOwner = useRef(owner);
  const paused = useRef(false);
  const serialized = JSON.stringify(safeDraftValue(data));
  const ownership = useInspectionDraftOwnership(`registration:${owner}:${scope}`, Boolean(owner && verified === owner));
  useEffect(() => {
    generation.current++;remote.current=null;known.current=false;conflictRef.current=false;uploaded.current={};synced.current='';pendingWrite.current=null;
    setCloudSaved(false);setConflict(false);setSaving(false);setRestoring(false);
    let cancelled = false; setChecking(true); setVerified(null); setAvailable(null); setSaved(false); setError(null); paused.current = false;
    if (previousOwner.current !== owner) { restoreRef.current({}); previousOwner.current = owner; }
    if (!owner) { setChecking(false); return; }
    api.get('/auth/profile').then(async response => {
      if (cancelled || registrationSessionOwner(getAccessToken()) !== owner) return;
      if (response.data?.data?.user?.id !== owner) throw new Error('La sesión no corresponde al borrador');
      setVerified(owner);
      const local=readRegistrationDraft(owner,scope);
      setAvailable(local);
      const server=await cloud.read(scope);
      if(cancelled||registrationSessionOwner(getAccessToken())!==owner)return;
      remote.current=server;known.current=true;
      setAvailable(local&&(!server||local.savedAt>Date.parse(server.savedAt))?local:server?{version:1,owner,scope,savedAt:Date.parse(server.savedAt),data:server.data}:null);
      setSyncTick(tick=>tick+1);
    }).catch(() => { if (!cancelled) setError('No se pudo consultar el borrador de SITREP. Conservamos los datos de este dispositivo; reintentá la conexión antes de continuar.'); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; generation.current++; };
  }, [owner, scope]);
  const assertSession = () => {
    if (!owner || verified !== owner || registrationSessionOwner(getAccessToken()) !== owner) throw new Error('La sesión cambió o no está verificada. Iniciá sesión antes de guardar.');
    if (!ownership.canWrite()) throw new Error('El borrador está abierto en otra pestaña o no se pudo proteger su edición. Cerrá la otra pestaña y reintentá.');
    if(conflictRef.current)throw new Error('Hay cambios en otro dispositivo. Revisá la versión de SITREP antes de continuar.');
  };
  const saveLocal = (value: Record<string, unknown>, selected = filesRef.current) => writeRegistrationDraft(owner!, scope, {
    ...value,
    // A filename is not evidence that the current bytes reached the server.
    _draftPendingFiles: Object.entries(selected).filter(([kind, entry]) => uploaded.current[kind]?.file !== entry.file || uploaded.current[kind]?.anio !== entry.anio).map(([kind]) => kind),
  });
  const checkpoint = (value = dataRef.current):Promise<boolean> => {
    const current=generation.current,selected={...filesRef.current},payload=safeDraftValue(value) as Record<string,unknown>;
    const assertCurrent=()=>{if(current!==generation.current)throw new Error('El formulario cambió. La operación anterior no reemplazará estos datos.');assertSession();};
    const accept=async(operation:Promise<CloudActorDraft>)=>{const result=await operation;assertCurrent();remote.current=result;};
    const signature=JSON.stringify(payload)+'|'+JSON.stringify(Object.entries(selected).map(([kind,entry])=>[kind,entry.file.name,entry.file.size,entry.file.lastModified,entry.anio]));
    const task=async()=>{
    if(current!==generation.current)return false;
    setSaving(true);setCloudSaved(false);
    try {
      assertCurrent();
      if (available || paused.current) throw new Error('Elegí si querés recuperar el borrador anterior antes de reemplazarlo.');
      setSaved(saveLocal(payload,selected));
      if(!known.current)throw new Error('No se pudo consultar la versión de SITREP. Reintentá la conexión antes de continuar.');
      if(pendingWrite.current){const write=pendingWrite.current;await accept(cloud.save(scope,write.version,write.data,write.requestId));pendingWrite.current=null;}
      // Every explicit checkpoint validates the revision, even when its fields
      // match our last save. Another device may have changed the draft meanwhile.
      {
        pendingWrite.current={version:remote.current?.version||0,data:payload,requestId:crypto.randomUUID()};
        const write=pendingWrite.current;await accept(cloud.save(scope,write.version,write.data,write.requestId));pendingWrite.current=null;
      }
      if(!remote.current)throw new Error('No se confirmó el borrador.');
      for(const [kind,entry] of Object.entries(selected)){
        assertCurrent();if(uploaded.current[kind]?.file===entry.file && uploaded.current[kind]?.anio===entry.anio)continue;
        await accept(cloud.upload(scope,kind,remote.current.version,entry));uploaded.current[kind]=entry;
      }
      for(const file of [...remote.current.files])if(!selected[file.kind] && !(Array.isArray(payload.files) && payload.files.includes(file.name))){
        assertCurrent();await accept(cloud.removeFile(scope,file.kind,remote.current.version));delete uploaded.current[file.kind];
      }
      if(current!==generation.current)return false;
      const selectedNames = new Set(Object.values(selected).map(entry => entry.file.name));
      const missingFiles = Array.isArray(payload.files) && payload.files.some(name => !selectedNames.has(String(name)));
      synced.current=signature;setCloudSaved(!missingFiles);setError(null);return true;
    } catch (failure) {
      if(current===generation.current){if((failure as {response?:{status?:number}})?.response?.status===409){conflictRef.current=true;setConflict(true);}
        setError(getApiErrorMessage(failure,'No se confirmó el guardado en SITREP. Conservamos tus datos; reintentá Guardar.'));}return false;
    } finally {if(current===generation.current){setSaving(false);setSyncTick(tick=>tick+1);}}
    };
    const result=queue.current.then(task,task);queue.current=result;return result;
  };
  useEffect(() => {
    if (verified !== owner || !owner || available || !dirty || paused.current || !ownership.canWrite()) return;
    const ok = saveLocal(dataRef.current); setSaved(ok);
    if (!ok) setError('No se pudo guardar en este dispositivo. Los datos siguen en pantalla; no cierres el formulario.');
    if(synced.current===serialized+'|'+fileSignature)return;
    setCloudSaved(false);
    if(!known.current||conflictRef.current||saving||error)return;
    const timer=setTimeout(()=>{void checkpoint();},900);return()=>clearTimeout(timer);
  }, [serialized,fileSignature,verified,owner,scope,available,dirty,ownership.status,ownership.canWrite,saving,syncTick,error]);
  const restore = async () => {
    if (!available || restoring) return;
    const current=generation.current;
    const assertCurrent=()=>{if(current!==generation.current)throw new Error('El formulario cambió. Abrí de nuevo el borrador que querés recuperar.');assertSession();};
    setRestoring(true); setError(null);
    try {
      assertCurrent();
      const proposed = { ...available.data };
      const selected:DraftFiles={};
      const pendingKinds = new Set(Array.isArray(proposed._draftPendingFiles) ? proposed._draftPendingFiles : []);
      for(const file of remote.current?.files||[]){
        if (pendingKinds.has(file.kind)) continue;
        selected[file.kind]=await cloud.download(scope,file);assertCurrent();uploaded.current[file.kind]=selected[file.kind];
      }
      if (typeof proposed.savedActorId === 'string') {
        const plural = type === 'GENERADOR' ? 'generadores' : type === 'OPERADOR' ? 'operadores' : 'transportistas';
        const actor = await api.get(`/actores/${plural}/${proposed.savedActorId}`); assertCurrent();
        const actual = actor.data.data[type.toLowerCase()] || actor.data.data;
        const form = proposed.form as Record<string, unknown> | undefined;
        if (!form || String(actual.cuit).replace(/\D/g, '') !== String(form.cuit).replace(/\D/g, '')) throw new Error('La ficha guardada no coincide con el CUIT del borrador. No se repetirá ni modificará el alta.');
        const documents = await api.get(`/actores/${plural}/${proposed.savedActorId}/documentos`); assertCurrent();
        const confirmed = documents.data.data.documentos || [];
        proposed.uploadedDocs = Object.fromEntries(confirmed.map((item: { tipo: string; nombre: string }) => [item.tipo, item.nombre]));
        proposed.savedDocuments = confirmed;
        for(const item of confirmed)delete selected[item.tipo];
      }
      const names=new Set(Object.values(selected).map(entry=>entry.file.name));
      proposed.files=Array.isArray(proposed.files)?proposed.files.filter(name=>!names.has(String(name))):[];
      restoreRef.current(proposed,selected); setAvailable(null); setSaved(true);
    } catch (failure) { if(current===generation.current)setError(getApiErrorMessage(failure, 'No se pudo recuperar el borrador. Se conserva sin reemplazarlo.')); }
    finally { if(current===generation.current)setRestoring(false); }
  };
  const clear = async () => {
    const current=generation.current;
    paused.current=true;await queue.current;
    if(current!==generation.current)return false;
    try{assertSession();if(remote.current)await cloud.remove(scope,remote.current.version);if(current!==generation.current)return false;assertSession();clearRegistrationDraft(owner!,scope);remote.current=null;setAvailable(null);setSaved(false);setCloudSaved(false);return true;}
    catch(failure){if(current===generation.current){paused.current=false;setError(getApiErrorMessage(failure,'No se pudo cerrar el borrador. Reintentá sin repetir el alta.'));}return false;}
  };
  const discard = async () => {if(await clear()){paused.current=false;synced.current='';uploaded.current={};pendingWrite.current=null;}};
  const reviewRemote=async()=>{
    const current=generation.current;
    try{if(!owner||registrationSessionOwner(getAccessToken())!==owner)throw new Error('Recuperá tu sesión.');
      const server=await cloud.read(scope);if(current!==generation.current||registrationSessionOwner(getAccessToken())!==owner)return;
      remote.current=server;known.current=true;pendingWrite.current=null;conflictRef.current=false;setConflict(false);setError(null);
      setAvailable(server?{version:1,owner,scope,savedAt:Date.parse(server.savedAt),data:server.data}:readRegistrationDraft(owner,scope));setSyncTick(tick=>tick+1);
    }catch(failure){if(current===generation.current)setError(getApiErrorMessage(failure,'No se pudo consultar la versión guardada.'));}
  };
  return { owner, available, saved, error, restoring, checking, checkpoint, restore, discard, clear, assertSession, cloudSaved,saving,conflict,reviewRemote,
    blocked: ownership.status === 'blocked' || (verified === owner && ownership.status === 'unavailable'), retry: ownership.retry };
}
