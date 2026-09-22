import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronDown } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';

export interface InspectionWorkspaceStep {
  id: string;
  label: string;
  title: string;
  description: string;
  detail?: string;
  complete?: boolean;
  content: React.ReactNode;
  nextAction?: React.ReactNode;
  anchors?: Array<{ id: string; label: string; detail?: string }>;
}

interface Props {
  steps: InspectionWorkspaceStep[];
  reference: InspectionWorkspaceStep[];
  guided: boolean;
  defaultStep: string;
  saveAction?: React.ReactNode;
  onBeforeNavigate: () => void;
}

/** One section at a time. The hash is the source of truth, including browser back/forward. */
export function InspectionWorkspace({ steps, reference, guided, defaultStep, saveAction, onBeforeNavigate }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [indexOpen, setIndexOpen] = useState(false);
  const [visibleAnchorKey, setVisibleAnchorKey] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousHash = useRef(location.hash);
  const all = [...steps, ...reference];
  let hash = location.hash.slice(1);
  try { hash = decodeURIComponent(hash); } catch { /* malformed links fall back to the first step */ }
  const active = all.find((step) => step.id === hash.split('/')[0])
    || all.find((step) => step.id === defaultStep) || steps[0];
  const index = steps.findIndex((step) => step.id === active.id);
  const selectedAnchor = active.anchors?.find((anchor) => anchor.id === hash.split('/').slice(1).join('/'));
  const visibleAnchor = visibleAnchorKey === null ? selectedAnchor : active.anchors?.find((anchor) => `${active.id}/${anchor.id}` === visibleAnchorKey);
  const anchorIds = active.anchors?.map((anchor) => anchor.id).join('|') || '';

  // The application scrolls <main>, not window. Track the control as it enters
  // the readable area below the pinned guide, without interrupting typing.
  useEffect(() => {
    const main = workspaceRef.current?.closest('main');
    if (!main || !anchorIds) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const guide = workspaceRef.current?.querySelector<HTMLElement>('[data-testid="inspection-navigation"]');
      const compact = window.matchMedia('(max-width: 1023px)').matches;
      const threshold = main.getBoundingClientRect().top + (compact ? (guide?.getBoundingClientRect().height || 0) + 32 : 112);
      const markers = Array.from(workspaceRef.current?.querySelectorAll<HTMLElement>('[data-inspection-anchor]') || [])
        .filter((element) => element.getClientRects().length && element.dataset.inspectionAnchor?.startsWith(`${active.id}/`));
      let current = '';
      for (const marker of markers) {
        if (marker.getBoundingClientRect().top > threshold) break;
        current = marker.dataset.inspectionAnchor || '';
      }
      setVisibleAnchorKey((previous) => previous === current ? previous : current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (workspaceRef.current) resizeObserver?.observe(workspaceRef.current);
    main.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => { resizeObserver?.disconnect(); main.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); if (frame) cancelAnimationFrame(frame); };
  }, [active.id, anchorIds]);

  useEffect(() => {
    if (previousHash.current === location.hash) return;
    const previousSection = previousHash.current.split('/')[0];
    previousHash.current = location.hash;
    if (previousSection === location.hash.split('/')[0]) return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }, [location.hash]);

  const go = (step: InspectionWorkspaceStep) => {
    onBeforeNavigate();
    setIndexOpen(false);
    navigate({ pathname: location.pathname, search: location.search, hash: `#${step.id}` });
  };
  const goToAnchor = (code: string) => {
    if (!active.anchors?.some((anchor) => anchor.id === code)) return;
    onBeforeNavigate();
    setIndexOpen(false);
    navigate({ pathname: location.pathname, search: location.search, hash: `#${active.id}/${encodeURIComponent(code)}` }, { replace: true });
    // Also return to a selected point when its hash is already the current URL.
    requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-inspection-anchor]'))
        .find((element) => element.dataset.inspectionAnchor === `${active.id}/${code}`);
      target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  };
  const stepLink = (step: InspectionWorkspaceStep, order?: number) => {
    const selected = active.id === step.id;
    return <a key={step.id} href={`#${step.id}`} aria-current={selected ? 'step' : undefined}
      onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); go(step); } }}
      className={`flex min-h-12 min-w-0 items-start gap-3 rounded-lg px-3 py-3 !no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${selected ? 'bg-primary-50 text-primary-900' : 'text-neutral-700 hover:bg-neutral-100'}`}>
      {order !== undefined && <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${selected ? 'border-primary-700 bg-primary-700 text-white' : step.complete ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-neutral-300 bg-white text-neutral-600'}`}>{step.complete ? <Check size={15} /> : order + 1}</span>}
      <span className="min-w-0 pt-0.5"><span className="block text-sm font-semibold leading-snug">{step.label}</span>{step.detail && <span className="mt-1 block text-xs leading-snug text-neutral-600">{step.detail}</span>}</span>
    </a>;
  };

  return <div ref={workspaceRef} data-testid="inspection-workspace" className="min-w-0 rounded-xl border border-neutral-200 bg-white lg:grid lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[224px_minmax(0,1fr)]">
    <aside data-testid="inspection-navigation" className="sticky top-0 z-20 min-w-0 self-start border-b border-neutral-200 bg-white lg:static lg:self-stretch lg:border-b-0 lg:border-r lg:bg-neutral-50/50">
      <button type="button" aria-label={`Ver todos los pasos · ${active.label}`} aria-expanded={indexOpen} aria-controls="inspection-step-index" onClick={() => setIndexOpen((open) => !open)} className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left lg:hidden">
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-neutral-900">{guided && index >= 0 ? `Paso ${index + 1} de ${steps.length} · ` : ''}{active.label}</span><span data-testid="inspection-current-point" className="mt-1 block text-xs text-neutral-600">{visibleAnchor ? <><span className="block font-semibold text-neutral-800">{visibleAnchor.id} · {visibleAnchor.detail || 'Sin revisar'}</span><span className="block truncate">{visibleAnchor.label}</span></> : 'Inicio de la sección'}</span></span><span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-800">Índice<ChevronDown size={17} className={`transition-transform ${indexOpen ? 'rotate-180' : ''}`} /></span>
      </button>
      <nav id="inspection-step-index" aria-label={guided ? 'Pasos de la inspección' : 'Secciones del expediente'} className={`${indexOpen ? 'block' : 'hidden'} max-h-[55dvh] overflow-y-auto overscroll-contain px-3 pb-4 lg:sticky lg:top-0 lg:block lg:max-h-[calc(100dvh-7rem)] lg:py-5`}>
        <p className="hidden px-3 pb-3 text-xs font-semibold text-neutral-500 lg:block">{guided ? 'Completar inspección' : 'Consultar expediente'}</p>
        {!!active.anchors?.length && <p data-testid="inspection-current-point-desktop" className="mb-3 hidden rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs leading-snug text-primary-900 lg:block"><span className="block font-bold">Ahora · {active.label}</span><span className="mt-1 block">{visibleAnchor ? `${visibleAnchor.id} · ${visibleAnchor.label}` : 'Inicio de la sección'}</span>{visibleAnchor?.detail && <span className="mt-1 block font-semibold">{visibleAnchor.detail}</span>}</p>}
        {!!active.anchors?.length && <label className="mb-3 block px-1 text-xs font-semibold text-neutral-700">Ir a un punto de {active.label}
          <select aria-label={`Ir a un punto de ${active.label}`} value={visibleAnchor?.id || ''} onChange={(event) => goToAnchor(event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-2 text-sm font-normal text-neutral-900">
            <option value="" disabled>Elegir control · {active.anchors.length} puntos</option>
            {active.anchors.map((anchor, i) => <option key={anchor.id} value={anchor.id}>{i + 1}. {anchor.id} · {anchor.detail} · {anchor.label}</option>)}
          </select>
        </label>}
        <ol className="space-y-1">{steps.map((step, i) => <li key={step.id}>{stepLink(step, guided ? i : undefined)}</li>)}</ol>
        {reference.length > 0 && <div className="mt-4 border-t border-neutral-200 pt-3"><p className="px-3 pb-1 text-xs font-semibold text-neutral-500">Seguimiento del expediente</p>{reference.map((step) => stepLink(step))}</div>}
      </nav>
    </aside>
    <div className="min-w-0">
      <header className="border-b border-neutral-200 px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-neutral-500"><span>{guided && index >= 0 ? `Paso ${index + 1} de ${steps.length}` : 'Consulta del expediente'}</span>{active.detail && <span>{active.detail}</span>}</div>
        <h2 ref={headingRef} id="inspection-step-heading" tabIndex={-1} className="scroll-mt-24 text-xl font-extrabold tracking-tight text-neutral-900 outline-none sm:text-2xl">{active.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">{active.description}</p>
        {guided && index >= 0 && <div role="progressbar" aria-label="Paso actual del recorrido" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-200"><span className="block h-full bg-primary-600 transition-[width]" style={{ width: `${(index + 1) / steps.length * 100}%` }} /></div>}
      </header>
      {/* Keep child drafts and selected files alive when navigating. Hidden panels
          are removed from layout and the accessibility tree, not from React. */}
      {all.map((step) => <section key={step.id} hidden={step.id !== active.id} aria-label={step.title} id={step.id === 'verificacion' ? undefined : step.id} data-testid={step.id === active.id ? 'inspection-step-content' : undefined} className="min-w-0 space-y-5 p-4 sm:p-6 [&>section]:shadow-none [&>div]:shadow-none">
        {step.content}
      </section>)}
      {index >= 0 && <footer data-testid="inspection-action-bar" className="flex flex-col gap-3 border-t border-neutral-200 bg-neutral-50/60 p-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between sm:px-6">
        <div className="flex min-w-0 gap-2 [&>button]:w-full min-[480px]:[&>button]:w-auto">{index > 0 ? <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={() => go(steps[index - 1])}>Anterior</Button> : saveAction}</div>
        <div className="flex min-w-0 flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:justify-end [&>button]:w-full min-[480px]:[&>button]:w-auto">{index > 0 && saveAction}{active.nextAction || (index < steps.length - 1 && <Button rightIcon={<ArrowRight size={16} />} onClick={() => go(steps[index + 1])}>Siguiente</Button>)}</div>
      </footer>}
    </div>
  </div>;
}
