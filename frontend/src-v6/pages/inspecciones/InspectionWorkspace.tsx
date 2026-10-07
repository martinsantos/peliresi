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
  saveAction?: React.ReactNode;
  onBeforeNavigate: () => boolean | void;
  resumeIdentity?: { userId: string | number; inspectionId: string };
}

const sections = [
  { label: 'Visita', ids: ['resumen', 'contexto'] },
  { label: 'Controles', ids: ['checklist', 'declaracion'] },
  { label: 'Registro', ids: ['acta', 'evidencias'] },
  { label: 'Expediente', ids: ['revision', 'informe-tecnico', 'intercambios', 'trazabilidad', 'verificacion'] },
];
const labels: Record<string, string> = {
  checklist: 'En campo', declaracion: 'Datos declarados', acta: 'Lo observado',
  evidencias: 'Fotos y archivos', revision: 'Resumen y cierre', 'informe-tecnico': 'Evaluación técnica',
  intercambios: 'Comunicaciones', trazabilidad: 'Historial', verificacion: 'Verificación',
};

/** Direct navigation. Existing deep links, drafts and file selections remain valid. */
export function InspectionWorkspace({ steps, reference, defaultStep, saveAction, onBeforeNavigate, resumeIdentity }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  const all = [...steps, ...reference];
  let hash = location.hash.slice(1);
  try { hash = decodeURIComponent(hash); } catch { /* Invalid links fall back safely. */ }
  const active = all.find((step) => step.id === hash.split('/')[0])
    || all.find((step) => step.id === defaultStep) || steps[0];
  const [visited, setVisited] = useState<Set<string>>(() => new Set([active.id]));
  if (!visited.has(active.id)) setVisited(new Set([...visited, active.id]));
  const availableSections = sections.map((section) => ({ ...section, entries: section.ids.flatMap((id) => all.filter((step) => step.id === id)) })).filter((section) => section.entries.length);
  const selectedSection = availableSections.find((section) => section.ids.includes(active.id));
  const selectedAnchor = active.anchors?.find((anchor) => anchor.id === hash.split('/').slice(1).join('/'));
  const resumeLabel = selectedAnchor ? active.label + ' · ' + selectedAnchor.label : active.label;
  const editableSection = steps.some((step) => step.id === active.id);
  const resumeUserId = resumeIdentity?.userId;
  const resumeInspectionId = resumeIdentity?.inspectionId;

  // On Android, the keyboard can pan/shrink visualViewport while h-full/dvh
  // still describe the larger layout viewport. Keep the ordinary flex footer
  // inside the visible panel; do not scroll the document or move draft fields.
  useLayoutEffect(() => {
    const workspace = workspaceRef.current, viewport = window.visualViewport;
    if (!workspace || !viewport) return;
    const measure = () => {
      const top = workspace.getBoundingClientRect().top;
      if (!Number.isFinite(top) || !Number.isFinite(viewport.height) || viewport.height <= 0 || !Number.isFinite(viewport.offsetTop)) return;
      const height = Math.max(0, Math.floor(viewport.offsetTop + viewport.height - top - 12));
      workspace.style.maxHeight = height + 'px';
    };
    measure();
    viewport.addEventListener('resize', measure, { passive: true });
    viewport.addEventListener('scroll', measure, { passive: true });
    return () => {
      viewport.removeEventListener('resize', measure);
      viewport.removeEventListener('scroll', measure);
      workspace.style.removeProperty('max-height');
    };
  }, []);

  useEffect(() => {
    if (!resumeUserId || !resumeInspectionId) return;
    saveInspectionResume(resumeUserId, resumeInspectionId, location.hash || '#' + active.id, resumeLabel);
  }, [resumeUserId, resumeInspectionId, location.hash, active.id, resumeLabel]);

  // Each section owns its reading position; the shell and tabs never scroll.
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.style.removeProperty('--inspection-scroll-reserve');
      scrollRef.current.scrollTop = scrollPositions.current.get(active.id) || 0;
    }
  }, [active.id]);

  // Remember the actual visible field, without changing browser history or
  // adding another navigation bar. This also covers manual long-list scrolling.
  useEffect(() => {
    if (!resumeUserId || !resumeInspectionId || !active.anchors?.length) return;
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
        if (point && entry) saveInspectionResume(resumeUserId, resumeInspectionId, '#' + point, active.label + ' · ' + entry.label);
      });
    };
    const region = scrollRef.current;
    region?.addEventListener('scroll', remember);
    return () => { region?.removeEventListener('scroll', remember); cancelAnimationFrame(frame); };
  }, [active.id, active.anchors, active.label, resumeUserId, resumeInspectionId]);

  const go = (event: React.MouseEvent<HTMLAnchorElement>, step: InspectionWorkspaceStep) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (onBeforeNavigate() === false) return;
    if (scrollRef.current) scrollPositions.current.set(active.id, scrollRef.current.scrollTop);
    navigate({ pathname: location.pathname, search: location.search, hash: '#' + step.id });
  };

  return <div ref={workspaceRef} data-testid="inspection-workspace" className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-neutral-200 bg-white [--inspection-middle-top:0px] [--inspection-anchor-offset:56px]">
    <div data-testid="inspection-navigation" className="sticky top-0 z-20 shrink-0 rounded-t-xl bg-white">
      <nav aria-label="Secciones del expediente" className="flex gap-1 border-b border-neutral-200 bg-neutral-100 p-2">
        {availableSections.map((section) => <a key={section.label} href={'#' + section.entries[0].id} aria-current={selectedSection === section ? 'page' : undefined} onClick={(event) => go(event, section.entries[0])}
          className={'flex min-h-14 [@media(max-height:500px)]:min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold !no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ' + (selectedSection === section ? 'bg-primary-700 text-white' : 'text-neutral-700 hover:bg-white hover:text-neutral-900')}><span aria-hidden="true" className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ' + (selectedSection === section ? 'bg-white/20 text-white' : 'bg-white text-neutral-600')}>{sections.findIndex(entry => entry.label === section.label) + 1}</span>{section.label}</a>)}
      </nav>
      {selectedSection && selectedSection.entries.length > 1 && <nav aria-label={'Apartados de ' + selectedSection.label} className="flex gap-1 overflow-x-auto border-b border-primary-200 bg-primary-50 px-2 py-1">
        {selectedSection.entries.map((step) => <a key={step.id} href={'#' + step.id} aria-current={active.id === step.id ? 'page' : undefined} onClick={(event) => go(event, step)}
          className={'flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm !no-underline focus-visible:ring-2 focus-visible:ring-primary-500 ' + (active.id === step.id ? 'border-primary-300 bg-white font-bold text-primary-900' : 'border-transparent text-neutral-700 hover:bg-white')}>{step.id === 'checklist' && <Eye size={18} aria-hidden="true" />}{step.id === 'declaracion' && <FileSearch size={18} aria-hidden="true" />}{labels[step.id] || step.label}</a>)}
      </nav>}
    </div>
    <div ref={scrollRef} data-inspection-scroll data-testid="inspection-scroll-region" className="min-h-0 flex-1 scroll-pt-14 scroll-pb-4 overflow-y-auto overscroll-contain rounded-b-xl [overflow-anchor:none] after:block after:h-[var(--inspection-scroll-reserve,0px)] after:content-['']" onScroll={(event) => { scrollPositions.current.set(active.id, event.currentTarget.scrollTop); }}>
    {active.nextAction && <div data-testid="inspection-start" className="border-b border-primary-200 bg-primary-50 p-4 sm:p-6"><h2 className="mb-1 text-lg font-bold text-primary-900">Comenzar el recorrido</h2><p className="mb-3 text-sm leading-relaxed text-neutral-800">Al iniciar se registra la hora y se abre el trabajo de campo.</p>{active.nextAction}</div>}
    {/* Hidden sections remain mounted to protect local drafts and selected files. */}
    {all.map((step) => <section key={step.id} hidden={step.id !== active.id} aria-label={step.title} id={step.id === 'verificacion' ? undefined : step.id} data-testid={step.id === active.id ? 'inspection-step-content' : undefined} className="min-w-0 space-y-6 p-4 sm:p-6 [&>section]:shadow-none [&>div]:shadow-none">
      {(step.id === active.id || visited.has(step.id)) && step.content}
    </section>)}
    </div>
    {editableSection && saveAction && <footer data-testid="inspection-action-bar" className="shrink-0 rounded-b-xl border-t border-neutral-300 bg-white px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">{saveAction}</footer>}
  </div>;
}
