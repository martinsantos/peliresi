import { trainingQaEmail } from './apk-training-policy.ts';
export const origin = 'https://sitrep.ultimamilla.com.ar';
export const manifests = ['cap-20261012-manifiesto-5-BORRADOR', 'cap-20261013-rehearsal-app-manifiesto-5'];
export const fields = ['cap-20261012-inspeccion-5-GENERADOR', 'cap-20261012-inspeccion-5-TRANSPORTISTA'];
export const roles = ['generador','transportista','operador','admin','inspector','admin_generador','admin_transportista','admin_operador'];
export function cap5Allowed(url: string, method: string, body: string | null, authorization: string | undefined, teacher: string) {
  const u = new URL(url), p = u.pathname.replace(/\/$/, '');
  if (u.origin !== origin) return false;
  const read = ['GET','HEAD','OPTIONS'].includes(method);
  if (read && ['/api/health','/api/auth/profile','/api/auth/roles','/api/push/vapid-key'].includes(p)) return true;
  if (read && /^\/api\/solicitudes\/(?:catalogos|requisitos)(?:\/|$)/.test(p)) return true;
  if (method === 'POST' && p === '/api/solicitudes/analizar-documento') return true; // Nonpersisting synthetic OCR only.
  if (method === 'POST' && p === '/api/auth/login') { try { return JSON.parse(body || '{}').email === trainingQaEmail; } catch { return false; } }
  if (method === 'POST' && ['/api/auth/logout','/api/auth/refresh-token'].includes(p)) return true;
  let c: {id?: string; realm?: string; impersonatedBy?: string};
  try { c=JSON.parse(Buffer.from((authorization||'').replace(/^Bearer /,'').split('.')[1],'base64url').toString()); } catch { return false; }
  if (c.id === teacher && !c.realm && !c.impersonatedBy) return read && ['/api/admin/training/usuarios','/api/notificaciones'].includes(p)
    || method==='POST' && roles.some(role => p === '/api/admin/training/impersonate/cap-20261012-'+role+'-5');
  if(c.realm!=='sitrep-capacitacion-v1'||c.impersonatedBy!==teacher||!roles.some(role=>c.id==='cap-20261012-'+role+'-5'))return false;
  if(read)return /^\/api\/(?:manifiestos|catalogos|actores|reportes|analytics|centro-control|inspecciones|soporte|notificaciones|search|admin\/usuarios|solicitudes|renovaciones|alertas|anomalias)(?:\/|$)/.test(p);
  if(method==='POST' && manifests.some(id=>new RegExp('^/api/manifiestos/'+id+'/(firmar|confirmar-retiro|confirmar-entrega|confirmar-recepcion|pesaje|tratamiento|cerrar|ubicacion)$').test(p)))return true;
  if(fields.some(id=>p==='/api/inspecciones/'+id)&&method==='PATCH')return true;
  if(fields.some(id=>p==='/api/inspecciones/'+id+'/estado')&&method==='POST')return true;
  if(method==='POST'&&/^\/api\/inspecciones\/cap-20261012-participacion-5-(GENERADOR|TRANSPORTISTA|OPERADOR)-abierta\/intercambios(?:\/decision)?$/.test(p))return true;
  if(method==='POST'&&/^\/api\/soporte\/cap-20261012-ticket-(generador|transportista)-5\/acciones$/.test(p)){
    // Only existing CAP 5 tickets; never broadcast a new ticket to CAP 1–4.
    const target=body?.match(/"responsableId"\s*:\s*"([^"]+)"/)?.[1]
      || body?.match(/name="responsableId"\r\n\r\n([^\r\n]+)/)?.[1];
    return !target || ['cap-20261012-admin-5','cap-20261012-inspector-5'].includes(target);
  }
  return false;
}
