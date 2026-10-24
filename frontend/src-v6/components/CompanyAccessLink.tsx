import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ImpersonationContext from '../contexts/ImpersonationContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { api } from '../services/api';

export function CompanyAccessLink() {
  const {currentUser, isRestricted} = useAuth();
  const temporary = Boolean(useContext(ImpersonationContext)?.impersonationData);
  const mp = useMobilePrefix();
  const enabled = import.meta.env.VITE_ENTERPRISE_ENABLED === 'true' && !!currentUser && !temporary && !isRestricted;
  const query = useQuery({
    queryKey:['company-directory-access',currentUser?.id,currentUser?.rol,temporary],
    queryFn:async() => (await api.get('/empresas',{params:{limit:1}})).data.data,
    enabled, retry:false, staleTime:30_000,
  });
  if (!enabled) return null;
  if (query.isError) return <p className="text-sm text-neutral-600">No pudimos consultar tus empresas. <button className="min-h-11 font-semibold text-primary-800 underline" onClick={()=>void query.refetch()}>Reintentar consulta</button></p>;
  if (!query.data?.puedeValidar && !query.data?.pagination?.total) return null;
  return <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-primary-800" to={mp('/empresas')}><Building2 size={18} aria-hidden="true"/>Empresas y establecimientos<ChevronRight size={16} aria-hidden="true"/></Link>;
}
