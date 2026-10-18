import React,{useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {BellRing,Volume2,VolumeX,X,ArrowRight} from 'lucide-react';
import {notificacionService} from '../services/notificacion.service';
import {resolveNotificationPath} from '../utils/notificationNavigation';
import {useMobilePrefix} from '../hooks/useMobilePrefix';
import type {Notificacion} from '../types/models';

/** Foreground CAP notices. No push registration, permission prompt or external delivery. */
export function TrainingLiveNotices({userId}:{userId:string|number}){
 const navigate=useNavigate(),mp=useMobilePrefix(),qc=useQueryClient();
 const key=`cap-notices-seen:${userId}`;
 const seen=useRef<Set<string>|null>(null),audio=useRef<AudioContext|null>(null);
 const [queue,setQueue]=useState<Notificacion[]>([]),[sound,setSound]=useState(false),[soundError,setSoundError]=useState('');
 const {data}=useQuery({queryKey:['notificaciones','live-cap',userId],queryFn:()=>notificacionService.list({limit:50}),refetchInterval:4000,staleTime:0,refetchIntervalInBackground:false});
 function ping(){const ctx=audio.current;if(!ctx||ctx.state!=='running')return;[660,880].forEach((frequency,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime+i*.16;osc.frequency.value=frequency;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.12,t+.02);gain.gain.exponentialRampToValueAtTime(.001,t+.15);osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+.16);});}
 async function enable(){try{const ctx=audio.current||new AudioContext();audio.current=ctx;ctx.onstatechange=()=>setSound(ctx.state==='running');await ctx.resume();if(ctx.state!=='running')throw Error();setSound(true);setSoundError('');ping();}catch{setSoundError('El navegador no habilitó el sonido. Los avisos visuales siguen activos.');}}
 useEffect(()=>{return()=>{if(audio.current){audio.current.onstatechange=null;void audio.current.close();audio.current=null;}};},[]);
 useEffect(()=>{
  if(!data)return;
  if(!seen.current){
   let saved:string[]|null=null;try{saved=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
   seen.current=new Set(saved||data.items.map(n=>n.id));
  }
  const fresh=data.items.filter(n=>{if(seen.current!.has(n.id)||n.leida)return false;try{if(n.datos&&JSON.parse(n.datos).autorId===userId)return false;}catch{}return true;});
  data.items.forEach(n=>seen.current!.add(n.id));
  // Keep a bounded acknowledgement ledger; navigation does not re-ring old notices.
  try{sessionStorage.setItem(key,JSON.stringify([...seen.current].slice(-500)));}catch{}
  if(!fresh.length)return;
  setQueue(old=>[...fresh,...old].filter((n,i,a)=>a.findIndex(x=>x.id===n.id)===i).slice(0,50));
  if(audio.current?.state==='running')ping();
  void qc.invalidateQueries({queryKey:['training-tasks']});void qc.invalidateQueries({queryKey:['manifiestos']});void qc.invalidateQueries({queryKey:['manifest-proposal']});void qc.invalidateQueries({queryKey:['training-certificates']});
 },[data,key,qc]);
 const notice=queue[0];
 function dismiss(){setQueue(q=>q.slice(1));}
 function open(){if(!notice)return;void notificacionService.marcarLeida(notice.id).then(()=>qc.invalidateQueries({queryKey:['notificaciones']})).catch(()=>{});dismiss();navigate(resolveNotificationPath(notice,mp('')));}
 return <div className="shrink-0 bg-white"><aside aria-label="Avisos en vivo" className="max-h-[28dvh] overflow-y-auto overscroll-contain">
  {notice&&<div role="status" aria-live="polite" className="border-b-2 border-primary-600 bg-primary-50 px-3 py-2 text-neutral-900"><div className="flex items-start gap-3"><BellRing size={24} className="shrink-0 text-primary-700"/><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-primary-800">Nuevo aviso{queue.length>1?` · ${queue.length} novedades`:''}</p><h2 className="mt-1 text-base font-bold">{notice.titulo}</h2></div><button aria-label="Cerrar aviso en vivo" onClick={dismiss} className="min-h-11 min-w-11"><X size={20}/></button></div><p className="mt-1 text-sm leading-snug">{notice.mensaje}</p><button onClick={open} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-3 font-semibold text-white">Abrir manifiesto <ArrowRight size={18}/></button></div>}
 </aside>
 <div className="flex flex-wrap items-center justify-center gap-2 bg-white px-3 py-2 text-xs text-neutral-700 border-b border-neutral-200">
  <BellRing size={14}/><span>Avisos en vivo con la app abierta</span><button type="button" onClick={()=>sound?(setSound(false),void audio.current?.suspend()):void enable()} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-primary-800">{sound?<Volume2 size={16}/>:<VolumeX size={16}/>} {sound?'Sonido activo':'Activar sonido'}</button>{soundError&&<p role="alert">{soundError}</p>}
 </div></div>;
}
