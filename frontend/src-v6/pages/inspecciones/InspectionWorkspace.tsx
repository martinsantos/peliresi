import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saveInspectionResume } from '../../services/inspectionResume';
import { Eye, FileSearch } from 'lucide-react';

export interface InspectionWorkspaceStep {
  id: string;
  label: string;
  title: string;
  description: string;
  detail?: string;
  complete?: boolean;
  content: React.ReactNode;
  nextAction?: React.ReactNode;
  anchors?: Array<{ id: string; label: string; detail?: string; group?: string; reviewed?: boolean }>;
}

interface Props {
  steps: InspectionWorkspaceStep[];
  reference: InspectionWorkspaceStep[];
  guided: boolean;
  defaultStep: string;
  pageScroll?: boolean;
  saveAction?: React.ReactNode;
  onBeforeNavigate: () => boolean | void;
  resumeIdentity?: { userId: string | number; inspectionId: string; owner: string };
}

const sections = [
  { label: 'Visita y lugar', mobileLabel: 'Visita', ids: ['resumen', 'contexto'] },
  { label: 'Constataciones', mobileLabel: 'Observado', ids: ['acta', 'checklist', 'declaracion'] },
  { label: 'Evidencias', mobileLabel: 'Evidencias', ids: ['evidencias'] },
  { label: 'Revisar y firmar', mobileLabel: 'Revisión', ids: ['revision', 'firma', 'informe-tecnico', 'intercambios', 'trazabilidad', 'verificacion'] },
];
const labels: Record<string, string> = {
  checklist: 'En campo', declaracion: 'Datos declarados', acta: 'Lo observado',
  firma: 'Leer y firmar', evidencias: 'Fotos y archivos', revision: 'Resumen y cierre', 'informe-tecnico': 'Evaluación técnica',
  intercambios: 'Comunicaciones', trazabilidad: 'Historial', verificacion: 'Verificación',
};

