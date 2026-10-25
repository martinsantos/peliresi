import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../contexts/AuthContext';
import type { Documento } from '../../services/generador-fiscal.service';

const mock = vi.hoisted(() => ({
  user: { id: 'account', rol: 'ADMIN', actorId: 'self' } as User | null,
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mock.user }) }));
vi.mock('../../services/api', () => ({ default: { get: mock.get, post: mock.post, patch: mock.patch, delete: mock.delete } }));
// Keep the document service, shared query, mutations and certificate form real.
vi.mock('../../components/DocumentUpload', () => ({ default: (props: {
  documentos: Documento[]; readOnly: boolean; onUpload: (file: File, tipo: string, anio: number) => void;
  onRevisar: (id: string, state: string) => void;
}) => <section aria-label="Adjuntos">
  {props.documentos.map(doc => <p key={doc.id}>{doc.nombre} · {doc.estado}</p>)}
  {!props.readOnly && <>
    <button onClick={() => props.onUpload(new File(['PDF'], 'adjunto.pdf', { type: 'application/pdf' }), 'CERTIFICADO_AMBIENTAL', 2026)}>Adjuntar en documentos</button>
    <button onClick={() => props.onRevisar('official', 'APROBADO')}>Revisar en documentos</button>
  </>}
</section> }));

import ActorCertificates from '../../components/ActorCertificates';
import { ActorDocuments } from '../../components/ActorDocuments';
import { QueryContent } from '../../components/ui/QueryContent';
import { useDocumentos, useUploadDocumento, useRevisarDocumento, useDeleteDocumento } from '../../hooks/useGeneradorFiscal';
import { actorDocumentsKey, type DocumentActorType } from '../../hooks/useActorDocuments';

const certificate = (name = 'CAA.pdf', state: Documento['estado'] = 'APROBADO') => ({
  id: 'official', tipo: 'CERTIFICADO_AMBIENTAL', nombre: name, estado: state, anio: 2026,
  createdAt: '2026-10-25T12:00:00Z',
} as Documento);
let rows: Documento[];
const endpoint = { GENERADOR: 'generadores', OPERADOR: 'operadores', TRANSPORTISTA: 'transportistas' };

function GeneratorDocuments({ id }: { id: string }) {
  const query = useDocumentos(id);
  const upload = useUploadDocumento(), review = useRevisarDocumento(), remove = useDeleteDocumento();
  return <QueryContent query={query} loading="Cargando documentos" error="No se pudieron consultar los documentos." retryLabel="Reintentar documentos">
    <section aria-label="Adjuntos">{query.data?.map(doc => <p key={doc.id}>{doc.nombre} · {doc.estado}</p>)}</section>
    <button onClick={() => upload.mutate({ generadorId: id, file: new File(['PDF'], 'adjunto.pdf', { type: 'application/pdf' }), tipo: 'CERTIFICADO_AMBIENTAL', anio: 2026 })}>Adjuntar en documentos</button>
    <button onClick={() => review.mutate({ generadorId: id, docId: 'official', estado: 'APROBADO' })}>Revisar en documentos</button>
    <button onClick={() => remove.mutate({ generadorId: id, docId: 'official' })}>Eliminar en documentos</button>
  </QueryContent>;
}
function open(type: DocumentActorType = 'GENERADOR', id = 'actor') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const content = (actorId: string) => <QueryClientProvider client={client}>
    <ActorCertificates type={type} actorId={actorId} />
    {type === 'GENERADOR' ? <GeneratorDocuments id={actorId} /> : <ActorDocuments actorId={actorId} actorType={type} cuit="99000000000" />}
  </QueryClientProvider>;
  const result = render(content(id));
  return { client, rerender: (actorId = id) => result.rerender(content(actorId)) };
}

beforeEach(() => {
  vi.resetAllMocks(); mock.user = { id: 'account', rol: 'ADMIN', actorId: 'self' } as User;
  rows = [certificate()];
  mock.get.mockImplementation(async () => ({ data: { data: { documentos: rows } } }));
  mock.post.mockImplementation(async () => { rows = [certificate('nuevo.pdf', 'PENDIENTE')]; return { data: { data: { documento: rows[0] } } }; });
  mock.patch.mockImplementation(async () => { rows = [certificate('publicado.pdf')]; return { data: { data: { documento: rows[0] } } }; });
  mock.delete.mockImplementation(async () => { rows = []; return { data: {} }; });
});

