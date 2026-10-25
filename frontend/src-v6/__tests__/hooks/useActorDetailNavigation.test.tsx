import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { actorEditReturn, useActorDetailNavigation } from '../../hooks/useActorDetailNavigation';

function Probe() {
  const tabs = useActorDetailNavigation(['info', 'documentos']);
  const location = useLocation();
  return <><output>{JSON.stringify({ tab: tabs.activeTab, search: location.search, state: location.state })}</output><button onClick={() => tabs.onChange('documentos')}>Documentos</button></>;
}
describe('ficha and edit continuity', () => {
  it('returns the ficha main panel to the top after leaving a long edit form', () => {
    const main = document.createElement('main'); document.body.appendChild(main); main.scrollTop = 480;
    try {
      render(<MemoryRouter><Probe /></MemoryRouter>);
      expect(main.scrollTop).toBe(0);
    } finally { main.remove(); }
  });
  it('preserves the list context while selecting a tab', () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/admin/actores/operadores/qa', state: { actorReturn: '/admin/actores/operadores?search=QA&page=2' } }]}><Probe /></MemoryRouter>);
    fireEvent.click(screen.getByText('Documentos'));
    expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ tab: 'documentos', search: '?tab=documentos', state: { actorReturn: '/admin/actores/operadores?search=QA&page=2' } });
  });
  it('never opens a tab outside the available permissions', () => {
    render(<MemoryRouter initialEntries={['/actor/qa?tab=inspecciones']}><Probe /></MemoryRouter>);
    expect(JSON.parse(screen.getByRole('status').textContent!).tab).toBe('info');
  });
  it.each(['/admin/actores/operadores', '/mobile/admin/actores/operadores'])('keeps the exact actor and surface for %s', list => {
    expect(actorEditReturn({ actorDetailReturn: list+'/qa?tab=documentos' }, list, 'qa')).toBe(list+'/qa?tab=documentos');
    for (const value of ['https://other.invalid', '//other.invalid', list+'/another', list+'/qa/editar', '/admin/actores/generadores/qa', list+'/qa\\bad']) {
      expect(actorEditReturn({ actorDetailReturn: value }, list, 'qa')).toBe(list+'/qa');
    }
    expect(actorEditReturn(null, list, 'qa')).toBe(list+'/qa');
  });
});
