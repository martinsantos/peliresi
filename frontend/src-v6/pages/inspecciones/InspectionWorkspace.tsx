import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saveInspectionResume } from '../../services/inspectionResume';
import { ArrowLeft, ArrowRight, ChevronDown, FolderOpen } from 'lucide-react';
import { inspectionJourney, inspectionTaskLabel } from './inspectionJourney';

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
  continuationManaged?: boolean;
  saveAction?: React.ReactNode;
  onBeforeNavigate: () => boolean | void;
  resumeIdentity?: { userId: string | number; inspectionId: string; owner: string };
}

/** Direct navigation. Existing deep links, drafts and file selections remain valid. */
export function InspectionWorkspace({ steps, reference, guided, defaultStep, saveAction, onBeforeNavigate, resumeIdentity, pageScroll = false, continuationManaged = false }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [constrainedViewport, setConstrainedViewport] = useState(false);
  const scrollPositions = useRef(new Map<string, number>());
  const orderedIds = inspectionJourney.flatMap(section => section.ids);
  const all = [...steps, ...reference].sort((a, b) => {
    const ai = orderedIds.indexOf(a.id), bi = orderedIds.indexOf(b.id);
    return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
  });
  let hash = location.hash.slice(1);
  try { hash = decodeURIComponent(hash); } catch { /* Invalid links fall back safely. */ }
  const active = all.find((step) => step.id === hash.split('/')[0])
    || all.find((step) => step.id === defaultStep) || steps[0];
  const scrollStepRef = useRef(active.id);
  const [visited, setVisited] = useState<Set<string>>(() => new Set([active.id]));
  if (!visited.has(active.id)) setVisited(new Set([...visited, active.id]));
  const availableSections = inspectionJourney.map((section) => ({ ...section, entries: section.ids.flatMap((id) => all.filter((step) => step.id === id)) })).filter((section) => section.entries.length);
  const supplemental = all.filter(step => !inspectionJourney.some(section => section.ids.includes(step.id)));
  const selectedSection = availableSections.find((section) => section.ids.includes(active.id));
  const continuous = Boolean(selectedSection?.continuous);
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
    if (!workspace || !viewport || pageScroll) return;
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

  // In a continuous section every task is already open: a hash change scrolls to its heading.
  const previousActive = useRef(active.id);
  useEffect(() => {
    const changed = previousActive.current !== active.id; previousActive.current = active.id;
    if (!continuous || !changed || location.hash.includes('/')) return;
    const heading = document.getElementById('inspection-task-heading-' + active.id);
    if (heading && typeof heading.scrollIntoView === 'function') heading.scrollIntoView({ block: 'start' });
  }, [active.id, continuous, location.hash]);
  const go = (event: React.MouseEvent<HTMLAnchorElement>, step: InspectionWorkspaceStep) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (onBeforeNavigate() === false) return;
    if (scrollRef.current) scrollPositions.current.set(active.id, scrollRef.current.scrollTop);
    navigate({ pathname: location.pathname, search: location.search, hash: '#' + step.id });
  };

  return <div ref={workspaceRef} data-testid="inspection-workspace" data-inspection-scroll={!pageScroll && constrainedViewport ? '' : undefined} data-constrained-viewport={constrainedViewport || undefined} className={(pageScroll ? 'shrink-0 ' : 'h-full ') + 'flex min-h-0 min-w-0 flex-col rounded-xl border border-neutral-200 bg-white [--inspection-middle-top:0px] [--inspection-anchor-offset:56px]' + (!pageScroll && constrainedViewport ? ' overflow-y-auto overscroll-contain [overflow-anchor:none]' : '')} onScroll={(event) => { if (!pageScroll && constrainedViewport && event.target === event.currentTarget) scrollPositions.current.set(active.id, event.currentTarget.scrollTop); }}>
    <div data-testid="inspection-navigation" className="relative shrink-0 rounded-t-xl bg-white">
      <nav aria-label="Secciones del expediente" className="grid grid-cols-4 gap-1 border-b border-neutral-200 p-2">
        {availableSections.map(section => <a key={section.label} aria-label={section.label} href={'#' + section.entries[0].id} aria-current={selectedSection === section ? 'step' : undefined} onClick={event => go(event, section.entries[0])}
          className={'flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-1 py-1.5 text-xs font-semibold !no-underline focus-visible:ring-2 focus-visible:ring-primary-500 sm:px-4 sm:text-sm ' + (selectedSection === section ? 'bg-primary-700 text-white hover:text-white' : 'text-neutral-600 hover:bg-neutral-100')}>
          <span aria-hidden="true" className="hidden sm:inline">{inspectionJourney.indexOf(inspectionJourney.find(entry => entry.label === section.label)!) + 1}.</span>
          <span className="text-center leading-4 sm:hidden">{section.mobileLabel}</span><span className="hidden sm:inline">{section.label}</span>
        </a>)}
      </nav>
      {/* One line on a phone: the step tabs already say where the person is. */}
      <div className="px-4 py-2.5 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-baseline gap-x-2"><p className="text-xs font-medium text-primary-800">{guided && selectedSection ? 'Paso ' + (inspectionJourney.findIndex(section => section.label === selectedSection.label) + 1) + ' de 4' : 'Consulta del expediente'}</p><h2 className="text-lg font-bold text-neutral-900 sm:text-xl">{guided ? selectedSection?.title || active.title : active.title}</h2></div>
        <p className="mt-1 hidden text-sm leading-relaxed text-neutral-600 sm:block">{guided ? selectedSection?.description || active.description : active.description}</p>
      </div>
    </div>
    <div ref={contentRef} data-inspection-scroll={pageScroll || constrainedViewport ? undefined : ''} data-testid="inspection-scroll-region" className={`min-h-0 scroll-pt-4 scroll-pb-4 rounded-b-xl [overflow-anchor:none] ${pageScroll || constrainedViewport ? 'shrink-0 overflow-visible' : 'flex-1 overflow-y-auto overscroll-contain'}`} onScroll={event => { if (!pageScroll && !constrainedViewport && event.target === event.currentTarget) scrollPositions.current.set(active.id, event.currentTarget.scrollTop); }}>
      {active.nextAction && <div data-testid="inspection-start" className="mx-4 mb-4 rounded-lg border border-primary-200 bg-primary-50 p-4 sm:mx-6"><p className="mb-3 text-sm">Iniciá la visita para registrar el trabajo en campo.</p>{active.nextAction}</div>}
      {/* One task expands at a time. Visited forms stay mounted, including file selections. */}
      {all.map(step => {
        const inGroup = selectedSection?.ids.includes(step.id);
        const visible = inGroup || step.id === active.id;
        const expanded = (continuous && inGroup) || step.id === active.id;
        return <div key={step.id} hidden={!visible} className="mb-3 min-w-0 border-y border-neutral-200 sm:mx-6 sm:rounded-lg sm:border">
          {selectedSection && selectedSection.entries.length > 1 && continuous && <h3 id={'inspection-task-heading-' + step.id} className="flex min-h-12 items-end justify-between gap-3 rounded-t-lg px-4 pb-2 pt-4 text-base font-bold"><a href={'#' + step.id} onClick={event => go(event, step)} aria-current={step.id === active.id ? 'location' : undefined} className={'min-w-0 !no-underline ' + (step.id === active.id ? 'text-primary-900' : 'text-neutral-900')}>{inspectionTaskLabel(step)}{step.detail && <span className="mt-0.5 block text-xs font-normal text-neutral-600">{step.detail}</span>}</a></h3>}
          {selectedSection && selectedSection.entries.length > 1 && !continuous && <a href={'#' + step.id} onClick={event => go(event, step)} aria-expanded={expanded} aria-controls={'inspection-task-' + step.id} className={'flex min-h-14 items-center justify-between gap-3 rounded-t-lg px-4 py-3 !no-underline focus-visible:ring-2 focus-visible:ring-primary-500 ' + (expanded ? 'bg-primary-50 text-primary-900' : 'text-neutral-800 hover:bg-neutral-50')}>
            <span className="min-w-0"><span className="block text-sm font-bold">{inspectionTaskLabel(step)}</span>{step.detail && <span className="mt-0.5 block text-xs font-normal text-neutral-600">{step.detail}</span>}</span>
            <ChevronDown size={18} aria-hidden="true" className={'shrink-0 ' + (expanded ? 'rotate-180' : '')} />
          </a>}
          <div id={'inspection-task-' + step.id} hidden={!expanded}>
            <section aria-label={step.title} id={step.id === 'verificacion' ? undefined : step.id} data-testid={step.id === active.id ? 'inspection-step-content' : undefined} className="min-w-0 space-y-6 p-4 sm:p-6 [&>section]:shadow-none [&>div]:shadow-none">
              {(expanded || visited.has(step.id)) && step.content}
            </section>
          </div>
        </div>;
      })}
      {!continuationManaged && (() => {
        const ordered = availableSections.flatMap(section => section.entries);
        const index = ordered.findIndex(step => step.id === active.id);
        if (index < 0) return null;
        const previous = ordered[index - 1], next = ordered[index + 1];
        return <nav aria-label="Continuar el recorrido" className="flex flex-wrap justify-between gap-3 border-t border-neutral-200 p-4">
          {previous && <a href={'#' + previous.id} onClick={event => go(event, previous)} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold !no-underline"><ArrowLeft size={16} />{inspectionTaskLabel(previous)}</a>}
          {next && <a href={'#' + next.id} onClick={event => go(event, next)} className="ml-auto flex min-h-11 items-center gap-2 rounded-lg bg-primary-700 px-3 py-2 text-sm font-semibold text-white !no-underline">Continuar: {inspectionTaskLabel(next)}<ArrowRight size={16} /></a>}
        </nav>;
      })()}
      {supplemental.length > 0 && <details open={!selectedSection || undefined} className="border-t border-neutral-200 px-4 py-2 sm:px-6">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700"><FolderOpen size={18} />Expediente y seguimiento<ChevronDown size={16} className="ml-auto" /></summary>
        <nav aria-label="Expediente y seguimiento" className="grid gap-2 pb-3 sm:grid-cols-2">
          {supplemental.map(step => <a key={step.id} href={'#' + step.id} onClick={event => go(event, step)} aria-current={active.id === step.id ? 'page' : undefined} className="flex min-h-11 items-center rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-primary-800 !no-underline">{inspectionTaskLabel(step)}</a>)}
        </nav>
      </details>}
    </div>
    {editableSection && saveAction && <footer data-testid="inspection-action-bar" className="shrink-0 rounded-b-xl border-t border-neutral-300 bg-white px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">{saveAction}</footer>}
  </div>;
}
