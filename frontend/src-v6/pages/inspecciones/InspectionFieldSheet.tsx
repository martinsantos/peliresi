import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface InspectionFieldBlock { id: string; title: string; content: React.ReactNode }

/** The field form as one page: numbered blocks in the order of a visit, one scroll, nothing
 * moves on its own. A thin bar pinned to the top says which block is under the finger and lists
 * the others. Saving is automatic; the only button is the one that changes the stage. */
export function InspectionFieldSheet({ blocks, start, status, action }: { blocks: InspectionFieldBlock[]; start?: React.ReactNode; status: React.ReactNode; action?: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  // The block whose top has passed under the bar is the current one. Reading only; never writes scroll.
  useEffect(() => {
    const node = root.current; if (!node) return;
    const region = node.closest<HTMLElement>('[data-inspection-page-scroll]') || window;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bar = node.querySelector<HTMLElement>('[data-sheet-bar]');
      const edge = (bar?.getBoundingClientRect().bottom ?? 0) + 8;
      const sections = Array.from(node.querySelectorAll<HTMLElement>('[data-sheet-block]'));
      let index = 0;
      sections.forEach((section, i) => { if (section.getBoundingClientRect().top <= edge) index = i; });
      setCurrent(index);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    region.addEventListener('scroll', schedule, { passive: true });
    return () => { region.removeEventListener('scroll', schedule); cancelAnimationFrame(frame); };
  }, [blocks.length]);
  const jump = (id: string) => { setOpen(false); document.getElementById(id)?.scrollIntoView?.({ block: 'start' }); };
  return <div ref={root} data-testid="inspection-field-sheet" className="inspection-field-sheet mx-auto w-full max-w-3xl min-w-0 [--inspection-anchor-offset:56px]">
    <nav data-sheet-bar aria-label="Dónde estoy en el formulario" className="sticky top-0 z-20 -mx-3 mb-3 border-b border-neutral-300 bg-white px-3 sm:mx-0 sm:rounded-b-lg">
      <button type="button" aria-expanded={open} aria-controls="field-sheet-blocks" onClick={() => setOpen(value => !value)} className="flex min-h-12 w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0 truncate text-sm font-bold text-neutral-900"><span className="text-primary-800">{current + 1}</span> · {blocks[current]?.title}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-neutral-600">{current + 1} de {blocks.length}<ChevronDown size={16} aria-hidden="true" className={open ? 'rotate-180' : ''} /></span>
      </button>
      {open && <ol id="field-sheet-blocks" className="border-t border-neutral-200 py-2">{blocks.map((block, index) => <li key={block.id}><button type="button" aria-current={index === current ? 'location' : undefined} onClick={() => jump(block.id)} className={`flex min-h-11 w-full items-center gap-2 text-left text-sm ${index === current ? 'font-bold text-primary-900' : 'text-neutral-800'}`}><span className="w-5 text-primary-800">{index + 1}</span>{block.title}</button></li>)}</ol>}
    </nav>
    {start && <div data-testid="inspection-start" className="mb-4 rounded-xl border border-primary-200 bg-primary-50 p-4">{start}</div>}
    <ol className="space-y-4">
      {blocks.map((block, index) => <li key={block.id}>
        <section id={block.id} data-sheet-block aria-labelledby={'field-block-' + block.id} style={{ scrollMarginTop: '56px' }} className="min-w-0 rounded-xl border border-neutral-300 bg-white p-4 sm:p-6 [&>section]:shadow-none [&>div]:shadow-none">
          <h2 id={'field-block-' + block.id} className="mb-4 flex items-baseline gap-2 text-xl font-bold text-neutral-900"><span aria-hidden="true" className="text-primary-800">{index + 1}.</span>{block.title}</h2>
          <div className="space-y-6">{block.content}</div>
        </section>
      </li>)}
    </ol>
    <footer data-testid="inspection-field-footer" className="mt-6 space-y-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="text-sm text-neutral-700">{status}</div>
      {action}
    </footer>
  </div>;
}
