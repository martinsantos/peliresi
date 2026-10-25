import { Button } from '../ui/ButtonV2';

export function ReviewPagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return <nav aria-label="Páginas de resultados" className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 text-sm">
    <p role="status">{total} {total === 1 ? 'resultado' : 'resultados'} · Página {page} de {Math.max(1, pages)}</p>
    <div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button><Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</Button></div>
  </nav>;
}
