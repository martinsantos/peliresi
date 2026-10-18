import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdministrativeTEF } from '../../components/AdministrativeTEF';
import { tefDeclaredInputs } from '../../utils/tefDeclaredInputs';
import { DEFAULT_A } from '../../utils/calculoTEF';

const auth = vi.hoisted(() => ({ rol: 'ADMIN' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { rol: auth.rol } }) }));
const props = { actorType: 'GENERADOR', identity: 'qa-one', declaration: { tefPersonal: '32', tefPotencia: '120', tefSuperficie: '1250', tefZona: 'zona_industrial' }, corrientesY: ['Y8'], tieneISO: false };

describe('TEF belongs to administrative evaluation, not the public applicant', () => {
  it.each(['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR', 'ADMIN_TRANSPORTISTA'])('%s can inspect declared magnitudes without saving a fiscal amount', rol => {
    auth.rol = rol;
    render(<AdministrativeTEF {...props} />);
    const details = screen.getByTestId('tef-admin-review');
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Evaluación TEF · Administración'));
    expect(details).toHaveAttribute('open');
    expect(screen.getByLabelText('Cantidad de Personal')).toHaveValue(32);
    expect(screen.getByLabelText('Potencia Instalada en HP')).toHaveValue(120);
    expect(screen.getByLabelText('Superficie Cubierta en M2')).toHaveValue(1250);
    expect(screen.getByText(/no guardan un importe, no emiten una liquidación/)).toBeVisible();
    fireEvent.click(screen.getByText('Evaluación TEF · Administración'));
    expect(details).not.toHaveAttribute('open');
  });
  it.each(['GENERADOR', 'OPERADOR', 'TRANSPORTISTA', 'INSPECTOR', 'AUDITOR', 'CANDIDATO'])('%s is never offered the administrative calculator', rol => {
    auth.rol = rol; render(<AdministrativeTEF {...props} />);
    expect(screen.queryByTestId('tef-calculator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tef-admin-review')).not.toBeInTheDocument();
  });
  it('does not invent a TEF for transport registration', () => {
    auth.rol = 'ADMIN'; render(<AdministrativeTEF {...props} actorType="TRANSPORTISTA" />);
    expect(screen.queryByTestId('tef-admin-review')).not.toBeInTheDocument();
  });
  it('exposes absent data instead of presenting a zero as a determined tax', () => {
    auth.rol = 'ADMIN'; render(<AdministrativeTEF {...props} actorType="OPERADOR" declaration={{}} />);
    expect(screen.getByText(/Datos no declarados: personal, potencia instalada, superficie, zona/)).toHaveTextContent('no es una tasa determinada');
  });
  it('preserves explicit zeros and current declarations over old calculator inputs', () => {
    const result = tefDeclaredInputs({ ...props.declaration, tefPersonal: '0', tefInputs: JSON.stringify({ personal: 999, potenciaHP: 999, superficieM2: 999, zona: 'zona_urbana', coefA: { a1_stock: 0.25 } }) });
    expect(result.missing).toEqual([]);
    expect(result.inputs).toMatchObject({ personal: 0, potenciaHP: 120, superficieM2: 1250, zona: 'zona_industrial', coefA: { a1_stock: 0.25 } });
  });
  it('reads stored actor input JSON without recalculating or trusting an arbitrary fiscal amount', () => {
    expect(tefDeclaredInputs({ tefInputs: { personal: 18, potenciaHP: 400, superficieM2: 1800, zona: 'zona_rural', coefA: { a1_stock: 0.5 } }, factorR: 999999, montoMxR: 999999 }).inputs).toEqual({ personal: 18, potenciaHP: 400, superficieM2: 1800, zona: 'zona_rural', coefA: { ...DEFAULT_A, a1_stock: 0.5 } });
  });
  it('rejects malformed or negative declarations and unrecognized coefficient values', () => {
    const result = tefDeclaredInputs({ tefInputs: '{bad', tefPersonal: '-1', tefPotencia: 'NaN', tefSuperficie: true, tefZona: 'not-a-zone', coefA: { a1_stock: 99 } });
    expect(result.missing).toHaveLength(4);
    expect(result.inputs).toMatchObject({ personal: 0, potenciaHP: 0, superficieM2: 0, coefA: DEFAULT_A });
  });
});
