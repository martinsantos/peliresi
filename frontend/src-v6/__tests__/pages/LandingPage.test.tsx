import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from '../../pages/auth/LandingPage';
import { SitrepMark } from '../../components/SitrepMark';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));

describe('public landing identity and entry points', () => {
  it('names the system in the main title and uses both institutional brands', () => {
    const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SITREPSistema de trazabilidad de residuos peligrosos');
    expect(container.querySelector('header [data-sitrep-mark]')).toHaveAttribute('src', '/sitrep-mark-green.svg');
    expect(screen.getByAltText('Mendoza — Gobierno de la Provincia')).toHaveAttribute('src', '/logo-mendoza.webp');
  });

  it('preserves real enrollment, review, login and installation destinations', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Ingresar', exact: true })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Iniciar sesión', exact: true })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Solicitar inscripción', exact: true })).toHaveAttribute('href', '#perfiles');
    expect(screen.getByRole('link', { name: 'Instalar App', exact: true })).toHaveAttribute('href', '#instalar');
    for (const tipo of ['generador', 'transportista', 'operador']) {
      expect(document.querySelector(`a[href="/inscripcion/${tipo}"]`)).not.toBeNull();
      expect(document.querySelector(`a[href="/inscripcion/${tipo}?modo=revision"]`)).not.toBeNull();
    }
  });

  it('retains the existing tiled appearance everywhere that does not opt in', () => {
    const { container } = render(<SitrepMark size={24} />);
    expect(container.firstChild).toHaveAttribute('src', '/favicon.svg');
    expect(container.firstChild).toHaveAttribute('width', '24');
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('reuses the exact approved three-arrow geometry without a background square', () => {
    const original = new DOMParser().parseFromString(readFileSync('public/favicon.svg', 'utf8'), 'image/svg+xml');
    const green = new DOMParser().parseFromString(readFileSync('public/sitrep-mark-green.svg', 'utf8'), 'image/svg+xml');
    const paths = (doc: Document) => [...doc.querySelectorAll('path')].map(p => [p.getAttribute('d'), p.getAttribute('transform')]);
    expect(paths(green)).toHaveLength(3);
    expect(paths(green)).toEqual(paths(original));
    expect(green.querySelector('rect, image, script')).toBeNull();
    expect(green.querySelector('g')).toHaveAttribute('fill', '#1B5E3C');
  });
});
