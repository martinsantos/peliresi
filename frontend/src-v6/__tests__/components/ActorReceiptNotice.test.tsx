import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ get:vi.fn(), download:vi.fn(), role:'OPERADOR', actorId:'actor-1' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser:{ id:'owner', rol:mock.role, actorId:mock.actorId } }) }));
vi.mock('../../services/api', () => ({ default:{ get:mock.get } }));
vi.mock('../../services/generador-fiscal.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/generador-fiscal.service')>();
  return { ...actual, generadorFiscalService:{ ...actual.generadorFiscalService, downloadDocumento:mock.download } };
});
import { ActorReceiptNotice } from '../../components/ActorReceiptNotice';
const receipt = { id:'doc-1', tipo:'COMPROBANTE_PAGO', nombre:'Pago artificial.pdf', estado:'PENDIENTE', analisis:{duplicado:true}, observaciones:null };
function open(id='doc-1', type:'GENERADOR'|'TRANSPORTISTA'|'OPERADOR'='OPERADOR') {
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  return render(<QueryClientProvider client={client}><MemoryRouter><ActorReceiptNotice type={type} actorId="actor-1" documentId={id} visitKey="visit-1" returnPath="/notificaciones/n1" /></MemoryRouter></QueryClientProvider>);
}
beforeEach(()=>{vi.clearAllMocks();mock.role='OPERADOR';mock.actorId='actor-1';mock.get.mockResolvedValue({data:{data:{documentos:[receipt]}}});mock.download.mockResolvedValue(undefined);});
it.each([['GENERADOR','generadores','Generador'],['TRANSPORTISTA','transportistas','Transportista'],['OPERADOR','operadores','Operador']] as const)('locates the authorized receipt in %s without downloading it',async(type,route,label)=>{
  mock.role=type;open('doc-1',type);
  const panel=await screen.findByRole('region',{name:'Comprobante del aviso'});
  await screen.findByText('Pago artificial.pdf');
  expect(panel).toHaveFocus();expect(panel).toHaveTextContent('Actividad: '+label);
  expect(screen.getByRole('link',{name:'Volver al aviso'})).toHaveAttribute('href','/notificaciones/n1');
  expect(panel).toHaveTextContent('no acredita un pago nuevo');expect(panel).toHaveTextContent('Pendiente de revisión');
  expect(mock.get).toHaveBeenCalledWith(`/actores/${route}/actor-1/documentos`);expect(mock.download).not.toHaveBeenCalled();
});
it('does not display another document when the target is absent or is another type',async()=>{
  mock.get.mockResolvedValue({data:{data:{documentos:[{...receipt,id:'other'}, {...receipt,id:'doc-1',tipo:'OTRO'}]}}});open();
  expect(await screen.findByText(/El comprobante del aviso no está disponible en esta ficha/)).toBeVisible();
  expect(screen.queryByText('Pago artificial.pdf')).toBeNull();expect(screen.queryByRole('button',{name:'Descargar comprobante'})).toBeNull();
});
it('offers retry after a failed read without presenting an empty or cached result',async()=>{
  mock.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({data:{data:{documentos:[receipt]}}});open();
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar el comprobante');
  expect(screen.queryByText('Pago artificial.pdf')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Reintentar documentos'}));
  expect(await screen.findByText('Pago artificial.pdf')).toBeVisible();
});
it('downloads the selected original once and keeps failures retryable',async()=>{
  mock.download.mockRejectedValueOnce(new Error('offline'));open();
  fireEvent.click(await screen.findByRole('button',{name:'Descargar comprobante'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos descargar');
  fireEvent.click(screen.getByRole('button',{name:'Descargar comprobante'}));
  await waitFor(()=>expect(mock.download).toHaveBeenCalledTimes(2));
  expect(mock.download).toHaveBeenLastCalledWith('doc-1','Pago artificial.pdf');
});
it('does not assert a duplicate when the current analysis does not confirm one',async()=>{
  mock.get.mockResolvedValue({data:{data:{documentos:[{...receipt,analisis:null}]}}});open();
  expect(await screen.findByText(/El aviso identifica este archivo/)).toBeVisible();
  expect(screen.queryByText(/La huella coincide/)).toBeNull();
});
