import { api } from './api';

export interface ManifiestoSearchHit {
  id: string;
  numero: string;
  estado: string;
  createdAt: string;
  generador: { razonSocial: string } | null;
}

export interface ActorSearchHit {
  id: string;
  razonSocial: string;
  cuit: string;
  categoria?: string;
}

export interface SearchResult {
  manifiestos: ManifiestoSearchHit[];
  generadores: ActorSearchHit[];
  transportistas: ActorSearchHit[];
  operadores: ActorSearchHit[];
  totalHits: number;
}

export const searchService = {
  async search(q: string, estado?: string): Promise<SearchResult> {
    const params: Record<string, string> = { q };
    if (estado) params.estado = estado;
    const res = await api.get('/search', { params });
    return res.data.data as SearchResult;
  },
};