/** Direct navigation. Existing deep links, drafts and file selections remain valid. */
export function InspectionWorkspace({ steps, reference, defaultStep, saveAction, onBeforeNavigate, resumeIdentity, pageScroll = false }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [constrainedViewport, setConstrainedViewport] = useState(false);
  const scrollPositions = useRef(new Map<string, number>());
  const all = [...steps, ...reference];
  let hash = location.hash.slice(1);
  try { hash = decodeURIComponent(hash); } catch { /* Invalid links fall back safely. */ }
  const active = all.find((step) => step.id === hash.split('/')[0])
    || all.find((step) => step.id === defaultStep) || steps[0];
  const scrollStepRef = useRef(active.id);
  const [visited, setVisited] = useState<Set<string>>(() => new Set([active.id]));
  if (!visited.has(active.id)) setVisited(new Set([...visited, active.id]));
  const availableSections = sections.map((section) => ({ ...section, entries: section.ids.flatMap((id) => all.filter((step) => step.id === id)) })).filter((section) => section.entries.length);
  const selectedSection = availableSections.find((section) => section.ids.includes(active.id));
  const selectedAnchor = active.anchors?.find((anchor) => anchor.id === hash.split('/').slice(1).join('/'));
  const resumeLabel = selectedAnchor ? active.label + ' · ' + selectedAnchor.label : active.label;
  const editableSection = steps.some((step) => step.id === active.id);
  const resumeUserId = resumeIdentity?.userId;
  const resumeInspectionId = resumeIdentity?.inspectionId;
  const resumeOwner = resumeIdentity?.owner;

  // On Android, the keyboard can pan/shrink visualViewport while h-full/dvh
  // still describe the larger layout viewport. Keep the ordinary flex footer
  // inside the visible panel. If fixed chrome would consume the reading area,
  // the same mounted panel becomes one scroll surface; do not hide/remount
  // fields or leave an invisible zero-height input region behind the keyboard.
  useLayoutEffect(() => {
    const workspace = workspaceRef.current, viewport = window.visualViewport;
    if (!workspace || !viewport) return;
    const surface = pageScroll ? workspace.closest<HTMLElement>('[data-inspection-page-scroll]') || workspace : workspace;
    let frame = 0;
    const measure = () => {
      const top = surface.getBoundingClientRect().top;
      if (!Number.isFinite(top) || !Number.isFinite(viewport.height) || viewport.height <= 0 || !Number.isFinite(viewport.offsetTop)) return;
      const height = Math.max(0, Math.floor(viewport.offsetTop + viewport.height - top - 12));
      surface.style.maxHeight = height + 'px';
      const parentHeight = surface.parentElement?.getBoundingClientRect().height;
      const room = Number.isFinite(parentHeight) && parentHeight! > 0 ? Math.min(height, parentHeight!) : height;
      const navigation = workspace.querySelector<HTMLElement>('[data-testid="inspection-navigation"]');
      const footer = workspace.querySelector<HTMLElement>('[data-testid="inspection-action-bar"]');
      const chrome = (navigation?.getBoundingClientRect().height || 0) + (footer?.getBoundingClientRect().height || 0);
      setConstrainedViewport(room < chrome + 96);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    viewport.addEventListener('resize', schedule, { passive: true });
    viewport.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    workspace.addEventListener('focusin', schedule);
    workspace.addEventListener('focusout', schedule);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : undefined;
    if (surface.parentElement) observer?.observe(surface.parentElement);
    for (const element of workspace.querySelectorAll('[data-testid="inspection-navigation"], [data-testid="inspection-action-bar"]')) observer?.observe(element);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect();
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      workspace.removeEventListener('focusin', schedule);
      workspace.removeEventListener('focusout', schedule);
      surface.style.removeProperty('max-height');
    };
  }, [pageScroll]);

  useEffect(() => {
    if (!resumeUserId || !resumeInspectionId || !resumeOwner) return;
    saveInspectionResume(resumeUserId, resumeInspectionId, location.hash || '#' + active.id, resumeLabel, resumeOwner);
  }, [resumeUserId, resumeInspectionId, resumeOwner, location.hash, active.id, resumeLabel]);

  // Preserve section positions on the same page surface; identity and tabs scroll away together.
  useLayoutEffect(() => {
    const region = pageScroll ? workspaceRef.current?.closest<HTMLDivElement>('[data-inspection-page-scroll]') || workspaceRef.current : constrainedViewport ? workspaceRef.current : contentRef.current;
    const previous = scrollRef.current;
    if (region) {
      region.style.removeProperty('--inspection-scroll-reserve');
      region.scrollTop = previous && previous !== region && scrollStepRef.current === active.id ? previous.scrollTop : scrollPositions.current.get(active.id) || 0;
    }
    scrollRef.current = region;
    scrollStepRef.current = active.id;
  }, [active.id, constrainedViewport, pageScroll]);

  useEffect(() => {
    if (!pageScroll) return;
    const region = scrollRef.current;
    const rememberPosition = () => { if (region) scrollPositions.current.set(active.id, region.scrollTop); };
    region?.addEventListener('scroll', rememberPosition, { passive: true });
    return () => region?.removeEventListener('scroll', rememberPosition);
  }, [active.id, pageScroll]);

  // Remember the actual visible field, without changing browser history or
  // adding another navigation bar. This also covers manual long-list scrolling.
  useEffect(() => {
    if (!resumeUserId || !resumeInspectionId || !resumeOwner || !active.anchors?.length) return;
    let frame = 0;
    const remember = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const workspace = workspaceRef.current;
        if (!workspace) return;
        const edge = scrollRef.current?.getBoundingClientRect().top || 0;
        const candidates = Array.from(workspace.querySelectorAll<HTMLElement>('[data-inspection-anchor]'))
          .filter((element) => element.getClientRects().length && element.getBoundingClientRect().bottom > edge);
        const current = candidates.find((element) => element.getBoundingClientRect().top >= edge - 8) || candidates[0];
        const point = current?.dataset.inspectionAnchor;
        const entry = active.anchors?.find((anchor) => point === active.id + '/' + anchor.id);
        if (point && entry) saveInspectionResume(resumeUserId, resumeInspectionId, '#' + point, active.label + ' · ' + entry.label, resumeOwner);
      });
    };
    const region = scrollRef.current;
    region?.addEventListener('scroll', remember);
    return () => { region?.removeEventListener('scroll', remember); cancelAnimationFrame(frame); };
  }, [active.id, active.anchors, active.label, resumeUserId, resumeInspectionId, resumeOwner, constrainedViewport, pageScroll]);

  const go = (event: React.MouseEvent<HTMLAnchorElement>, step: InspectionWorkspaceStep) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (onBeforeNavigate() === false) return;
    if (scrollRef.current) scrollPositions.current.set(active.id, scrollRef.current.scrollTop);
    navigate({ pathname: location.pathname, search: location.search, hash: '#' + step.id });
  };

  return <div ref={workspaceRef} data-testid="inspection-workspace" data-inspection-scroll={!pageScroll && constrainedViewport ? '' : undefined} data-constrained-viewport={constrainedViewport || undefined} className={(pageScroll ? 'shrink-0 ' : 'h-full ') + 'flex min-h-0 min-w-0 flex-col rounded-xl border border-neutral-200 bg-white [--inspection-middle-top:0px] [--inspection-anchor-offset:56px]' + (!pageScroll && constrainedViewport ? ' overflow-y-auto overscroll-contain [overflow-anchor:none]' : '')} onScroll={(event) => { if (!pageScroll && constrainedViewport && event.target === event.currentTarget) scrollPositions.current.set(active.id, event.currentTarget.scrollTop); }}>
    <div data-testid="inspection-navigation" className={(pageScroll || constrainedViewport ? 'relative' : 'sticky top-0') + ' z-20 shrink-0 rounded-t-xl bg-white'}>
      <nav aria-label="Secciones del expediente" className="flex gap-1 border-b border-neutral-200 bg-neutral-100 p-2">
        {availableSections.map((section) => <a key={section.label} aria-label={section.label} href={'#' + section.entries[0].id} aria-current={selectedSection === section ? 'page' : undefined} onClick={(event) => go(event, section.entries[0])}
          className={'flex min-h-[68px] [@media(max-height:500px)]:min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-lg px-1 text-xs font-semibold !no-underline transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:min-h-14 sm:flex-row sm:gap-3 sm:px-4 sm:text-sm ' + (selectedSection === section ? 'bg-primary-700 text-white hover:text-white focus-visible:text-white' : 'text-neutral-700 hover:bg-white hover:text-neutral-900')}><span aria-hidden="true" className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold leading-none tabular-nums ' + (selectedSection === section ? 'bg-white/20 text-white' : 'bg-white text-neutral-600')}>{sections.findIndex(entry => entry.label === section.label) + 1}</span><span className="text-center text-[11px] leading-4 sm:hidden">{section.mobileLabel}</span><span className="hidden leading-5 sm:inline">{section.label}</span></a>)}
      </nav>
      {selectedSection && selectedSection.entries.length > 1 && <nav aria-label={'Apartados de ' + selectedSection.label} className="flex gap-1 overflow-x-auto border-b border-primary-200 bg-primary-50 px-2 py-1">
        {selectedSection.entries.map((step) => <a key={step.id} href={'#' + step.id} aria-current={active.id === step.id ? 'page' : undefined} onClick={(event) => go(event, step)}
          className={'flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-2 text-sm !no-underline focus-visible:ring-2 focus-visible:ring-primary-500 sm:px-3 ' + (active.id === step.id ? 'border-primary-300 bg-white font-bold text-primary-900' : 'border-transparent text-neutral-700 hover:bg-white')}>{step.id === 'checklist' && <Eye size={18} aria-hidden="true" />}{step.id === 'declaracion' && <FileSearch size={18} aria-hidden="true" />}{labels[step.id] || step.label}</a>)}
      </nav>}
    </div>
    <div ref={contentRef} data-inspection-scroll={pageScroll || constrainedViewport ? undefined : ''} data-testid="inspection-scroll-region" className={`min-h-0 scroll-pt-14 scroll-pb-4 rounded-b-xl [overflow-anchor:none] after:block after:h-[var(--inspection-scroll-reserve,0px)] after:content-[''] ${pageScroll || constrainedViewport ? 'shrink-0 overflow-visible' : 'flex-1 overflow-y-auto overscroll-contain'}`} onScroll={(event) => { if (!pageScroll && !constrainedViewport && event.target === event.currentTarget) scrollPositions.current.set(active.id, event.currentTarget.scrollTop); }}>
    {active.nextAction && <div data-testid="inspection-start" className="border-b border-primary-200 bg-primary-50 p-4 sm:p-6"><h2 className="mb-1 text-lg font-bold text-primary-900">Comenzar el recorrido</h2><p className="mb-3 text-sm leading-relaxed text-neutral-800">Al iniciar se registra la hora y se abre el trabajo de campo.</p>{active.nextAction}</div>}
    {/* Hidden sections remain mounted to protect local drafts and selected files. */}
    {all.map((step) => <section key={step.id} hidden={step.id !== active.id} aria-label={step.title} id={step.id === 'verificacion' ? undefined : step.id} data-testid={step.id === active.id ? 'inspection-step-content' : undefined} className={`min-w-0 space-y-6 ${step.id === 'intercambios' ? 'p-0 sm:p-6' : 'p-4 sm:p-6'} [&>section]:shadow-none [&>div]:shadow-none`}>
      {(step.id === active.id || visited.has(step.id)) && step.content}
    </section>)}
    </div>
    {editableSection && saveAction && <footer data-testid="inspection-action-bar" className={'shrink-0 rounded-b-xl border-t border-neutral-300 bg-white px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6' + (pageScroll || constrainedViewport ? ' sticky bottom-0 z-20' : '')}>{saveAction}</footer>}
  </div>;
}
