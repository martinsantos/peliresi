import { institutionalPdf, PDF_STYLE } from './institutionalPdf.service';
import { readTransportAssignment } from '../domain/manifiestoTransportAssignment';

const date = (value: unknown) => value ? new Date(value as string).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', hour12: false }) + ' (Mendoza)' : 'No registrada';
const states: Record<string, string> = { BORRADOR: 'Borrador', PENDIENTE_APROBACION: 'Pendiente de aprobación', APROBADO: 'Aprobado', EN_TRANSITO: 'En tránsito', ENTREGADO: 'Entregado', RECIBIDO: 'Recibido', EN_TRATAMIENTO: 'En tratamiento', TRATADO: 'Tratado', RECHAZADO: 'Rechazado', CANCELADO: 'Cancelado' };
/** Read-only representation. Never changes the declaration or replaces stored certificates. */
export function renderManifestPdf(m: any): Promise<Buffer> {
  return institutionalPdf(m.modalidad === 'IN_SITU' ? 'Manifiesto de tratamiento en origen' : 'Manifiesto de transporte de residuos peligrosos', m.numero, layout => {
    const doc = layout.doc;
    layout.text(m.modalidad === 'IN_SITU' ? 'MANIFIESTO · TRATAMIENTO EN ORIGEN' : 'MANIFIESTO', true, 9, PDF_STYLE.green);
    layout.text(m.numero, true, 22);
    layout.fields([{ label: 'Estado actual', value: states[m.estado] || m.estado }, { label: 'Creado', value: date(m.createdAt) }]);
    layout.text('Ley Nacional 24.051 · Decreto 831/93 · Provincia de Mendoza', false, 8, PDF_STYLE.muted);
    const actor = (number: string, title: string, data: any, inscription: string) => {
      layout.section(number + '  ' + title);
      layout.fields([{ label: 'Razón social', value: data?.razonSocial }]);
      layout.fields([{ label: 'CUIT', value: data?.cuit }, { label: 'Inscripción / habilitación', value: data?.[inscription] }]);
    };
    actor('01', 'GENERADOR DE RESIDUOS', m.generador, 'numeroInscripcion');
    const company = m.contextoEmpresa, productive = company?.rol === 'GENERADOR' ? company.establecimiento : null;
    layout.fields([{ label: productive ? 'Domicilio productivo' : 'Domicilio', value: productive?.domicilio ?? m.generador?.domicilio }]);
    if (productive) layout.fields([{ label: 'Establecimiento', value: productive.nombre }, { label: 'Domicilio legal al declarar', value: company.domicilioLegal?.calle }]);
    if (m.transportista) {
      actor('02', m.modalidad === 'IN_SITU' ? 'TRANSPORTE APROBADOR' : 'TRANSPORTISTA', m.transportista, 'numeroHabilitacion');
      if (m.modalidad === 'IN_SITU') layout.text('Tratamiento en origen: el transporte aprueba, sin traslado ni viaje.');
      else {
        const assignment = readTransportAssignment(m.asignacionTransporte, m.transportistaId);
        const v = assignment?.vehiculo, c = assignment?.chofer;
        layout.fields([{ label: 'Vehículo asignado', value: v ? v.marca + ' ' + v.modelo + ' - ' + v.patente : 'Sin asignación registrada' }, { label: 'Chofer asignado', value: c ? c.nombre + ' ' + c.apellido + ' - DNI ' + c.dni : 'Sin asignación registrada' }]);
      }
    } else { layout.section('02  MODALIDAD IN SITU'); layout.text('Tratamiento in situ - sin transporte'); }
    actor('03', 'OPERADOR DE TRATAMIENTO', m.operador, 'numeroHabilitacion');
    layout.fields([{ label: 'Domicilio', value: m.operador?.domicilio }]);
    layout.section('04  RESIDUOS DECLARADOS', 115);
    layout.table(['Corriente', 'Descripción', 'Cantidad', 'Unidad'], m.residuos.map((r: any) => [r.tipoResiduo.codigo, r.tipoResiduo.nombre, String(r.cantidad), r.unidad]), [70, 277, 95, 65]);
    if (m.observaciones) { layout.section('05  OBSERVACIONES'); layout.text(m.observaciones); }
    layout.section('06  FECHAS Y FIRMA');
    const dates = [['Creación', m.createdAt], ['Firma', m.fechaFirma], ['Retiro', m.fechaRetiro], ['Entrega', m.fechaEntrega], ['Recepción', m.fechaRecepcion], ['Cierre', m.fechaCierre]].filter(([, v]) => v);
    for (let i = 0; i < dates.length; i += 2) layout.fields(dates.slice(i, i + 2).map(([label, value]) => ({ label, value: date(value) })));
    if (m.fechaFirma) {
      const signature = [...m.eventos].reverse().find(e => e.tipo === 'FIRMA');
      if (signature?.firmaImagen) {
        layout.ensure(120); layout.text('Firma manuscrita adjunta', true, 9);
        const y = doc.y; doc.image(signature.firmaImagen, 44, y, { fit: [220, 60] }); doc.y = y + 66;
        layout.text([signature.usuario?.nombre, signature.usuario?.apellido].filter(Boolean).join(' '), false, 9);
        layout.text('Registro: ' + date(signature.createdAt) + ' | SHA-256: ' + signature.firmaSha256, false, 8, PDF_STYLE.muted);
      } else layout.text('Aprobación registrada en SITREP. Sin firma manuscrita adjunta.', false, 9, PDF_STYLE.muted);
    }
    if (m.qrCode || (m.blockchainStatus === 'CONFIRMADO' && m.blockchainHash)) {
      layout.section('07  VERIFICACIÓN');
      if (m.qrCode) {
        layout.ensure(105);
        try { const y = doc.y; doc.image(Buffer.from(m.qrCode.split(',')[1], 'base64'), 44, y, { width: 80, height: 80 }); doc.y = y + 86; layout.text('Código QR de verificación', false, 8, PDF_STYLE.muted); }
        catch { layout.text('No se pudo representar el QR. Consultá el registro en SITREP.', false, 8, PDF_STYLE.muted); }
      }
      if (m.blockchainStatus === 'CONFIRMADO' && m.blockchainHash) {
        layout.text('Registro confirmado en Ethereum Sepolia', true, 9);
        layout.text('SHA-256: ' + m.blockchainHash, false, 8);
        if (m.blockchainTxHash) { layout.text('TX: ' + m.blockchainTxHash, false, 8); layout.text('Verificar: https://sepolia.etherscan.io/tx/' + m.blockchainTxHash, false, 8); }
      }
    }
    layout.text('Representación del manifiesto al ' + date(new Date()) + '. Los anexos y certificaciones conservan su propia versión y firma.', false, 8, PDF_STYLE.muted);
  });
}
