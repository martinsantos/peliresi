import { useState, useRef, useMemo } from 'react';
import { StepEmpresa } from '../../pages/public/inscripcion/steps/StepEmpresa';
import { StepActividad } from '../../pages/public/inscripcion/steps/StepActividad';
import { STEPS_GENERADOR, STEPS_OPERADOR, STEPS_TRANSPORTISTA } from '../../pages/public/inscripcion/shared';
import { RegistrationFleetFields } from './RegistrationFleetFields';
import { fleetRows, EMPTY_DRIVER, EMPTY_VEHICLE } from '../../services/registrationFleet';
import { solicitudService } from '../../services/solicitud.service';
import { getApiErrorMessage } from '../../utils/api-error';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/ButtonV2';
import { Select } from '../ui/Select';
import { useAdmissionContext } from '../../hooks/useAdmissionContext';
import { useRecoverableForm } from '../../hooks/useRecoverableForm';
import { CompanyDraftNotice, CompanyRevisionNotice } from '../CompanyRevisionDraft';
import { toast } from '../ui/Toast';
import type { SolicitudInscripcion } from '../../types/api';

/** Edits declarations, not credentials or approval. The API rechecks sector,
 * current state and exact revision and commits before/after history atomically. */
export function RegistrationReviewEditor({ application, onClose, onSaved, readOnly = false }: { application: SolicitudInscripcion; onClose: () => void; onSaved: () => void | Promise<unknown>; readOnly?: boolean }) {
  const { owner } = useAdmissionContext();
  const initial = useMemo(() => {
    try {
      const source = JSON.parse(application.datosActor || '{}');
      if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Formato previo incompatible');
      const form = Object.fromEntries(Object.entries(source).filter(([, value]) => typeof value === 'string')) as Record<string, string>;
      for (const key of ['vehiculosJson', 'choferesJson']) {
        if (Array.isArray(source[key])) form[key] = JSON.stringify(source[key]);
        if (!form[key]) continue;
        const rows = JSON.parse(form[key]);
        if (!Array.isArray(rows) || rows.length > 100 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Flota previa incompatible');
      }
      return { form, version: application.updatedAt, error: null };
    } catch { return { form: {} as Record<string, string>, version: application.updatedAt, error: 'No pudimos interpretar los datos originales. No se reemplazarán por un formulario vacío.' }; }
  }, [application.datosActor, application.updatedAt]);
  type Draft = { form: Record<string, string>; revision: string; changed: string[]; step: number };
  const valid = (v: unknown): v is Draft => {
    if (!v || typeof v !== 'object') return false;
    const d = v as Draft;
    return typeof d.revision === 'string' && Number.isFinite(Date.parse(d.revision))
      && !!d.form && typeof d.form === 'object' && !Array.isArray(d.form) && Object.keys(d.form).length <= 200
      && Object.values(d.form).every(value => typeof value === 'string' && value.length <= 100000)
      && Array.isArray(d.changed) && d.changed.every(key => typeof key === 'string' && Object.hasOwn(d.form, key))
      && Number.isInteger(d.step) && d.step >= 1 && d.step <= 10;
  };
  const recovery = useRecoverableForm<Draft>('sitrep:application-editor:v1:' + owner + ':' + application.id, { form: initial.form, revision: initial.version, changed: [], step: 1 }, valid);
  const dirty = recovery.value.changed.length > 0;
  const draft = dirty ? recovery.value : { ...recovery.value, form: initial.form, revision: initial.version };
  const form = draft.form, step = draft.step;
  const serverConflict = dirty && draft.revision !== initial.version;
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(initial.error);
  const pending = useRef(false);
  const isGenerador = application.tipoActor === 'GENERADOR', isOperador = application.tipoActor === 'OPERADOR';
  const steps = (isGenerador ? STEPS_GENERADOR : isOperador ? STEPS_OPERADOR : STEPS_TRANSPORTISTA).slice(0, -2);
  const up = (field: string, value: string) => recovery.update({ ...draft, form: { ...form, [field]: value }, changed: [...new Set([...draft.changed, field])] });
  const setStep = (value: number) => recovery.update({ ...draft, step: value });
  const keep = () => recovery.update({ ...draft, revision: initial.version, form: { ...initial.form, ...Object.fromEntries(draft.changed.map(field => [field, form[field]])) } });
  const save = async () => {
    if (pending.current || initial.error || readOnly || recovery.conflict || serverConflict || !dirty) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      await solicitudService.corregirDatos(application.id, form, draft.revision);
      // A failed refresh is not a failed write. Do not offer to repeat an
      // acknowledged correction against the previous revision.
      recovery.clear();
      onClose();
      try { await onSaved(); }
      catch { toast.warning('Corrección guardada', 'No se pudo actualizar la vista. Recargá la solicitud antes de continuar.'); }
    }
    catch (cause) { setError(getApiErrorMessage(cause, 'No se confirmó la corrección. Tus cambios siguen en pantalla; no se aprobó la solicitud.')); try { await onSaved(); } catch { /* parent blocks decisions until its read recovers */ } }
    finally { pending.current = false; setBusy(false); }
  };
  return <Modal isOpen onClose={onClose} size="xl" title="Corregir datos de la solicitud" description="La corrección guarda historial antes/después. No cambia la cuenta ni aprueba el trámite." isBusy={busy}
    footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={Boolean(initial.error) || readOnly || recovery.conflict || serverConflict || !dirty} isLoading={busy} onClick={() => void save()}>Guardar corrección</Button></>}>
    <div className="space-y-5"><Select label="Sección de la solicitud" value={String(step)} onChange={value => setStep(Number(value))} options={steps.map(item => ({ value: String(item.id), label: `${item.id}. ${item.label}` }))} />
      <CompanyDraftNotice draft={{ dirty, recovery }} label="corrección administrativa" />
      {serverConflict && <CompanyRevisionNotice fields={draft.changed.map(key => [key.replace(/([A-Z])/g, ' $1'), initial.form[key] || 'Sin declarar'])} keep={keep} useServer={recovery.clear} />}
      {readOnly && <p role="status">Esperá a que se actualice la solicitud antes de guardar.</p>}
      {(initial.error || error) && <p role="alert" className="text-sm text-error-800">{initial.error || error}</p>}
      <fieldset disabled={busy || readOnly} className="min-w-0">
        {(isGenerador && step === 5 || isOperador && step === 6) ? <StepActividad form={form} up={up} isOperador={isOperador} /> : <StepEmpresa step={step} form={form} up={up} attempted={new Set()} isGenerador={isGenerador} isOperador={isOperador} isTransportista={!isGenerador && !isOperador}
          fleet={<RegistrationFleetFields allowLicenseUpload={false} drivers={fleetRows(form.choferesJson, EMPTY_DRIVER)} vehicles={fleetRows(form.vehiculosJson, EMPTY_VEHICLE)} onDrivers={rows => up('choferesJson', JSON.stringify(rows))} onVehicles={rows => up('vehiculosJson', JSON.stringify(rows))} />} />}
      </fieldset>
    </div>
  </Modal>;
}
