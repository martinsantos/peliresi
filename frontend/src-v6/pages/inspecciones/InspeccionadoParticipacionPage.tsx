import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { InspectionExchangePanel } from './InspectionExchangePanel';

const InspeccionadoParticipacionPage: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const mp = useMobilePrefix();
  if (!id) return <Navigate to={mp('/notificaciones')} replace />;
  if (location.pathname.includes('/mis-inspecciones/')) {
    return <Navigate to={mp('/requerimientos/'+encodeURIComponent(id))+location.search+location.hash} replace />;
  }
  return <div className="mx-auto w-full max-w-5xl space-y-4 pb-6">
    <Link to={mp('/notificaciones')} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary-800"><ArrowLeft size={18} aria-hidden="true"/>Volver a Avisos</Link>
    <div id="trazabilidad" className="scroll-mt-24"><InspectionExchangePanel inspectionId={id} /></div>
  </div>;
};
export default InspeccionadoParticipacionPage;
