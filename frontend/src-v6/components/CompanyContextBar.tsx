import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
export default function CompanyContextBar() {
 const {currentUser,isRestricted}=useAuth(),mp=useMobilePrefix();
 if(import.meta.env.VITE_ENTERPRISE_ENABLED!=='true'||!currentUser||isRestricted)return null;
 const c=currentUser.empresaContexto;
 if(!c&&!currentUser.contextosEmpresa?.length&&!currentUser.empresaContextoError)return null;
 return <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-primary-100 bg-primary-50 px-4 py-1 text-sm" aria-label="Contexto de empresa">
  <span className="min-w-0 break-words">{c?`Actuando por ${c.razonSocial} · ${c.rol}${c.establecimiento?' · '+c.establecimiento.nombre:''}`:currentUser.empresaContextoError||'Tenés empresas autorizadas'}</span>
  <Link className="inline-flex min-h-11 shrink-0 items-center font-medium text-primary-800 underline" to={mp('/empresas')}>{c?'Cambiar empresa o sede':'Elegir empresa'}</Link>
 </div>;
}
