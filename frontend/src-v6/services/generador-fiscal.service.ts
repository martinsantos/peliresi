import api from './api';

export interface PagoTEF {
  id: string;
  generadorId: string;
  anio: number;
  montoTEF: number | null;
  resolucion: string | null;
  notificado: boolean;
  fechaNotificado: string | null;
  fechaPago: string | null;
  pagoFueraTermino: boolean;
  habilitado: boolean | null;
  gedoNotificacion: string | null;
  gedoResolucion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeclaracionJurada {
  id: string;
  generadorId: string;
  anio: number;
  numeroGDE: string | null;
  presentada: boolean;
  fechaPresentacion: string | null;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Documento {
  id: string;
  generadorId: string;
  tipo: string;
  nombre: string;
  path: string;
  mimeType: string;
  size: number;
  anio: number | null;
  estado: string;
  observaciones: string | null;
  subidoPor: string;
  revisadoPor: string | null;
  revisadoAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const generadorFiscalService = {
  // Pagos TEF
  async getPagos(generadorId: string): Promise<PagoTEF[]> {
    const { data } = await api.get(`/actores/generadores/${generadorId}/pagos`);
    return data.data.pagos || [];
  },
  async createPago(generadorId: string, pago: Partial<PagoTEF>): Promise<PagoTEF> {
    const { data } = await api.post(`/actores/generadores/${generadorId}/pagos`, pago);
    return data.data.pago;
  },
  async updatePago(generadorId: string, pagoId: string, pago: Partial<PagoTEF>): Promise<PagoTEF> {
    const { data } = await api.put(`/actores/generadores/${generadorId}/pagos/${pagoId}`, pago);
    return data.data.pago;
  },
  async deletePago(generadorId: string, pagoId: string): Promise<void> {
    await api.delete(`/actores/generadores/${generadorId}/pagos/${pagoId}`);
  },

  // DDJJ
  async getDDJJ(generadorId: string): Promise<DeclaracionJurada[]> {
    const { data } = await api.get(`/actores/generadores/${generadorId}/ddjj`);
    return data.data.ddjj || [];
  },
  async createDDJJ(generadorId: string, ddjj: Partial<DeclaracionJurada>): Promise<DeclaracionJurada> {
    const { data } = await api.post(`/actores/generadores/${generadorId}/ddjj`, ddjj);
    return data.data.ddjj;
  },
  async updateDDJJ(generadorId: string, ddjjId: string, ddjj: Partial<DeclaracionJurada>): Promise<DeclaracionJurada> {
    const { data } = await api.put(`/actores/generadores/${generadorId}/ddjj/${ddjjId}`, ddjj);
    return data.data.ddjj;
  },
  async deleteDDJJ(generadorId: string, ddjjId: string): Promise<void> {
    await api.delete(`/actores/generadores/${generadorId}/ddjj/${ddjjId}`);
  },

  // Documentos
  async getDocumentos(generadorId: string): Promise<Documento[]> {
    const { data } = await api.get(`/actores/generadores/${generadorId}/documentos`);
    return data.data.documentos || [];
  },
  async uploadDocumento(generadorId: string, file: File, tipo: string, anio?: number, observaciones?: string): Promise<Documento> {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('tipo', tipo);
    if (anio) formData.append('anio', String(anio));
    if (observaciones) formData.append('observaciones', observaciones);
    const { data } = await api.post(`/actores/generadores/${generadorId}/documentos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data.data.documento;
  },
  getDownloadUrl(docId: string): string {
    return `/actores/documentos/${docId}/download`;
  },
  async revisarDocumento(docId: string, estado: 'APROBADO' | 'RECHAZADO', observaciones?: string): Promise<Documento> {
    const { data } = await api.patch(`/actores/documentos/${docId}/revisar`, { estado, observaciones });
    return data.data.documento;
  },
  async deleteDocumento(docId: string): Promise<void> {
    await api.delete(`/actores/documentos/${docId}`);
  },
};

// ========== OPERADOR FISCAL SERVICE ==========

export const operadorFiscalService = {
  // Pagos TEF
  async getPagos(operadorId: string): Promise<PagoTEF[]> {
    const { data } = await api.get(`/actores/operadores/${operadorId}/pagos`);
    return data.data.pagos || [];
  },
  async createPago(operadorId: string, pago: Partial<PagoTEF>): Promise<PagoTEF> {
    const { data } = await api.post(`/actores/operadores/${operadorId}/pagos`, pago);
    return data.data.pago;
  },
  async updatePago(operadorId: string, pagoId: string, pago: Partial<PagoTEF>): Promise<PagoTEF> {
    const { data } = await api.put(`/actores/operadores/${operadorId}/pagos/${pagoId}`, pago);
    return data.data.pago;
  },
  async deletePago(operadorId: string, pagoId: string): Promise<void> {
    await api.delete(`/actores/operadores/${operadorId}/pagos/${pagoId}`);
  },

  // DDJJ
  async getDDJJ(operadorId: string): Promise<DeclaracionJurada[]> {
    const { data } = await api.get(`/actores/operadores/${operadorId}/ddjj`);
    return data.data.ddjj || [];
  },
  async createDDJJ(operadorId: string, ddjj: Partial<DeclaracionJurada>): Promise<DeclaracionJurada> {
    const { data } = await api.post(`/actores/operadores/${operadorId}/ddjj`, ddjj);
    return data.data.ddjj;
  },
  async updateDDJJ(operadorId: string, ddjjId: string, ddjj: Partial<DeclaracionJurada>): Promise<DeclaracionJurada> {
    const { data } = await api.put(`/actores/operadores/${operadorId}/ddjj/${ddjjId}`, ddjj);
    return data.data.ddjj;
  },
  async deleteDDJJ(operadorId: string, ddjjId: string): Promise<void> {
    await api.delete(`/actores/operadores/${operadorId}/ddjj/${ddjjId}`);
  },

  // Documentos
  async getDocumentos(operadorId: string): Promise<Documento[]> {
    const { data } = await api.get(`/actores/operadores/${operadorId}/documentos`);
    return data.data.documentos || [];
  },
  async uploadDocumento(operadorId: string, file: File, tipo: string, anio?: number, observaciones?: string): Promise<Documento> {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('tipo', tipo);
    if (anio) formData.append('anio', String(anio));
    if (observaciones) formData.append('observaciones', observaciones);
    const { data } = await api.post(`/actores/operadores/${operadorId}/documentos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data.data.documento;
  },
};
