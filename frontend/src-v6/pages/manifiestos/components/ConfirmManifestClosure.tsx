import React, { useRef, useState } from 'react';
import { Button } from '../../../components/ui/ButtonV2';
import { Modal } from '../../../components/ui/Modal';

/** Confirm a consequential transition and retain the dialog if the server does not confirm it. */
export function ConfirmManifestClosure({ open, received, onClose, onConfirm }: {
  open: boolean;
  received: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const close = () => { if (!inFlight.current) { setError(false); onClose(); } };
  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      if (await onConfirm()) onClose();
      else setError(true);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return <Modal isOpen={open} title="Cerrar manifiesto" onClose={close} isBusy={busy} closeOnOverlayClick={false}>
    <div className="space-y-4">
      <p>El manifiesto pasará a Tratado. Revisá el pesaje y el tratamiento antes de confirmar.</p>
      {received && <p className="rounded-lg bg-amber-50 p-3 text-amber-950" role="status">Todavía no se registró un tratamiento en este manifiesto.</p>}
      {error && <p role="alert">No se confirmó el cierre. Podés reintentar.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={close}>Volver</Button>
        <Button disabled={busy} onClick={() => void confirm()}>{busy ? 'Cerrando…' : 'Confirmar cierre'}</Button>
      </div>
    </div>
  </Modal>;
}
