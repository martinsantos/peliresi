import React from 'react';

export interface InspectionFieldBlock { id: string; title: string; content: React.ReactNode }

/** The field form as one page: numbered blocks in the order of a visit, one scroll, nothing
 * moves on its own. Saving is automatic; the only button is the one that changes the stage. */
export function InspectionFieldSheet({ blocks, start, status, action }: { blocks: InspectionFieldBlock[]; start?: React.ReactNode; status: React.ReactNode; action?: React.ReactNode }) {
  return <div data-testid="inspection-field-sheet" className="mx-auto w-full max-w-3xl min-w-0 [--inspection-anchor-offset:12px]">
    {start && <div data-testid="inspection-start" className="mb-4 rounded-xl border border-primary-200 bg-primary-50 p-4">{start}</div>}
    <ol className="space-y-4">
      {blocks.map((block, index) => <li key={block.id}>
        <section id={block.id} aria-labelledby={'field-block-' + block.id} className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6 [&>section]:shadow-none [&>div]:shadow-none">
          <h2 id={'field-block-' + block.id} className="mb-4 flex items-baseline gap-2 text-lg font-bold text-neutral-900"><span aria-hidden="true" className="text-primary-800">{index + 1}.</span>{block.title}</h2>
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
