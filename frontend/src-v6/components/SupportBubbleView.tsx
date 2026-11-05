import { useEffect, useRef, useState } from 'react';
import { TaskHelp } from './TaskHelp';
import OnboardingWizard from './OnboardingWizard';
import { useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { readSupportDraft } from '../utils/supportDraft';
import { supportSessionMatches } from '../utils/supportSession';
import { captureSupportScreen } from '../services/supportCapture';
import type { SupportCreate } from '../types/support';
import { SupportReportDialog } from './SupportReportDialog';
import { toast } from './ui/Toast';

import { mobileBubbleBottom } from '../utils/supportLayout';

export function SupportBubble({ mobile = false, aboveTrip = false, hidden = false, inline = false }: { mobile?: boolean; aboveTrip?: boolean; hidden?: boolean; inline?: boolean }) {
  const { currentUser } = useAuth();
  if (!currentUser) return null;
  return <Bubble key={String(currentUser.id)} owner={String(currentUser.id)} mobile={mobile} aboveTrip={aboveTrip} hidden={hidden} inline={inline} />;
}

function Bubble({ owner, mobile, aboveTrip, hidden, inline }: { owner: string; mobile: boolean; aboveTrip: boolean; hidden: boolean; inline: boolean }) {
  const { impersonationData } = useImpersonation();
  const { currentUser } = useAuth();
  const location = useLocation();
  const [help, setHelp] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [needsHelp, setNeedsHelp] = useState(false);
  useEffect(() => {
    setHelp(false); setWelcome(false); setNeedsHelp(false);
    let attempted = false, indicated = false;
    // Observe validity markers, never typed values. Do not open a dialog or steal focus.
    const root = document.querySelector('main') || document.body;
    const check = () => {
      const invalidControl = attempted && [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')]
        .some(control => control.willValidate && !control.validity.valid);
      const next = Boolean(root.querySelector('[aria-invalid="true"]') || invalidControl);
      if (next !== indicated) { indicated = next; setNeedsHelp(next); }
    };
    const invalid = () => { attempted = true; check(); };
    document.addEventListener('invalid', invalid, true);
    document.addEventListener('input', check, true);
    const observer = new MutationObserver(check);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-invalid'] });
    check();
    return () => { document.removeEventListener('invalid', invalid, true); document.removeEventListener('input', check, true); observer.disconnect(); };
  }, [location.pathname]);
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<File>();
  const [captureError, setCaptureError] = useState('');
  const [context, setContext] = useState<SupportCreate['contexto']>();
  const [sent, setSent] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // The confirmation floats over the task; it must not stay on every later screen.
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), 8000);
    return () => clearTimeout(timer);
  }, [sent]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const check = () => setKeyboard(Boolean(viewport && viewport.height < window.innerHeight - 150));
    viewport?.addEventListener('resize', check, { passive: true }); check();
    return () => viewport?.removeEventListener('resize', check);
  }, []);
  const report = async () => {
    if (inFlight.current) return;
    setSent(false); setCaptureError(''); setScreenshot(undefined);
    setContext({ ruta: location.pathname, ancho: innerWidth, alto: innerHeight, online: navigator.onLine });
    // Do not capture another represented account or replace files of an uncertain delivery.
    if (impersonationData || readSupportDraft(owner)?.pendiente) { setOpen(true); return; }
    if (!supportSessionMatches(owner)) return;
    inFlight.current = true; setCapturing(true);
    try {
      const file = await captureSupportScreen();
      if (mounted.current && supportSessionMatches(owner)) setScreenshot(file);
    } catch {
      if (mounted.current && supportSessionMatches(owner)) setCaptureError('No pudimos capturar esta pantalla. Podés adjuntar una imagen o enviar sólo el texto.');
    } finally {
      inFlight.current = false;
      if (mounted.current) { setCapturing(false); if (supportSessionMatches(owner)) setOpen(true); }
    }
  };
  const bottom = mobile ? `calc(${mobileBubbleBottom(aboveTrip)}px + env(safe-area-inset-bottom, 0px))` : '24px';
  return <>
    {!hidden && !keyboard && <div data-support-ui className={inline ? 'relative flex shrink-0 items-center' : 'fixed right-4 z-[45] flex flex-col items-end gap-2'} style={inline ? undefined : { bottom }} hidden={open && !inline}>
      {sent && !inline && <p role="status" className="max-w-[240px] rounded-lg border border-primary-200 bg-white p-3 text-sm text-primary-900 shadow-sm">Reporte enviado a soporte. Podés continuar.</p>}
      <button type="button" title="Ayuda y soporte técnico" aria-label="Ayuda y soporte técnico" aria-haspopup="dialog" aria-busy={capturing || undefined} disabled={capturing || open}
        onClick={() => setHelp(true)} className={`flex items-center justify-center gap-2 rounded-full border-2 border-white bg-primary-700 text-white transition-colors hover:bg-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:opacity-80 ${inline ? 'h-[44px] w-[44px] p-0' : mobile ? 'h-12 w-12 p-0 shadow-lg' : 'min-h-12 min-w-12 px-3 shadow-lg'}`}>
        <HelpCircle size={inline ? 20 : 24} aria-hidden="true" />{!mobile && !inline && <span className="hidden text-sm font-semibold sm:inline">{capturing ? 'Capturando…' : needsHelp ? 'Ayuda para completar' : 'Ayuda'}</span>}
      </button>
    </div>}
    <TaskHelp open={help} onClose={() => setHelp(false)} onReport={() => { setHelp(false); void report(); }} onWelcome={() => { setHelp(false); setWelcome(true); }} path={location.pathname} role={currentUser?.rol || 'AUDITOR'} inspector={currentUser?.esInspector} chief={currentUser?.esJefeInspecciones} needsHelp={needsHelp} />
    {welcome && currentUser && <OnboardingWizard key={currentUser.rol} rol={currentUser.rol} esInspector={currentUser.esInspector} esJefeInspecciones={currentUser.esJefeInspecciones} userId={owner} onDismiss={() => setWelcome(false)} />}
    <SupportReportDialog open={open} onClose={() => { setOpen(false); setScreenshot(undefined); }}
      onSubmitted={() => { if (inline) toast.success('Reporte enviado a soporte'); else setSent(true); }} screenshot={screenshot} captureError={captureError} context={context} returnToTask />
  </>;
}