describe.each(['GENERADOR', 'OPERADOR', 'TRANSPORTISTA'] as const)('Shared documents for %s', type => {
  it('deduplicates the authenticated read and a retry from attachments recovers certificates too', async () => {
    mock.get.mockRejectedValueOnce(new Error('503'));
    open(type);
    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(mock.get).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar documentos' }));
    expect(await screen.findByRole('button', { name: 'Descargar CAA 2026' })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Adjuntos' })).getByText('CAA.pdf · APROBADO')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mock.get).toHaveBeenCalledTimes(2);
    expect(mock.get).toHaveBeenLastCalledWith(`/actores/${endpoint[type]}/actor/documentos`);
  });

  it('refreshes attachments after a certificate upload and publication', async () => {
    open(type);
    await screen.findByRole('button', { name: 'Descargar CAA 2026' });
    fireEvent.change(screen.getByLabelText('PDF oficial firmado'), { target: { files: [new File(['PDF'], 'nuevo.pdf', { type: 'application/pdf' })] } });
    fireEvent.submit(screen.getByRole('button', { name: 'Cargar certificado' }).closest('form')!);
    expect(await screen.findByText('nuevo.pdf · PENDIENTE')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar certificado' }));
    expect(await screen.findByText('publicado.pdf · APROBADO')).toBeVisible();
    expect(screen.queryByText('Pendiente de publicación por DGFA')).toBeNull();
    expect(mock.post).toHaveBeenCalledTimes(1);
    expect(mock.patch).toHaveBeenCalledTimes(1);
  });

  it('refreshes certificates after an attachment upload and review', async () => {
    open(type);
    await screen.findByRole('button', { name: 'Descargar CAA 2026' });
    fireEvent.click(screen.getByRole('button', { name: 'Adjuntar en documentos' }));
    expect(await screen.findByText('Pendiente de publicación por DGFA')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar en documentos' }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Certificados ambientales oficiales' })).getByText('publicado.pdf')).toBeVisible());
    expect(screen.queryByText('Pendiente de publicación por DGFA')).toBeNull();
  });

  it('hides current and older downloads if a refresh fails, then recovers both views with one retry', async () => {
    rows.push({ ...certificate('anterior.pdf'), id: 'older', createdAt: '2026-01-01T12:00:00Z' });
    const { client } = open(type);
    await screen.findByText('Versiones anteriores (1)');
    mock.get.mockRejectedValueOnce(new Error('503'));
    await client.invalidateQueries({ queryKey: actorDocumentsKey(type, 'actor') });
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(screen.queryByText('Versiones anteriores (1)')).toBeNull();
    expect(screen.queryByRole('button', { name: /Descargar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar certificados' }));
    expect(await screen.findByRole('button', { name: 'Descargar CAA 2026' })).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('CAA.pdf · APROBADO')).toBeVisible();
  });
});

it('deleting a generator attachment removes it from the certificates too', async () => {
  open(); await screen.findByRole('button', { name: 'Descargar CAA 2026' });
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar en documentos' }));
  expect(await screen.findByText('DGFA todavía no publicó un certificado para este actor.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Descargar CAA 2026' })).toBeNull();
});

it.each(['account', 'role', 'company', 'site', 'authorization'] as const)('does not reuse documents when the %s context changes', async change => {
  mock.user!.empresaContexto = { empresaId: 'company-a', actividadId: 'activity-a', establecimientoId: 'site-a', autorizacionId: 'auth-a', revision: 1 } as NonNullable<User['empresaContexto']>;
  const { rerender } = open();
  await screen.findByRole('button', { name: 'Descargar CAA 2026' });
  mock.get.mockReturnValueOnce(new Promise(() => {}));
  mock.user = { ...mock.user!, empresaContexto: { ...mock.user!.empresaContexto! } };
  if (change === 'account') mock.user.id = 'another-person';
  if (change === 'role') mock.user.rol = 'GENERADOR';
  if (change === 'company') mock.user.empresaContexto!.empresaId = 'company-b';
  if (change === 'site') mock.user.empresaContexto!.establecimientoId = 'site-b';
  if (change === 'authorization') mock.user.empresaContexto!.revision = 2;
  rerender();
  expect(screen.queryByRole('button', { name: 'Descargar CAA 2026' })).toBeNull();
  expect(screen.queryByText('CAA.pdf · APROBADO')).toBeNull();
  await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(2));
});

it('does not reuse documents from another actor', async () => {
  const { rerender } = open(); await screen.findByRole('button', { name: 'Descargar CAA 2026' });
  mock.get.mockReturnValueOnce(new Promise(() => {})); rerender('different-actor');
  expect(screen.queryByRole('button', { name: 'Descargar CAA 2026' })).toBeNull();
  await waitFor(() => expect(mock.get).toHaveBeenLastCalledWith('/actores/generadores/different-actor/documentos'));
});

it.each(['actor', 'account', 'role'] as const)('does not carry a selected certificate into a different %s', async change => {
  const { rerender } = open();
  await screen.findByRole('button', { name: 'Descargar CAA 2026' });
  fireEvent.change(screen.getByLabelText('PDF oficial firmado'), { target: { files: [new File(['PDF'], 'privado.pdf', { type: 'application/pdf' })] } });
  if (change === 'account') mock.user = { ...mock.user!, id: 'another-admin' };
  if (change === 'role') mock.user = { ...mock.user!, rol: 'ADMIN_GENERADOR' };
  rerender(change === 'actor' ? 'different-actor' : 'actor');
  fireEvent.submit(screen.getByRole('button', { name: 'Cargar certificado' }).closest('form')!);
  expect(await screen.findByText('Elegí el PDF oficial del certificado.')).toBeVisible();
  expect(mock.post).not.toHaveBeenCalled();
});

it('keeps a selected file after a read retry in the same context', async () => {
  const { client } = open();
  await screen.findByRole('button', { name: 'Descargar CAA 2026' });
  fireEvent.change(screen.getByLabelText('PDF oficial firmado'), { target: { files: [new File(['PDF'], 'privado.pdf', { type: 'application/pdf' })] } });
  mock.get.mockRejectedValueOnce(new Error('503'));
  await client.invalidateQueries({ queryKey: actorDocumentsKey('GENERADOR', 'actor') });
  await screen.findByRole('button', { name: 'Reintentar certificados' });
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar certificados' }));
  await screen.findByRole('button', { name: 'Descargar CAA 2026' });
  fireEvent.submit(screen.getByRole('button', { name: 'Cargar certificado' }).closest('form')!);
  await waitFor(() => expect(mock.post).toHaveBeenCalledOnce());
  expect((mock.post.mock.calls[0][1] as FormData).get('archivo')).toMatchObject({ name: 'privado.pdf' });
});
