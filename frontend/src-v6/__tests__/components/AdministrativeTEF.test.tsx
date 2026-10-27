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
  it('keeps a local simulation on identical refetches and asks before replacing it with corrected declarations', () => {
    auth.rol='ADMIN';const view=render(<AdministrativeTEF {...props} />);
    fireEvent.click(screen.getByText('Evaluación TEF · Administración'));
    fireEvent.change(screen.getByLabelText('Potencia Instalada en HP'),{target:{value:'130'}});
    view.rerender(<AdministrativeTEF {...props} declaration={{...props.declaration}} />);
    expect(screen.getByLabelText('Potencia Instalada en HP')).toHaveValue(130);
    expect(screen.queryByText('La declaración cambió.')).toBeNull();
    view.rerender(<AdministrativeTEF {...props} declaration={{...props.declaration,tefPotencia:'150'}} corrientesY={['Y12']} />);
    expect(screen.getByText('La declaración cambió.')).toBeVisible();
    expect(screen.getByLabelText('Potencia Instalada en HP')).toBeDisabled();
    expect(screen.getByLabelText('Potencia Instalada en HP')).toHaveValue(130);
    fireEvent.click(screen.getByRole('button',{name:'Usar declaración actualizada'}));
    expect(screen.getByLabelText('Potencia Instalada en HP')).toHaveValue(150);
    expect(screen.getByLabelText('Potencia Instalada en HP')).toBeEnabled();
    expect(screen.queryByText('La declaración cambió.')).toBeNull();
  });
  it('explicitly retains the earlier simulation and asks again when another declaration arrives', () => {
    auth.rol='ADMIN';const view=render(<AdministrativeTEF {...props} />);
    fireEvent.click(screen.getByText('Evaluación TEF · Administración'));
    fireEvent.change(screen.getByLabelText('Cantidad de Personal'),{target:{value:'35'}});
    view.rerender(<AdministrativeTEF {...props} declaration={{...props.declaration,tefPersonal:'50'}} />);
    fireEvent.click(screen.getByRole('button',{name:'Conservar mis ajustes'}));
    expect(screen.getByText(/Revisión basada en la declaración anterior/)).toBeVisible();
    expect(screen.getByLabelText('Cantidad de Personal')).toHaveValue(35);
    expect(screen.getByLabelText('Cantidad de Personal')).toBeEnabled();
    view.rerender(<AdministrativeTEF {...props} declaration={{...props.declaration,tefPersonal:'60'}} />);
    expect(screen.getByText('La declaración cambió.')).toBeVisible();
    view.rerender(<AdministrativeTEF {...props} identity="qa-other" declaration={{...props.declaration,tefPersonal:'10'}} />);
    fireEvent.click(screen.getByText('Evaluación TEF · Administración'));
    expect(screen.getByLabelText('Cantidad de Personal')).toHaveValue(10);
    expect(screen.queryByText(/Revisión basada en la declaración anterior/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Cantidad de Personal'),{target:{value:'77'}});
    auth.rol='ADMIN_GENERADOR';view.rerender(<AdministrativeTEF {...props} identity="qa-other" declaration={{...props.declaration,tefPersonal:'10'}} />);
    fireEvent.click(screen.getByText('Evaluación TEF · Administración'));
    expect(screen.getByLabelText('Cantidad de Personal')).toHaveValue(10);
  });
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
    expect(screen.getByText(/no guardan datos ni modifican la liquidación/)).toBeVisible();
    expect(screen.getByText(/El cálculo está en revisión/)).toBeVisible();
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
