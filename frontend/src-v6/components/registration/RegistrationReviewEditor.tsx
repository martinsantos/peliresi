import { useState, useRef } from 'react';
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
import { toast } from '../ui/Toast';
import type { SolicitudInscripcion } from '../../types/api';

/** Edits declarations, not credentials or approval. The API rechecks sector,
 * current state and exact revision and commits before/after history atomically. */
export function RegistrationReviewEditor({ application, onClose, onSaved }: { application: SolicitudInscripcion; onClose: () => void; onSaved: () => void | Promise<unknown> }) {
  const [initial] = useState(() => {
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
  });
  const [form, setForm] = useState(initial.form);
  const [step, setStep] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(initial.error);
  const pending = useRef(false);
  const isGenerador = application.tipoActor === 'GENERADOR', isOperador = application.tipoActor === 'OPERADOR';
  const steps = (isGenerador ? STEPS_GENERADOR : isOperador ? STEPS_OPERADOR : STEPS_TRANSPORTISTA).slice(0, -2);
  const up = (field: string, value: string) => setForm(previous => ({ ...previous, [field]: value }));
  const save = async () => {
    if (pending.current || initial.error) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      await solicitudService.corregirDatos(application.id, form, initial.version);
      // A failed refresh is not a failed write. Do not offer to repeat an
      // acknowledged correction against the previous revision.
      onClose();
      try { await onSaved(); }
      catch { toast.warning('Corrección guardada', 'No se pudo actualizar la vista. Recargá la solicitud antes de continuar.'); }
    }
    catch (cause) { setError(getApiErrorMessage(cause, 'No se confirmó la corrección. Tus cambios siguen en pantalla; no se aprobó la solicitud.')); }
    finally { pending.current = false; setBusy(false); }
  };
  return <Modal isOpen onClose={onClose} size="xl" title="Corregir datos de la solicitud" description="La corrección guarda historial antes/después. No cambia la cuenta ni aprueba el trámite." isBusy={busy}
    footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={Boolean(initial.error)} isLoading={busy} onClick={() => void save()}>Guardar corrección</Button></>}>
    <div className="space-y-5"><Select label="Sección de la solicitud" value={String(step)} onChange={value => setStep(Number(value))} options={steps.map(item => ({ value: String(item.id), label: `${item.id}. ${item.label}` }))} />
      {error && <p role="alert" className="text-sm text-error-800">{error}</p>}
      <fieldset disabled={busy} className="min-w-0">
        {(isGenerador && step === 5 || isOperador && step === 6) ? <StepActividad form={form} up={up} isOperador={isOperador} /> : <StepEmpresa step={step} form={form} up={up} attempted={new Set()} isGenerador={isGenerador} isOperador={isOperador} isTransportista={!isGenerador && !isOperador}
          fleet={<RegistrationFleetFields allowLicenseUpload={false} drivers={fleetRows(form.choferesJson, EMPTY_DRIVER)} vehicles={fleetRows(form.vehiculosJson, EMPTY_VEHICLE)} onDrivers={rows => up('choferesJson', JSON.stringify(rows))} onVehicles={rows => up('vehiculosJson', JSON.stringify(rows))} />} />}
      </fieldset>
    </div>
  </Modal>;
}
