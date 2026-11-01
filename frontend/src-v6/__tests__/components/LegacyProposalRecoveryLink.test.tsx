import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  user: { id: 'user', rol: 'GENERADOR', actorId: 'actor', training: false } as { id: string; rol: string; actorId?: string; training: boolean } | null,
  restricted: false,
  temporary: false,
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: session.user, isRestricted: session.restricted }) }));
vi.mock('../../contexts/ImpersonationContext', () => ({ useImpersonation: () => ({ impersonationData: session.temporary ? {} : null }) }));

import { LegacyProposalRecoveryLink } from '../../pages/manifiestos/components/LegacyProposalRecoveryLink';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{JSON.stringify({ path: location.pathname, state: location.state })}</output>;
}
function mount(id = 'qa-legacy', prefix = '', state: unknown = { manifestListReturn: '/manifiestos?estado=APROBADO' }) {
  return render(<MemoryRouter initialEntries={[{ pathname: `${prefix}/manifiestos/${id}`, state }]}>
    <LegacyProposalRecoveryLink manifestId={id} /><LocationProbe />
  </MemoryRouter>);
}
afterEach(() => {
  vi.unstubAllEnvs();
  session.user = { id: 'user', rol: 'GENERADOR', actorId: 'actor', training: false };
  session.restricted = false; session.temporary = false;
});

describe('navigation from a prior manifest to a new proposal', () => {
  it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN'])('offers the form to an eligible %s when proposals are enabled', role => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true'); session.user!.rol = role;
    mount();
    expect(screen.getByRole('link', { name: 'Abrir nueva propuesta' })).toHaveAttribute('href', '/manifiestos/nuevo');
  });

  it('preserves the source and validated list return without carrying manifest fields into the form', async () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true');
    mount();
    fireEvent.click(screen.getByRole('link', { name: 'Abrir nueva propuesta' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('"path":"/manifiestos/nuevo"');
    expect(screen.getByTestId('location')).toHaveTextContent('"manifestPreviousId":"qa-legacy"');
    expect(screen.getByTestId('location')).toHaveTextContent('"manifestListReturn":"/manifiestos?estado=APROBADO"');
    expect(screen.getByTestId('location')).not.toHaveTextContent('residuos');
  });

  it('keeps the mobile route and home origin on the same surface', async () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true');
    mount('qa-legacy', '/mobile', { manifestHomeReturn: '/mobile/dashboard?filtro=espera' });
    const link = screen.getByRole('link', { name: 'Abrir nueva propuesta' });
    expect(link).toHaveAttribute('href', '/mobile/manifiestos/nuevo');
    fireEvent.click(link);
    expect(await screen.findByTestId('location')).toHaveTextContent('"manifestHomeReturn":"/mobile/dashboard?filtro=espera"');
  });

  it('uses the app basename without sending the user to the desktop route', async () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'true');
    render(<MemoryRouter basename="/app" initialEntries={[{ pathname: '/app/manifiestos/qa-legacy', state: { manifestHomeReturn: '/dashboard?filtro=espera' } }]}>
      <LegacyProposalRecoveryLink manifestId="qa-legacy" /><LocationProbe />
    </MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Abrir nueva propuesta' });
    expect(link).toHaveAttribute('href', '/app/manifiestos/nuevo');
    fireEvent.click(link);
    expect(await screen.findByTestId('location')).toHaveTextContent('"path":"/manifiestos/nuevo"');
    expect(screen.getByTestId('location')).toHaveTextContent('"manifestHomeReturn":"/dashboard?filtro=espera"');
  });

  it.each(['closed', 'restricted', 'temporary', 'other-role', 'no-actor', 'invalid-id'])('does not offer a misleading creation link: %s', scenario => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', scenario === 'closed' ? 'false' : 'true');
    if (scenario === 'restricted') session.restricted = true;
    if (scenario === 'temporary') session.temporary = true;
    if (scenario === 'other-role') session.user!.rol = 'AUDITOR';
    if (scenario === 'no-actor') session.user!.actorId = undefined;
    mount(scenario === 'invalid-id' ? '../otro' : 'qa-legacy');
    expect(screen.queryByRole('link', { name: 'Abrir nueva propuesta' })).not.toBeInTheDocument();
  });

  it('does not offer creation from a temporary training view either', () => {
    session.temporary = true; session.user!.training = true;
    mount();
    expect(screen.queryByRole('link', { name: 'Abrir nueva propuesta' })).not.toBeInTheDocument();
  });

  it('offers the link in an identified training session even when the operational flag is off', () => {
    vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED', 'false'); session.user!.training = true;
    mount();
    expect(screen.getByRole('link', { name: 'Abrir nueva propuesta' })).toHaveAttribute('href', '/manifiestos/nuevo');
  });
});
