import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StepCuenta } from '../../pages/public/inscripcion/steps/StepCuenta';
import type { TipoActor } from '../../pages/public/inscripcion/shared';

const mock = vi.hoisted(() => ({ post: vi.fn(), tokens: vi.fn(), next: vi.fn() }));
vi.mock('axios', () => ({ default: { post: mock.post } }));
vi.mock('../../services/api', () => ({ setTokensDurably: mock.tokens }));
vi.mock('../../pages/public/inscripcion/RegisteredAccount', () => ({ RegisteredAccount: ({ children }: { children: React.ReactNode }) => children }));
function LoginDestination() { const l = useLocation(); return <p>Ingreso para {(l.state as { from: string }).from}</p>; }
function Account({ type }: { type: TipoActor }) {
  // Valid synthetic Argentine CUIT; enterprise builds verify its check digit before POST.
  const [reg, setReg] = useState({ nombre: 'QA persona', email: 'qa@night-qa.invalid', cuit: '20-12345678-6', password: 'OnlyLocal-NightQA-2026!', confirmPassword: 'OnlyLocal-NightQA-2026!' });
  return <StepCuenta tipoActor={type} isGenerador={type === 'GENERADOR'} isOperador={type === 'OPERADOR'} isTransportista={type === 'TRANSPORTISTA'} reg={reg} onRegChange={(key,value)=>setReg(old=>({...old,[key]:value}))} onPhase2={mock.next}/>;
}
function open(type: TipoActor = 'GENERADOR', app = false) { return render(<MemoryRouter basename={app?'/app':undefined} initialEntries={[`${app?'/app':''}/inscripcion/${type.toLowerCase()}`]}><Routes><Route path="/inscripcion/:tipo" element={<Account type={type}/>}/><Route path="/login" element={<LoginDestination/>}/></Routes></MemoryRouter>); }
beforeEach(()=>{vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mock.tokens.mockResolvedValue(undefined);});

describe('Account creation with an uncertain confirmation',()=>{
  it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'].flatMap(type=>[false,true].map(app=>[type,app] as const)))('%s app=%s offers explicit login recovery without another creation',async(type,app)=>{
    mock.post.mockRejectedValue({isAxiosError:true,response:{status:503,data:{message:'upstream unavailable'}}});
    open(type as TipoActor,app); fireEvent.click(screen.getByRole('button',{name:'Crear cuenta y continuar'}));
    const title=await screen.findByRole('heading',{name:'No pudimos confirmar el alta'});
    await waitFor(()=>expect(title).toHaveFocus());
    expect(screen.queryByRole('button',{name:'Crear cuenta y continuar'})).toBeNull();
    expect(screen.queryByText('upstream unavailable')).toBeNull();
    expect(screen.getByLabelText('Email *')).toHaveValue('qa@night-qa.invalid');
    fireEvent.click(screen.getByRole('button',{name:'Ingresar y recuperar alta'}));
    expect(screen.getByText(`Ingreso para /inscripcion/${type.toLowerCase()}`)).toBeVisible();
    expect(mock.post).toHaveBeenCalledTimes(1); expect(mock.tokens).not.toHaveBeenCalled(); expect(mock.next).not.toHaveBeenCalled();
    expect(JSON.stringify({...localStorage,...sessionStorage})).not.toContain('OnlyLocal-NightQA');
  });
  it('requires an explicit choice before retrying and retains fields',async()=>{
    mock.post.mockRejectedValue({isAxiosError:true}); open();
    fireEvent.click(screen.getByRole('button',{name:'Crear cuenta y continuar'}));
    fireEvent.click(await screen.findByRole('button',{name:'Revisar datos y reintentar'}));
    expect(mock.post).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Nombre completo *')).toHaveValue('QA persona');
    expect(screen.getByLabelText('Email *')).toHaveFocus();
    expect(screen.getByRole('button',{name:'Crear cuenta y continuar'})).toBeEnabled();
  });
  it('locks account fields while waiting and prevents double submission',async()=>{
    let finish!:(value:unknown)=>void;mock.post.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));open();
    const submit=screen.getByRole('button',{name:'Crear cuenta y continuar'});fireEvent.click(submit);fireEvent.click(submit);
    expect(mock.post).toHaveBeenCalledTimes(1);expect(screen.getByLabelText('Email *')).toBeDisabled();
    await act(async()=>finish({data:{data:{solicitudId:'qa-draft',tokens:{accessToken:'qa-access',refreshToken:'qa-refresh'}}}}));
    expect(mock.tokens).toHaveBeenCalledWith('qa-access','qa-refresh');expect(mock.next).toHaveBeenCalledWith('qa-draft');
  });
  it('keeps a known validation rejection editable and does not pretend the account was created',async()=>{
    mock.post.mockRejectedValue({isAxiosError:true,response:{status:400,data:{message:'El CUIT ya esta registrado'}}});open();fireEvent.click(screen.getByRole('button',{name:'Crear cuenta y continuar'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('El CUIT ya esta registrado');
    expect(screen.getByLabelText('Email *')).toBeEnabled();expect(screen.getByRole('button',{name:'Crear cuenta y continuar'})).toBeEnabled();
    expect(screen.queryByRole('heading',{name:'No pudimos confirmar el alta'})).toBeNull();expect(mock.next).not.toHaveBeenCalled();
  });
  it('does not recreate a confirmed application when durable session storage fails',async()=>{
    mock.post.mockResolvedValue({data:{data:{solicitudId:'qa-draft',tokens:{accessToken:'qa-access',refreshToken:'qa-refresh'}}}});mock.tokens.mockRejectedValue(new Error('private storage details'));
    open();fireEvent.click(screen.getByRole('button',{name:'Crear cuenta y continuar'}));
    expect(await screen.findByRole('heading',{name:'Recuperá el acceso al alta'})).toBeVisible();
    expect(screen.queryByRole('button',{name:'Revisar datos y reintentar'})).toBeNull();expect(screen.queryByText('private storage details')).toBeNull();expect(mock.next).not.toHaveBeenCalled();
  });
  it('ignores a late creation response after leaving the form',async()=>{
    let finish!:(value:unknown)=>void;mock.post.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const page=open();
    fireEvent.click(screen.getByRole('button',{name:'Crear cuenta y continuar'}));page.unmount();
    await act(async()=>finish({data:{data:{solicitudId:'qa-draft',tokens:{accessToken:'qa-access',refreshToken:'qa-refresh'}}}}));
    expect(mock.tokens).not.toHaveBeenCalled();expect(mock.next).not.toHaveBeenCalled();
  });
  it.each([{data:{}},{data:{data:{solicitudId:'qa-draft'}}}])('offers recovery for an incomplete successful response',async response=>{
    mock.post.mockResolvedValue(response);open();fireEvent.click(screen.getByRole('button',{name:'Crear cuenta y continuar'}));
    expect(await screen.findByRole('button',{name:'Ingresar y recuperar alta'})).toBeVisible();
    expect(mock.next).not.toHaveBeenCalled();expect(mock.tokens).not.toHaveBeenCalled();
  });

});
