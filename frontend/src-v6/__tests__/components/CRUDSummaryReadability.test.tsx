import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Factory } from 'lucide-react';
import { GenericCRUDPage } from '../../components/crud/GenericCRUDPage';

const stats = [
  { label: 'Resultados', value: 52, icon: <Factory size={20} />, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  { label: 'TEF sin pago 2026', value: 0, icon: <Factory size={20} />, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
];
function page() {
  return <MemoryRouter><GenericCRUDPage
    title="QA Generadores" subtitle="QA sintético" icon={<Factory />} iconBg="bg-purple-100"
    data={[]} isLoading={false} isError={false} columns={[]} getRowKey={row => row.id}
    searchValue="" onSearchChange={vi.fn()} stats={stats}
    pagination={{ currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 20, onPageChange: vi.fn() }}
  /></MemoryRouter>;
}
function cardFor(element: Element): Element {
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.classList.contains('rounded-[12px]')) return ancestor;
  }
  throw new Error('The actual summary/filter card is missing');
}

describe('CRUD summaries remain readable in narrow cards', () => {
  it('allows the full fiscal scope and year to wrap without replacing zero', () => {
    render(page());
    const label = screen.getByText('TEF sin pago 2026');
    expect(label).toHaveClass('whitespace-normal', 'break-words');
    expect(label.parentElement).toHaveTextContent('0');
    expect(label.parentElement).toHaveClass('min-w-0');
  });

  it('uses only one padding owner in each summary', () => {
    render(page());
    expect(cardFor(screen.getByText('Resultados'))).toHaveClass('p-0');
    expect(cardFor(screen.getByText('TEF sin pago 2026'))).toHaveClass('p-0');
  });

  it('does not double the padding around the search and filters', () => {
    render(page());
    expect(cardFor(screen.getByPlaceholderText('Buscar...'))).toHaveClass('p-0');
  });
});
