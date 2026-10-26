import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const download=vi.hoisted(()=>vi.fn());
vi.mock('../../services/solicitud.service',()=>({solicitudService:{downloadDocumento:download}}));
import { ApplicantDocuments } from '../../components/registration/ApplicantDocuments';
const docs=[{id:'rejected',nombre:'Factura completa.png',estado:'RECHAZADO' as const,observaciones:'Falta la página del suministro.'},{id:'approved',nombre:'Constancia.pdf',estado:'APROBADO' as const}];
afterEach(()=>{cleanup();vi.clearAllMocks();});
const open=()=>fireEvent.click(screen.getByRole('button',{name:/Documentos presentados/}));
it('keeps the summary compact and reveals file-specific decisions and notes',()=>{
 render(<ApplicantDocuments applicationId="s" documents={docs} fresh onRetry={()=>{}} />);
 expect(screen.getByText(/1 documento rechazado/)).toBeVisible();expect(screen.queryByText('Falta la página del suministro.')).toBeNull();open();
 expect(screen.getByText('Documento rechazado')).toBeVisible();expect(screen.getByText('Documento aprobado')).toBeVisible();expect(screen.getByText(/Falta la página del suministro/)).toBeVisible();expect(download).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:'Reemplazar'})).toBeNull();
});
it('downloads the chosen original and keeps a failed download retryable',async()=>{
 download.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
 render(<ApplicantDocuments applicationId="own" documents={docs} fresh onRetry={()=>{}} />);open();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Descargar original Factura completa.png'}));});
 expect(screen.getByRole('alert')).toHaveTextContent('No pudimos descargar');
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Descargar original Factura completa.png'}));});
 expect(download).toHaveBeenLastCalledWith('own',docs[0]);expect(screen.queryByRole('alert')).toBeNull();expect(screen.getByText('Documento rechazado')).toBeVisible();
});
it('does not present cached decisions as current while a read is unverified',()=>{
 const retry=vi.fn();render(<ApplicantDocuments applicationId="s" documents={docs} fresh={false} onRetry={retry} />);open();
 expect(screen.queryByText('Documento rechazado')).toBeNull();expect(screen.queryByText(/1 documento rechazado/)).toBeNull();expect(screen.queryByRole('button',{name:/Descargar original/})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Actualizar documentos'}));expect(retry).toHaveBeenCalledOnce();
});
it('distinguishes missing document data from a confirmed empty list',()=>{
 const view=render(<ApplicantDocuments applicationId="s" fresh onRetry={()=>{}} />);open();expect(screen.getByRole('button',{name:'Actualizar documentos'})).toBeVisible();
 view.rerender(<ApplicantDocuments applicationId="s" documents={[]} fresh onRetry={()=>{}} />);expect(screen.getByText('Todavía no hay documentos guardados en esta solicitud.')).toBeVisible();expect(screen.queryByRole('button',{name:'Actualizar documentos'})).toBeNull();
});
it('blocks duplicate download commands while the first is pending',async()=>{
 let finish:()=>void=()=>{};download.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve}));render(<ApplicantDocuments applicationId="s" documents={docs} fresh onRetry={()=>{}} />);open();
 const button=screen.getByRole('button',{name:'Descargar original Factura completa.png'});fireEvent.click(button);fireEvent.click(button);expect(download).toHaveBeenCalledOnce();expect(button).toBeDisabled();await act(async()=>finish());expect(button).toBeEnabled();
});

it('shows rejected originals first without changing the supplied document order',()=>{
 const reverse=[docs[1],docs[0]];render(<ApplicantDocuments applicationId="s" documents={reverse} fresh onRetry={()=>{}} />);open();expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Factura completa.png');expect(reverse[0].id).toBe('approved');
});
