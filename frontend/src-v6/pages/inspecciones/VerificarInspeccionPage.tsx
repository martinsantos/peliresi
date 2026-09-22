import React from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, FileCheck2, Loader2, LockKeyhole } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { inspeccionService, type PublicInspectionVerification } from '../../services/inspeccion.service';
import type { InspectionState } from '../../types/inspection';
import { InspectionInstitutionalMasthead } from './InspectionInstitutionalMasthead';
import InspectionVerificationBlock from './InspectionVerificationBlock';

const STATE_LABELS: Partial<Record<InspectionState, string>> = {
  BORRADOR: 'Borrador', PLANIFICADA: 'Planificada', EN_CAMPO: 'En campo', EN_REVISION: 'En revisión', NOTIFICADA: 'Notificada',
  EN_DESCARGO: 'En descargo', REQUIERE_SUBSANACION: 'Requiere subsanación', CERRADA_CONFORME: 'Cerrada conforme',
  DERIVADA_LEGALES: 'Derivada a Legales', EN_TRAMITE_LEGAL: 'En trámite legal', DERIVADA_ATM: 'Derivada a ATM', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada',
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : 'No informado';

const VerificarInspeccionPage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const { currentUser } = useAuth();
  const verificationQuery = useQuery<PublicInspectionVerification, unknown>({
    queryKey: ['inspeccion', 'verificar-publica', token],
    queryFn: () => inspeccionService.verifyPublic(token),
    enabled: Boolean(token),
    retry: false,
  });
  const result = verificationQuery.data || null;
  const loading = verificationQuery.isLoading;
  const errorKind: 'invalid' | 'temporary' | null = !token
    ? 'invalid'
    : verificationQuery.isError
      ? isAxiosError(verificationQuery.error) && verificationQuery.error.response?.status === 404 ? 'invalid' : 'temporary'
      : null;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F4F7F4] px-4"><div className="flex items-center gap-3 text-sm font-semibold text-[#1B5E3C]"><Loader2 size={20} className="animate-spin" />Verificando documento en SITREP…</div></div>;
  }

  if (errorKind === 'temporary') {
    return <div className="min-h-screen bg-[#F4F7F4] px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto max-w-xl"><InspectionInstitutionalMasthead inspectionNumber="Verificación pública" compact /><section className="border-x border-b border-amber-200 bg-white px-5 py-12 text-center sm:px-10"><AlertTriangle size={38} className="mx-auto text-amber-700" /><h1 className="mt-4 text-2xl font-extrabold text-[#10213A]">No pudimos verificar ahora</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">El servicio de verificación no está disponible en este momento. Reintentá en unos segundos.</p><button type="button" onClick={() => void verificationQuery.refetch()} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1B5E3C] px-4 py-2 text-sm font-extrabold text-white">Reintentar <ArrowRight size={16} /></button></section></div></div>;
  }

  if (errorKind === 'invalid' || !result) {
    return <div className="min-h-screen bg-[#F4F7F4] px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto max-w-xl"><InspectionInstitutionalMasthead inspectionNumber="Verificación pública" compact /><section className="border-x border-b border-error-200 bg-white px-5 py-12 text-center sm:px-10"><AlertTriangle size={38} className="mx-auto text-error-600" /><h1 className="mt-4 text-2xl font-extrabold text-[#10213A]">Código no válido</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">No pudimos validar este enlace. Solicite una nueva copia del documento o verifique que el código QR esté completo.</p><Link to="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1B5E3C] px-4 py-2 text-sm font-extrabold text-white">Ir a SITREP <ArrowRight size={16} /></Link></section></div></div>;
  }

  const state = result.estado as InspectionState | undefined;
  const verificationUrl = result.verificacion.url;
  const authorizedPath = result.authorizedPath;
  const authorizedDestination = currentUser && ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(currentUser.rol)
    ? authorizedPath.replace(/^\/inspecciones\//, '/mis-inspecciones/')
    : authorizedPath;
  const isHistorical = result.verificacion.estadoVerificacion === 'HISTORICA_AUTENTICA';
  const verificationStatusLabel = isHistorical ? 'Versión histórica auténtica' : result.verificacion.estadoVerificacion === 'VIGENTE' ? 'Documento vigente' : 'Documento validado';
  return (
    <main className="min-h-screen bg-[#F4F7F4] px-3 py-5 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-[#DCE7DF] bg-white shadow-[0_12px_32px_rgba(16,33,58,0.07)]">
        <InspectionInstitutionalMasthead inspectionNumber={result.numero || 'Inspección'} actNumber={result.numeroActa} state={state} version={result.verificacion.version} />
        <div className="border-b border-neutral-200 px-4 py-5 sm:px-8 sm:py-7">
          <div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isHistorical ? 'bg-amber-100 text-amber-800' : 'bg-success-100 text-success-800'}`}>{isHistorical ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}</span><div><p className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${isHistorical ? 'text-amber-800' : 'text-success-800'}`}>{verificationStatusLabel}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#10213A] sm:text-3xl">Inspección registrada en SITREP</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{isHistorical ? <>El código corresponde auténticamente a la versión <strong>{result.verificacion.version}</strong> emitida por SITREP. La versión actual del expediente es la <strong>{result.verificacion.versionActual ?? 'más reciente'}</strong>.</> : 'El código corresponde a una versión emitida por el Sistema de Trazabilidad de Residuos Peligrosos.'}</p></div></div>
        </div>
        <div className="grid gap-0 border-b border-neutral-200 sm:grid-cols-3 sm:divide-x sm:divide-neutral-200">
          <div className="border-b border-neutral-200 px-4 py-4 sm:border-0 sm:px-6"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-neutral-500">Expediente</p><p className="mt-1 break-all font-mono text-sm font-extrabold text-[#10213A]">{result.numero || 'No informado'}</p></div>
          <div className="border-b border-neutral-200 px-4 py-4 sm:border-0 sm:px-6"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-neutral-500">Estado</p><p className="mt-1 text-sm font-extrabold text-[#10213A]">{(state && STATE_LABELS[state]) || result.estado || 'No informado'}</p></div>
          <div className="px-4 py-4 sm:px-6"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-neutral-500">Última actualización</p><p className="mt-1 flex items-center gap-1.5 text-sm font-extrabold text-[#10213A]"><CalendarClock size={15} className="text-[#1B5E3C]" />{formatDate(result.updatedAt || result.createdAt)}</p></div>
        </div>
        <InspectionVerificationBlock verification={{ ...result.verificacion, url: verificationUrl }} showPublicLink={false} />
        <section className="border-b border-neutral-200 px-4 py-5 sm:px-8" aria-labelledby="verification-scope-title">
          <div className="flex items-start gap-3"><FileCheck2 size={19} className={`mt-0.5 shrink-0 ${isHistorical ? 'text-amber-700' : 'text-[#1B5E3C]'}`} /><div><h2 id="verification-scope-title" className="font-extrabold text-[#10213A]">Alcance de esta verificación</h2><p className="mt-1 text-sm leading-6 text-neutral-600">La consulta confirma identidad, estado, versión y huella del expediente registrado. No publica fotografías, domicilios, documentos ni datos personales de los intervinientes, ni sustituye una firma digital.</p></div></div>
          <div className="mt-5 flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs font-semibold text-neutral-600"><LockKeyhole size={15} className="text-neutral-500" />El detalle completo requiere autorización.</p>{currentUser ? <Link to={authorizedDestination} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#9CC8AA] px-3.5 py-2 text-xs font-extrabold text-[#1B5E3C] hover:bg-[#F3FAF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E3C] focus-visible:ring-offset-2">{isHistorical ? 'Ver versión actual del expediente' : 'Ver trazabilidad autorizada'} <ArrowRight size={15} /></Link> : <Link to="/login" state={{ from: authorizedPath }} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#9CC8AA] px-3.5 py-2 text-xs font-extrabold text-[#1B5E3C] hover:bg-[#F3FAF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E3C] focus-visible:ring-offset-2">{isHistorical ? 'Ingresar para ver versión actual' : 'Ingresar para ver trazabilidad'} <ArrowRight size={15} /></Link>}</div>
        </section>
        <footer className="flex flex-col gap-1 px-4 py-4 text-[11px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>Gobierno de Mendoza · DGFA · SITREP</span><span className="break-all font-mono">Huella {result.verificacion.huella.slice(0, 24)}… · v{result.verificacion.version}</span></footer>
      </div>
    </main>
  );
};

export default VerificarInspeccionPage;
