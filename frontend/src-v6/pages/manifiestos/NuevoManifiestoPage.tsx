import { useImpersonation } from '../../contexts/ImpersonationContext';
import { manifestProposalsVisible } from '../../utils/manifestFeatures';
/**
 * SITREP v6 - Nuevo Manifiesto Page
 * ==================================
 * Formulario para crear nuevo manifiesto de residuos
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Truck,
  AlertTriangle,
  Loader2,
  Info,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { DraftConflictNotice } from '../../components/DraftConflictNotice';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { getApiErrorMessage } from '../../utils/api-error';
import { manifestPartyErrors, partyApprovalMessage, partyApprovalSuffix, type ManifestPartyField } from '../../utils/manifestPartyEligibility';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateManifiesto } from '../../hooks/useManifiestos';
import { useTiposResiduo, useCatalogoGeneradores, useCatalogoTransportistas, useCatalogoOperadores } from '../../hooks/useCatalogos';
import type { CatalogoItem } from '../../types/api';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { companyGeneratorView } from '../../utils/enterprisePresentation';
import { manifestDraftScope, useManifestDraft, type ManifestFormData } from '../../hooks/useManifestDraft';
import { manifestListReturn } from '../../utils/manifestListReturn';

function ActorSummary({ actor, label }: { actor?: CatalogoItem; label: string }) {
  if (!actor) return null;
  const fields: Array<[string, unknown]> = [
    ['CUIT', actor.cuit], [actor.domicilioLegalEmpresa!==undefined?'Domicilio productivo':'Domicilio', actor.domicilio||'Por completar'], ['Teléfono', actor.telefono],
    ['Domicilio legal',actor.domicilioLegalEmpresa],['Establecimiento',actor.establecimientoEmpresa],
    ['Email', actor.usuario?.email], ['Inscripción', actor.numeroInscripcion],
    ['Habilitación', actor.numeroHabilitacion], ['Categoría', actor.categoria],
  ];
  const available = fields.filter(([, value]) => value != null && value !== '');
  return <details className="group border-b border-neutral-200 pb-2">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded text-sm font-medium text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
      {label}<ChevronDown size={16} className="shrink-0 group-open:rotate-180" aria-hidden="true" />
    </summary>
    {available.length ? <dl className="grid gap-3 py-2 sm:grid-cols-2">{available.map(([name, value]) => <div key={name} className="min-w-0"><dt className="text-xs text-neutral-600">{name}</dt><dd className="break-words text-sm text-neutral-900">{String(value)}</dd></div>)}</dl> : <p className="pb-2 text-sm text-neutral-600">El catálogo no informa datos complementarios.</p>}
  </details>;
}


/** Parse corrientes Basel codes from various formats: "Y8-Y48", "Y8,Y48", "Y4/Y8/Y9", "Y8, Y9 e Y48", ["Y8","Y48"] */
function parseCorrientes(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => s.trim()).filter(Boolean);
  // Split by comma, slash, or dash-between-Y-codes (e.g. "Y8-Y9-Y48")
  return raw.split(/[,/]|(?<=\d)-(?=Y)/i).map(s => s.replace(/\s*e\s*$/, '').trim()).filter(Boolean);
}

/** Temporary access must explain the boundary before mounting a writable form. */
export const NuevoManifiestoPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { impersonationData, exitImpersonation } = useImpersonation();
  const navigate = useNavigate();
  const mp = useMobilePrefix();

  if (impersonationData && !currentUser?.training) {
    return (
      <section className="mx-auto w-full max-w-xl space-y-4" aria-labelledby="temporary-manifest-title">
        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} className="mt-1 shrink-0 text-warning-700" aria-hidden="true" />
              <div>
                <h2 id="temporary-manifest-title" className="text-xl font-bold text-neutral-900">Estás en una vista temporal</h2>
                <p className="mt-2 text-neutral-700">Para crear una propuesta, la persona responsable debe ingresar con su propia cuenta.</p>
              </div>
            </div>
            <p className="text-sm text-neutral-700">Esta vista es de asistencia: no permite proponer ni aprobar en nombre del actor. No se creó ningún manifiesto.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={exitImpersonation}>Volver a mi cuenta</Button>
              <Button variant="outline" onClick={() => navigate(mp('/manifiestos'))}>Ver manifiestos</Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }
  return <NuevoManifiestoForm key={manifestDraftScope(currentUser)} />;
};

const NuevoManifiestoForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mp = useMobilePrefix();
  const { currentUser, isAdmin, isGenerador } = useAuth();
  const proposalsAvailable = manifestProposalsVisible(currentUser) && ['GENERADOR','TRANSPORTISTA','OPERADOR','ADMIN'].includes(currentUser?.rol || '');
  const carrierProposal = proposalsAvailable && currentUser?.rol === 'TRANSPORTISTA';
  const ownCarrierId = carrierProposal ? currentUser?.actorId || '' : '';
  const operatorProposal = proposalsAvailable && currentUser?.rol === 'OPERADOR';
  const ownOperatorId = operatorProposal ? currentUser?.actorId || '' : '';
  const [confirmWithoutTransport, setConfirmWithoutTransport] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [refreshingParties, setRefreshingParties] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [serverPartyIssues, setServerPartyIssues] = useState<Partial<Record<ManifestPartyField, string>>>({});
  const formRef = useRef<HTMLDivElement>(null);
  const focusError = useRef(false);
  const submitting = useRef(false);

  // API hooks
  const createManifiesto = useCreateManifiesto();
  const { data: apiTiposResiduo } = useTiposResiduo();
  const catalogoGeneradores = useCatalogoGeneradores();
  const catalogoTransportistas = useCatalogoTransportistas();
  const catalogoOperadores = useCatalogoOperadores();
  const apiGeneradores = catalogoGeneradores.data;
  const apiTransportistas = catalogoTransportistas.data;
  const apiOperadores = catalogoOperadores.data;

  // Use API catalogos only
  const tiposResiduo = apiTiposResiduo || [];
  const generadoresList = apiGeneradores || [];
  const transportistasList = apiTransportistas || [];
  const operadoresList = apiOperadores || [];

  const initialForm: ManifestFormData = {
    generador: currentUser?.rol === 'GENERADOR' ? currentUser?.sector || '' : '',
    generadorId: currentUser?.rol === 'GENERADOR' ? currentUser?.actorId || '' : '',
    modalidad: 'FIJO' as 'FIJO' | 'IN_SITU',
    transportista: ownCarrierId,
    vehiculoId: '',
    choferId: '',
    operador: ownOperatorId,
    fechaRetiro: new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Mendoza'}).format(new Date()),
    observaciones: '',
    residuos: [{ tipo: '', cantidad: '', unidad: 'kg' }],
  };
  const draft = useManifestDraft(manifestDraftScope(currentUser), { step: 1, form: initialForm });
  const { step, form: formData } = draft.draft;
  const setStep = (value: number) => draft.update(previous => ({ ...previous, step: value }));
  const setFormData = (change: React.SetStateAction<ManifestFormData>) => draft.update(previous => ({ ...previous, form: typeof change === 'function' ? change(previous.form) : change }));
  const returnTo = manifestListReturn(location.state, mp('/manifiestos'));
  const returnToList = () => {
    if (draft.error && draft.dirty && !window.confirm('No se pudo guardar el borrador en este dispositivo. Si cerrás la app, podrías perder lo cargado. ¿Salir igualmente?')) return;
    navigate(returnTo);
  };
  const [discardDraft, setDiscardDraft] = useState(false);
  const pendingSendNotice = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusError.current) return;
    focusError.current = false;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)') || formRef.current?.querySelector<HTMLElement>('[data-party-error]');
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [validationErrors, step]);

  const partyProposal = proposalsAvailable;
  const selectInSitu = () => {
    setFormData(prev => ({ ...prev, modalidad: 'IN_SITU', transportista: partyProposal ? prev.transportista : '', vehiculoId: '', choferId: '', operador: ownOperatorId }));
    setConfirmWithoutTransport(false);
    setValidationErrors(prev => { const next = { ...prev }; delete next.transportista; return next; });
  };

  // Selected actor details (auto-populated from catalogs)
  const selectedGenerador = companyGeneratorView(generadoresList.find((g) => g.id === formData.generadorId),currentUser?.empresaContexto);
  const selectedTransportista = transportistasList.find((t) => t.id === formData.transportista);
  const selectedOperador = operadoresList.find((o) => o.id === formData.operador);
  const partyIssues: Partial<Record<ManifestPartyField, string>> = partyProposal ? {
    generador: partyApprovalMessage(selectedGenerador),
    transportista: partyApprovalMessage(selectedTransportista),
    operador: partyApprovalMessage(selectedOperador),
    ...serverPartyIssues,
  } : {};
  const hasPartyIssue = Object.values(partyIssues).some(Boolean) || !!submitError;
  const clearPartyError = (field: ManifestPartyField) => {
    setValidationErrors(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== field)));
    setServerPartyIssues(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== field)));
    setSubmitError(undefined);
  };
  const refreshPartyStates = async () => {
    setRefreshingParties(true);
    try {
      const checks = [
        ['generador', formData.generadorId, catalogoGeneradores],
        ['transportista', formData.transportista, catalogoTransportistas],
        ['operador', formData.operador, catalogoOperadores],
      ] as const;
      const results = await Promise.all(checks.map(async ([field, id, query]) => ({ field, id, result: await query.refetch() })));
      setServerPartyIssues(prev => Object.fromEntries(Object.entries(prev).filter(([field]) => !results.some(check =>
        check.field === field && !check.result.isError && check.result.data?.find((item: CatalogoItem) => item.id === check.id)?.aprobacionManifiesto?.habilitada === true))));
      setValidationErrors(prev => {
        const next = { ...prev };
        for (const { field, id, result } of results) {
          if (result.isError) continue;
          const actor = result.data?.find((item: CatalogoItem) => item.id === id);
          if (actor?.aprobacionManifiesto?.habilitada === true) next[field] = '';
          else if (actor?.aprobacionManifiesto?.mensaje) next[field] = actor.aprobacionManifiesto.mensaje;
        }
        return Object.fromEntries(Object.entries(next).filter(([, message]) => message));
      });
      if (results.some(({ result }) => result.isError)) toast.error('No se pudieron actualizar los estados', 'Revisá la conexión. Los datos del manifiesto siguen cargados.');
      else setSubmitError(undefined);
    } catch {
      toast.error('No se pudieron actualizar los estados', 'Revisá la conexión. Los datos del manifiesto siguen cargados.');
    } finally { setRefreshingParties(false); }
  };
  const vehiculos = (selectedTransportista?.vehiculos || []).filter((v: { activo?: boolean }) => v.activo === true);
  const choferes = (selectedTransportista?.choferes || []).filter((c: { activo?: boolean }) => c.activo === true);

  // Cross-filter: only show operadores that can handle ALL selected residuos
  const selectedResiduoIds = useMemo(
    () => formData.residuos.map((r) => r.tipo).filter(Boolean),
    [formData.residuos]
  );
  const operadoresFiltrados = useMemo(() => {
    let filtered = operatorProposal ? operadoresList.filter(o => o.id === ownOperatorId) : operadoresList;

    // Filter by modalidad: check modalidades array, tipoOperador, or categoria
    filtered = filtered.filter((op: any) => {
      const modalidades: string[] = op.modalidades || [];
      const tipo = (op.tipoOperador || op.categoria || '').toUpperCase();
      if (formData.modalidad === 'IN_SITU') {
        return modalidades.includes('IN_SITU') || tipo.includes('IN SITU') || tipo.includes('IN_SITU');
      }
      // FIJO
      return modalidades.includes('FIJO') || tipo.includes('FIJO') || modalidades.length === 0;
    });

    // Filter by residuos compatibility (strict: operador must have tratamiento for each residuo)
    if (selectedResiduoIds.length > 0) {
      filtered = filtered.filter((op: any) => {
        const opResiduoIds = new Set(
          (op.tratamientos || [])
            .filter((t: any) => t.activo !== false)
            .map((t: any) => t.tipoResiduoId)
        );
        return selectedResiduoIds.every((id) => opResiduoIds.has(id));
      });
    }

    return filtered;
  }, [operadoresList, selectedResiduoIds, formData.modalidad, operatorProposal, ownOperatorId]);

  // Cross-filter: residuos by generador's corrientesControl
  const genCorrientes = useMemo(() => {
    const gen = selectedGenerador as any;
    return parseCorrientes(gen?.corrientesControl || gen?.categoriasControl);
  }, [selectedGenerador]);

  const residuosFiltrados = useMemo(() => {
    if (genCorrientes.length === 0) return tiposResiduo; // no data = show all
    const filtered = tiposResiduo.filter((r: any) => genCorrientes.includes(r.codigo));
    return filtered.length > 0 ? filtered : tiposResiduo; // fallback if no match
  }, [tiposResiduo, genCorrientes]);
  const hasDeclaredResidueMatch = genCorrientes.length > 0 && tiposResiduo.some((residuo) => genCorrientes.includes(residuo.codigo));

  // Cross-filter: transportistas by selected residuos' codigos
  const selectedCodigos = useMemo(() => {
    return selectedResiduoIds
      .map(id => (tiposResiduo as any[]).find((r: any) => r.id === id)?.codigo)
      .filter(Boolean) as string[];
  }, [selectedResiduoIds, tiposResiduo]);

  const transportistasFiltrados = useMemo(() => {
    if (formData.modalidad === 'IN_SITU') return transportistasList;
    if (selectedCodigos.length === 0) return transportistasList;
    return transportistasList.filter((t: any) => {
      const transCorrientes = parseCorrientes(t.corrientesAutorizadas);
      if (transCorrientes.length === 0) return true; // No data = don't filter out
      return selectedCodigos.every(c => transCorrientes.includes(c));
    });
  }, [transportistasList, selectedCodigos, formData.modalidad]);

  const handleAddResiduo = () => {
    setFormData({
      ...formData,
      residuos: [...formData.residuos, { tipo: '', cantidad: '', unidad: 'kg' }],
    });
  };

  const handleRemoveResiduo = (index: number) => {
    const newResiduos = formData.residuos.filter((_, i) => i !== index);
    setFormData({ ...formData, residuos: newResiduos });
  };

  const handleResiduoChange = (index: number, field: string, value: string) => {
    const newResiduos = [...formData.residuos];
    newResiduos[index] = { ...newResiduos[index], [field]: value };
    setFormData({ ...formData, residuos: newResiduos });
  };

  const validateForm = (targetStep?: number): boolean => {
    const errors: Record<string, string> = {};

    if ((!targetStep || targetStep === 1) && !formData.generadorId && !formData.generador) {
      errors.generador = 'Seleccioná un generador para continuar.';
    }
    if ((!targetStep || targetStep === 3) && (partyProposal || formData.modalidad !== 'IN_SITU') && !formData.transportista) {
      errors.transportista = 'Seleccioná el transportista que aprobará la propuesta.';
    }
    if ((!targetStep || targetStep === 3) && !formData.operador) {
      errors.operador = 'Seleccioná el operador de destino.';
    }

    const hasInvalidResiduos = formData.residuos.some(
      (r) => !r.tipo || !r.cantidad || !Number.isFinite(Number(r.cantidad)) || Number(r.cantidad) <= 0
    );
    if ((!targetStep || targetStep === 2) && hasInvalidResiduos) {
      errors.residuos = 'Completá el tipo y una cantidad mayor que cero en cada residuo, o quitá la fila que no corresponda.';
    }

    if (partyProposal) {
      if ((!targetStep || targetStep === 1) && partyIssues.generador) errors.generador = partyIssues.generador;
      if (!targetStep || targetStep === 3) {
        if (partyIssues.transportista) errors.transportista = partyIssues.transportista;
        if (partyIssues.operador) errors.operador = partyIssues.operador;
      }
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length) {
      focusError.current = true;
      if (!targetStep) setStep(errors.generador ? 1 : errors.residuos ? 2 : 3);
    }
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting.current || draft.conflict || draft.checkConflict()) return;
    if (!draft.draft.pendingCreate && !validateForm()) {
      return;
    }
    const pending = draft.prepareCreate();
    if (!pending) {
      toast.error('Todavía no se envió', 'No pudimos conservar la referencia del envío. Mantené esta pantalla abierta y revisá el almacenamiento del navegador.');
      return;
    }
    const submittedForm = pending.form;

    submitting.current = true;
    setSubmitError(undefined);
    try {
      const result = await createManifiesto.mutateAsync({
        idempotencyKey: pending.id,
        generadorId: submittedForm.generadorId || submittedForm.generador,
        ...(submittedForm.transportista && (partyProposal || submittedForm.modalidad !== 'IN_SITU') ? { transportistaId: submittedForm.transportista } : {}),
        ...(submittedForm.modalidad !== 'IN_SITU' && submittedForm.vehiculoId ? { vehiculoId: submittedForm.vehiculoId } : {}),
        ...(submittedForm.modalidad !== 'IN_SITU' && submittedForm.choferId ? { choferId: submittedForm.choferId } : {}),
        operadorId: submittedForm.operador,
        modalidad: submittedForm.modalidad,
        fechaEstimadaRetiro: submittedForm.fechaRetiro || undefined,
        observaciones: submittedForm.observaciones || undefined,
        residuos: submittedForm.residuos.map((r) => ({
          tipoResiduoId: r.tipo,
          cantidad: Number(r.cantidad),
          unidad: r.unidad,
        })),
      });

      if (result.creationRecovered) toast.success('Manifiesto recuperado', `${result.numero || result.id}. El envío ya se había guardado; no se creó otro ni se repitieron avisos.`);
      else toast.success(result.estado === 'PENDIENTE_APROBACION' ? 'Propuesta enviada a las partes' : 'Borrador creado', `${result.numero || result.id}. ${result.estado === 'PENDIENTE_APROBACION' ? 'Generador, transporte y operador deben aprobar desde sus cuentas.' : 'Todavía falta la firma del generador para continuar.'}`);
      if (!draft.clear()) toast.error('Manifiesto creado', 'No se pudo borrar la copia de este dispositivo. No vuelvas a enviar el formulario anterior.');
      navigate(mp(`/manifiestos/${result.id}`), { state: { manifestListReturn: returnTo } });
    } catch (err: any) {
      // These responses definitively reject creation. Ambiguous/network failures
      // retain the original payload and key until the person checks that same send.
      const rejected = [400, 403, 422].includes(err?.response?.status);
      if (rejected) draft.releaseCreate();
      else {
        pendingSendNotice.current?.focus({ preventScroll: true });
        pendingSendNotice.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      const fields = manifestPartyErrors(err);
      if (Object.keys(fields).length) {
        setServerPartyIssues(fields);
        setValidationErrors(fields);
        setSubmitError('No se creó el manifiesto. Revisá las partes indicadas; todos los datos siguen cargados.');
        focusError.current = true;
        setStep(fields.generador ? 1 : 3);
        return;
      }
      // The API client explains 429 with its retry time. Keep all fields and
      // avoid a second, contradictory toast; only the user repeats the write.
      if (err?.response?.status !== 429) toast.error(
        rejected ? 'Revisá los datos del manifiesto' : 'Envío sin confirmar',
        rejected ? getApiErrorMessage(err, 'Revisá los datos indicados; el formulario sigue cargado.')
          : 'Revisá la conexión y usá Comprobar envío. Recuperaremos el mismo manifiesto si ya se guardó.'
      );
    } finally {
      submitting.current = false;
    }
  };

  // Preserve existing role and feature checks for the signed-in actor.
  const canCreate = isAdmin || isGenerador || (operatorProposal && !!ownOperatorId) || (carrierProposal && !!ownCarrierId);

  if (!canCreate) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-20">
        <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-lg font-bold text-neutral-900">Nuevo Manifiesto</h1>
          </div>
        </header>
        <div className="max-w-md mx-auto p-6 mt-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-warning-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Acceso restringido</h3>
              <p className="text-neutral-600 mb-4">
                El perfil <span className="font-semibold">{currentUser?.rol || 'actual'}</span> no tiene permisos para crear manifiestos.
              </p>
              <p className="text-sm text-neutral-500 mb-6">
                La creación depende del rol activo, su actor vinculado y las funciones habilitadas. Si tenés más de una actividad, seleccioná la que corresponde antes de continuar.
              </p>
              <Button fullWidth onClick={() => navigate(mp('/manifiestos'))}>
                Volver a Manifiestos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div ref={formRef} className="mx-auto max-w-3xl min-w-0 pb-6" data-operational-page>
      {/* Header */}
      <header className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col items-start gap-3 min-w-0">
            <Button
              variant="ghost"
              className="shrink-0"
              aria-label="Volver a Manifiestos"
              leftIcon={<ArrowLeft size={20} aria-hidden="true" />}
              onClick={returnToList}
            >
              Manifiestos
            </Button>
          </div>
        </div>
      </header>

      {draft.conflict && <div className="mb-3"><DraftConflictNotice durable={draft.conflictSaved} count={draft.conflictCount} onReload={draft.reload} onKeep={draft.overwrite} /></div>}
      {draft.draft.pendingCreate && <div ref={pendingSendNotice} tabIndex={-1} role="status" className="mb-3 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700">
        <p className="font-semibold">{createManifiesto.isPending ? 'Enviando manifiesto…' : 'Envío sin confirmar'}</p>
        <p className="mt-1">Conservamos el envío original. Comprobarlo recupera el manifiesto si ya se guardó, sin crear otro ni repetir avisos.</p>
        <Button className="mt-3" onClick={handleSubmit} disabled={createManifiesto.isPending || draft.conflict}>Comprobar envío</Button>
      </div>}
      {((draft.saved && !draft.draft.pendingCreate) || draft.error) && <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 rounded-lg bg-primary-50 px-3 text-sm text-primary-900" aria-label="Borrador del manifiesto">
        <p role={draft.error ? 'alert' : 'status'} className="py-2">{draft.error ? 'No se pudo guardar aquí. Conservá esta pestaña abierta.' : <>{draft.restored ? 'Borrador recuperado' : 'Borrador guardado'}<span className="block text-xs text-neutral-600">En este dispositivo</span></>}</p>
        {!discardDraft && !draft.draft.pendingCreate && <button type="button" aria-label="Descartar borrador" className="min-h-11 font-semibold underline underline-offset-2" onClick={() => setDiscardDraft(true)}>Descartar</button>}
        {discardDraft && !draft.draft.pendingCreate && <div className="flex flex-wrap items-center gap-3 pb-2" role="group" aria-label="Confirmar descarte"><span>¿Borrar lo cargado?</span><Button size="sm" variant="outline" onClick={() => setDiscardDraft(false)}>Conservar</Button><Button size="sm" variant="outline" onClick={() => { if (draft.clear()) { setValidationErrors({}); setServerPartyIssues({}); setSubmitError(undefined); setConfirmWithoutTransport(false); setDiscardDraft(false); } }}>Sí, descartar</Button></div>}
      </div>}

      <ol aria-label="Etapas del formulario" className="mb-3 grid grid-cols-3 gap-2 text-sm text-neutral-600">
        {['Generador', 'Residuos', 'Destino'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`border-b-2 py-3 text-center ${step === index + 1 ? 'border-primary-700 font-semibold text-primary-800' : 'border-neutral-200'}`}>{index + 1}. {label}</li>)}
      </ol>
      {partyProposal && <details className="group mb-3 text-sm text-neutral-700"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-2 font-medium text-primary-800 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700">Cómo se aprueba<ChevronDown size={16} aria-hidden="true" className="group-open:rotate-180"/></summary><p className="px-2 pb-3">{formData.modalidad==='IN_SITU'?'Generador, transporte y operador deben aprobar antes de comenzar el tratamiento en origen. El transporte aprueba aunque no haya viaje.':'Generador, transporte y operador deben aprobar desde sus cuentas antes del retiro.'}{!isAdmin && ' Tu empresa queda vinculada a tu rol.'}</p></details>}
      {hasPartyIssue && <div data-party-error tabIndex={-1} role="alert" className="mb-4 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-900">
        <p className="font-semibold">Revisá las partes antes de crear</p>
        <p className="mt-1">{submitError || 'Hay un actor o una cuenta que no puede aprobar. El motivo aparece junto a su selección.'}</p>
        <Button variant="outline" className="mt-2" disabled={refreshingParties} onClick={refreshPartyStates}>{refreshingParties ? 'Actualizando estados…' : 'Actualizar estados'}</Button>
      </div>}

      <fieldset className="min-w-0" disabled={refreshingParties || !!draft.draft.pendingCreate} aria-busy={refreshingParties || createManifiesto.isPending}>
        {/* Step 1: Datos del Generador */}
        {step === 1 && (
          <Card className="p-4 sm:p-5">
            <CardHeader
              title="Datos del Generador"
            />
            <CardContent className="space-y-4">
              <div>
                <Select
                  label="Generador *"
                  value={formData.generadorId}
                  onChange={(val) => {
                    if (val === formData.generadorId) return;
                    clearPartyError('generador');
                    setServerPartyIssues({});
                    setValidationErrors({});
                    const gen = generadoresList.find((g: any) => g.id === val);
                    setFormData({ ...formData, generadorId: val, generador: gen?.razonSocial || gen?.nombre || '', residuos: [{ tipo: '', cantidad: '', unidad: 'kg' }], transportista: ownCarrierId, operador: ownOperatorId });
                  }}
                  options={[...generadoresList]
                    .sort((a: any, b: any) => (a.razonSocial || '').localeCompare(b.razonSocial || ''))
                    .map((g: any) => ({
                      value: g.id,
                      label: `${g.razonSocial || g.nombre || g.label} — ${g.cuit || ''}${partyProposal ? partyApprovalSuffix(g) : ''}`,
                    }))}
                  renderOption={(opt) => {
                    const gen = generadoresList.find((g: any) => g.id === opt.value) as any;
                    const corrientes = gen ? parseCorrientes(gen.corrientesControl || gen.categoriasControl) : [];
                    return (
                      <div>
                        <div className="text-sm font-medium text-neutral-900 truncate">{gen?.razonSocial || opt.label}</div>
                        {partyProposal && gen && partyApprovalSuffix(gen) && <p className="text-xs text-error-700">{partyApprovalSuffix(gen).replace(' · ', '')}</p>}
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs text-neutral-500 font-mono">{gen?.cuit || ''}</span>
                          {corrientes.length > 0 && (
                            <>
                              <span className="text-neutral-300">·</span>
                              {corrientes.slice(0, 6).map((c: string) => (
                                <span key={c} className="inline-block px-1.5 py-0 rounded bg-warning-100 text-warning-700 text-[10px] font-semibold">{c}</span>
                              ))}
                              {corrientes.length > 6 && <span className="text-[10px] text-neutral-400">+{corrientes.length - 6}</span>}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }}
                  placeholder="Buscar generador por nombre o CUIT..."
                  searchable
                  errorMessage={validationErrors.generador || partyIssues.generador}
                  size="base"
                  disabled={isGenerador}
                />
              </div>

              <ActorSummary actor={selectedGenerador} label="Datos del generador" />

              <div className="flex justify-end pt-4">
                <Button onClick={() => { if (validateForm(1)) setStep(2); }}>
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Residuos */}
        {step === 2 && (
          <Card className="p-4 sm:p-5">
            <CardHeader 
              title="Residuos declarados"
            />
            <CardContent className="space-y-4">
              {hasDeclaredResidueMatch && (
                <details className="group rounded-lg border border-neutral-200 text-sm">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700">
                    <span>{residuosFiltrados.length} tipos de residuos disponibles</span><ChevronDown size={16} className="shrink-0 group-open:rotate-180" aria-hidden="true"/>
                  </summary>
                  <p className="px-3 pb-3 text-neutral-700">Corrientes declaradas por el generador: {genCorrientes.join(', ')}.</p>
                </details>
              )}
              {genCorrientes.length > 0 && !hasDeclaredResidueMatch && (
                <div className="flex items-center gap-2 p-2.5 bg-warning-50 border border-warning-200 rounded-xl text-xs text-warning-700">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>
                    No se encontraron residuos para las corrientes <strong>{genCorrientes.join(', ')}</strong> del generador. Mostrando todos los tipos de residuo.
                  </span>
                </div>
              )}
              {formData.residuos.map((residuo, index) => (
                <div key={index} className="p-4 bg-neutral-50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Residuo #{index + 1}
                    </span>
                    {formData.residuos.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Quitar residuo ${index + 1}`}
                        onClick={() => handleRemoveResiduo(index)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-error-700 hover:bg-error-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div>
                    <Select
                      label="Tipo de Residuo *"
                      value={residuo.tipo}
                      onChange={(val) => handleResiduoChange(index, 'tipo', val)}
                      options={residuosFiltrados.map((r: any) => ({
                        value: r.id,
                        label: `${r.codigo} - ${r.nombre || r.descripcion}`,
                      }))}
                      placeholder="Buscar tipo de residuo..."
                      searchable
                      errorMessage={validationErrors.residuos && !residuo.tipo ? 'Requerido' : undefined}
                      size="sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Input
                        label="Cantidad *"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={residuo.cantidad}
                        onChange={(e) => handleResiduoChange(index, 'cantidad', e.target.value)}
                        placeholder="0"
                        errorMessage={validationErrors.residuos && (!residuo.cantidad || Number(residuo.cantidad) <= 0) ? 'Ingresá una cantidad mayor que cero.' : undefined}
                      />
                    </div>
                    <Select
                      label="Unidad"
                      value={residuo.unidad}
                      onChange={(val) => handleResiduoChange(index, 'unidad', val)}
                      options={[
                        { value: 'kg', label: 'kg' },
                        { value: 'tn', label: 'tn' },
                        { value: 'lt', label: 'lt' },
                        { value: 'un', label: 'un' },
                      ]}
                      size="sm"
                    />
                  </div>
                </div>
              ))}

              {validationErrors.residuos && (
                <div className="bg-error-50 border border-error-200 rounded-xl p-3 text-sm text-error-700">
                  {validationErrors.residuos}
                </div>
              )}

              <Button
                variant="outline"
                fullWidth
                leftIcon={<Plus size={18} />}
                onClick={handleAddResiduo}
              >
                Agregar Residuo
              </Button>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Anterior
                </Button>
                <Button
                  onClick={() => {
                    if (!validateForm(2)) return;
                    setValidationErrors(prev => { const n = {...prev}; delete n.residuos; return n; });
                    // A previously selected transport must still support the updated residues.
                    if (formData.transportista && !transportistasFiltrados.some((t) => t.id === formData.transportista)) {
                      setFormData(prev => ({ ...prev, transportista: ownCarrierId, vehiculoId: '', choferId: '' }));
                    }
                    // Clear operador if no longer valid for the selected residuos
                    if (formData.operador) {
                      const curResiduoIds = formData.residuos.map(r => r.tipo).filter(Boolean);
                      if (curResiduoIds.length > 0) {
                        const op = operadoresList.find((o: any) => o.id === formData.operador);
                        if (op) {
                          const opResiduoIds = new Set(
                            ((op as any).tratamientos || [])
                              .filter((t: any) => t.activo !== false)
                              .map((t: any) => t.tipoResiduoId)
                          );
                          const stillValid = curResiduoIds.every(id => opResiduoIds.has(id));
                          if (!stillValid && !operatorProposal) {
                            setFormData(prev => ({ ...prev, operador: ownOperatorId }));
                          }
                        }
                      }
                    }
                    setStep(3);
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Transporte y Operador */}
        {step === 3 && (
          <Card className="p-4 sm:p-5">
            <CardHeader
              title="Transporte y Destino"
            />
            <CardContent className="space-y-4">
              {/* Modalidad selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  ¿Dónde se realizará el tratamiento? *
                </label>
                <div role="group" aria-label="Modalidad de operación" className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={formData.modalidad === 'FIJO'}
                    onClick={() => {
                      setConfirmWithoutTransport(false);
                      if (formData.modalidad === 'FIJO') return;
                      setFormData(prev => ({ ...prev, modalidad: 'FIJO', operador: ownOperatorId }));
                      setValidationErrors(prev => { const n = {...prev}; delete n.transportista; return n; });
                    }}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.modalidad === 'FIJO'
                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <Truck size={20} className={formData.modalidad === 'FIJO' ? 'text-primary-600' : 'text-neutral-400'} />
                    <div>
                      <p className={`text-sm font-semibold ${formData.modalidad === 'FIJO' ? 'text-primary-700' : 'text-neutral-700'}`}>Con traslado</p>
                      <p className="text-xs text-neutral-600">En la planta del operador · Fijo</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-pressed={formData.modalidad === 'IN_SITU'}
                    onClick={() => {
                      if (formData.modalidad === 'IN_SITU') return;
                      if (formData.vehiculoId || formData.choferId || (!partyProposal && formData.transportista)) setConfirmWithoutTransport(true);
                      else selectInSitu();
                    }}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.modalidad === 'IN_SITU'
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <MapPin size={20} className={formData.modalidad === 'IN_SITU' ? 'text-emerald-600' : 'text-neutral-400'} />
                    <div>
                      <p className={`text-sm font-semibold ${formData.modalidad === 'IN_SITU' ? 'text-emerald-700' : 'text-neutral-700'}`}>En origen</p>
                      <p className="text-xs text-neutral-600">El operador va al generador · In situ</p>
                    </div>
                  </button>
                </div>
              </div>

              {confirmWithoutTransport && <div role="alert" className="space-y-3 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
                {partyProposal?<p><strong>Ya asignaste vehículo o chofer.</strong> En origen no hay viaje: se quitan esas asignaciones y se conserva el transporte como aprobador.</p>:<p><strong>Ya asignaste un transporte.</strong> Pasar a tratamiento en origen lo quita del borrador, junto con su vehículo y chofer.</p>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setConfirmWithoutTransport(false)}>{partyProposal?'Mantener traslado':'Mantener transporte'}</Button>
                  <Button onClick={selectInSitu}>{partyProposal?'Continuar en origen':'Continuar sin transporte'}</Button>
                </div>
              </div>}

              {/* In Situ note */}
              {formData.modalidad === 'IN_SITU' && (
                <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 animate-fade-in">
                  <MapPin size={16} className="shrink-0 mt-0.5" />
                  <span><strong>Sin traslado.</strong> El operador trabajará en el domicilio del generador. {partyProposal?'Las tres partes reciben un aviso y deben aprobar; el transporte no realiza un viaje.':'Se guardará un borrador pendiente de la firma del generador.'}</span>
                </div>
              )}

              {/* In situ, the carrier approves without a vehicle or trip. */}
              {(partyProposal || formData.modalidad === 'FIJO') && (
                <>
                  {selectedCodigos.length > 0 && transportistasFiltrados.length < transportistasList.length && (
                    <div className="flex items-center gap-2 p-2.5 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700">
                      <Info size={14} className="shrink-0" />
                      <span>Mostrando <strong>{transportistasFiltrados.length}</strong> transportistas compatibles con los residuos seleccionados</span>
                    </div>
                  )}
                  <div>
                    <Select
                      label={formData.modalidad === 'IN_SITU' ? 'Transportista aprobador *' : 'Transportista *'}
                      value={formData.transportista}
                      disabled={carrierProposal}
                      onChange={(val) => { clearPartyError('transportista'); setFormData(prev => val === prev.transportista ? prev : ({ ...prev, transportista: val, vehiculoId: '', choferId: '' })); }}
                      options={[...(carrierProposal ? transportistasFiltrados.filter(t => t.id === ownCarrierId) : transportistasFiltrados)]
                        .sort((a: any, b: any) => (a.razonSocial || '').localeCompare(b.razonSocial || ''))
                        .map((t: any) => ({
                          value: t.id,
                          label: `${t.razonSocial || t.nombre || t.label}${t.cuit ? ` — ${t.cuit}` : ''}${partyProposal ? partyApprovalSuffix(t) : ''}`,
                        }))}
                      placeholder={transportistasFiltrados.length === 0 ? 'No hay transportistas compatibles con estos residuos' : 'Buscar transportista por nombre o CUIT...'}
                      searchable
                      errorMessage={validationErrors.transportista || partyIssues.transportista}
                      size="base"
                    />
                  </div>

                  <ActorSummary actor={selectedTransportista} label="Datos del transportista" />
                  {selectedTransportista && formData.modalidad === 'FIJO' && <div className="grid gap-4 sm:grid-cols-2">
                    <Select label="Vehículo (opcional)" value={formData.vehiculoId}
                      onChange={value => setFormData(prev => ({ ...prev, vehiculoId: value }))}
                      options={vehiculos.map((v: { id: string; patente: string; marca: string; modelo: string }) => ({ value: v.id, label: `${v.patente} · ${v.marca} ${v.modelo}`.trim() }))}
                      placeholder={vehiculos.length ? 'Elegir vehículo' : 'Sin vehículos activos'}
                      disabled={!vehiculos.length} searchable clearable />
                    <Select label="Chofer (opcional)" value={formData.choferId}
                      onChange={value => setFormData(prev => ({ ...prev, choferId: value }))}
                      options={choferes.map((c: { id: string; nombre: string; apellido: string; dni: string }) => ({ value: c.id, label: `${c.nombre} ${c.apellido} · ${c.dni}`.trim() }))}
                      placeholder={choferes.length ? 'Elegir chofer' : 'Sin choferes activos'}
                      disabled={!choferes.length} searchable clearable />
                  </div>}
                </>
              )}

              <div>
                {selectedResiduoIds.length > 0 && (
                  <div className="mb-2 text-sm text-neutral-600">
                    <span>
                      Mostrando {operadoresFiltrados.length} operador{operadoresFiltrados.length !== 1 ? 'es' : ''} compatible{operadoresFiltrados.length !== 1 ? 's' : ''} con los residuos seleccionados
                    </span>
                  </div>
                )}
                <Select
                  label="Operador / Destino *"
                  value={formData.operador}
                  disabled={operatorProposal}
                  onChange={(val) => { clearPartyError('operador'); setFormData({ ...formData, operador: val }); }}
                  options={[...operadoresFiltrados]
                    .sort((a: any, b: any) => (a.razonSocial || '').localeCompare(b.razonSocial || ''))
                    .map((o: any) => ({
                      value: o.id,
                      label: `${o.razonSocial || o.nombre || o.label}${o.cuit ? ` — ${o.cuit}` : ''}${partyProposal ? partyApprovalSuffix(o) : ''}`,
                    }))}
                  placeholder={operadoresFiltrados.length === 0 && selectedResiduoIds.length > 0
                    ? 'No hay operadores compatibles con estos residuos'
                    : 'Buscar operador por nombre o CUIT...'}
                  searchable
                  errorMessage={validationErrors.operador || partyIssues.operador}
                  size="base"
                />
              </div>

              <ActorSummary actor={selectedOperador} label="Datos del operador" />

              <div>
                <Input
                  label={formData.modalidad==='IN_SITU'?'Fecha prevista de inicio':'Fecha estimada de retiro'}
                  type="date"
                  value={formData.fechaRetiro}
                  onChange={(e) => setFormData({ ...formData, fechaRetiro: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="manifest-observaciones" className="block text-sm font-medium text-neutral-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  id="manifest-observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                  className="w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-neutral-400 focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20 focus:outline-none resize-y"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Anterior
                </Button>
                <Button
                  leftIcon={createManifiesto.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  onClick={handleSubmit}
                  disabled={createManifiesto.isPending || refreshingParties || draft.conflict}
                >
                  {createManifiesto.isPending ? 'Guardando...' : 'Crear Manifiesto'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </fieldset>
    </div>
  );
};

export default NuevoManifiestoPage;
