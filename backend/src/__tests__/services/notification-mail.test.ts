const renewalRecipients = vi.hoisted(() => vi.fn());
vi.mock('../../services/renewalCompanyRecipients.service', () => ({ renewalCompanyRecipients: renewalRecipients }));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), insert: vi.fn(), inspection: vi.fn(), notice: vi.fn(), application: vi.fn(), applicationContexts: vi.fn(), document: vi.fn(), manifest: vi.fn(), alert: vi.fn(), renewal: vi.fn(), leg: vi.fn(), carrier: vi.fn(), account: vi.fn(), user: vi.fn(), exchange: vi.fn(), companyRecipients: vi.fn(), certificate: vi.fn() }));
vi.mock('../../services/manifestCompanyRecipients.service', () => ({ manifestCompanyRecipients: mocks.companyRecipients }));
vi.mock('../../lib/prisma', () => ({ default: { $queryRawUnsafe: mocks.query, emailQueue: { createMany: mocks.insert }, inspeccion: { findUnique: mocks.inspection }, notificacion: { findUnique: mocks.notice }, solicitudInscripcion: { findFirst: mocks.application, findMany: mocks.applicationContexts }, documento: { findUnique: mocks.document }, manifiesto: { findUnique: mocks.manifest }, alertaGenerada: { findUnique: mocks.alert }, renovacion: { findUnique: mocks.renewal }, tramoTransporte: { findFirst: mocks.leg }, transportista: { findFirst: mocks.carrier }, usuario: { findFirst: mocks.account, findUnique: mocks.user }, intercambioInspeccion: { findUnique: mocks.exchange }, certificadoManifiesto: { findFirst: mocks.certificate } } }));
import { notificationMailContent, notificationSourceEligible, queueCommittedNotificationEmails, queuedNoticeStillEligible, type NoticeForMail } from '../../services/notification-mail.service';
import { mailText } from '../../services/email-templates';
const notice: NoticeForMail = { id: 'qa-notice', tipo: 'SOLICITUD_ENVIADA', datos: JSON.stringify({ solicitudId: 'sol-qa' }), createdAt: new Date(), email: 'qa@example.invalid', activo: true, emailVerified: true, notifEmail: true, rol: 'ADMIN' };
beforeEach(() => {
  vi.resetAllMocks();
  renewalRecipients.mockResolvedValue([]);
  mocks.applicationContexts.mockResolvedValue([{id:'sol-qa',tipoActor:'GENERADOR'}]);
  vi.stubEnv('DISABLE_EMAILS', 'false');
  vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE', new Date(Date.now() - 60000).toISOString());
  vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'solicitudes,soporte,inspecciones');
  mocks.query.mockResolvedValue([notice]); mocks.insert.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllEnvs());
describe('committed notice mail relay', () => {
  it.each([
    ['INFO_GENERAL', { tipo: 'seguimiento_cierre', version: 1, casoId: 'case' }],
    ['INCIDENTE_REPORTADO', {}], ['ANOMALIA_DETECTADA', {}],
  ])('links actor %s manifest alert to the owned notice without changing the admin destination', (tipo, datos) => {
    const n = { ...notice, id: 'followup-notice', rol: 'GENERADOR', tipo, manifiestoId: 'm', datos: JSON.stringify(datos) };
    expect(notificationMailContent(n)?.html).toContain('/notificaciones/followup-notice');
    expect(notificationMailContent({ ...n, rol: 'ADMIN' })?.html).toContain('/manifiestos/m');
  });
  it('renders a reversion through the owned notice and rechecks the original company access without sending', async () => {
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'PRIVATE', establecimientoId: 'site' };
    const n = { ...notice, id: 'reversion-notice', usuarioId: 'rep', rol: 'OPERADOR', tipo: 'INFO_GENERAL', manifiestoId: 'm',
      datos: JSON.stringify({ tipo: 'reversion_manifiesto', version: 1, destino: 'representante', accesosEmpresa: [access], motivo: 'PRIVATE' }) };
    mocks.manifest.mockResolvedValue({ isDemoData: false, generador: { usuarioId: 'owner' }, operador: { usuarioId: 'operator' } });
    mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [access] }]);
    expect(await notificationSourceEligible(n, 'manifiestos')).toBe(true);
    const content = notificationMailContent(n)!;
    expect(content.html).toContain('/notificaciones/reversion-notice'); expect(content.html).not.toContain('PRIVATE');
    expect(mailText(content.html)).toContain('Estado del manifiesto corregido');
    mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [{ ...access, establecimientoId: 'other' }] }]);
    expect(await notificationSourceEligible(n, 'manifiestos')).toBe(false); expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(['propuesta_partes', 'adenda_manifiesto', 'certificado_manifiesto'])(
    'suppresses %s mail if only a different company activity is now authorized', async tipo => {
      const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'QA Empresa', establecimientoId: 'site' };
      const extra = tipo === 'certificado_manifiesto' ? { documentoId: 'doc', tipoCertificado: 'PARCIAL' } : {};
      const n = { ...notice, id: 'old-company-notice', usuarioId: 'rep', rol: 'OPERADOR', tipo: 'INFO_GENERAL', manifiestoId: 'm',
        datos: JSON.stringify({ tipo, version: 1, accesosEmpresa: [access], ...extra }) };
      mocks.manifest.mockResolvedValue({ isDemoData: false, generador: { usuarioId: 'owner' }, operador: { usuarioId: 'operator' } });
      mocks.certificate.mockResolvedValue({ id: 'doc' });
      mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [access] }]);
      expect(await notificationSourceEligible(n, 'manifiestos')).toBe(true);
      mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [{ ...access, actividadId: 'other' }] }]);
      expect(await notificationSourceEligible(n, 'manifiestos')).toBe(false);
      expect(mocks.insert).not.toHaveBeenCalled();
    });
  it('retains delivery eligibility for a direct owner after a separate company grant is removed', async () => {
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'QA Empresa', establecimientoId: 'site' };
    const n = { ...notice, id: 'owner-notice', usuarioId: 'owner', rol: 'GENERADOR', tipo: 'INFO_GENERAL', manifiestoId: 'm',
      datos: JSON.stringify({ tipo: 'propuesta_partes', version: 1, accesosEmpresa: [access] }) };
    mocks.manifest.mockResolvedValue({ isDemoData: false, generador: { usuarioId: 'owner' }, operador: { usuarioId: 'operator' } });
    mocks.companyRecipients.mockResolvedValue([]);
    expect(await notificationSourceEligible(n, 'manifiestos')).toBe(true);
  });
  it.each([
    ['EN_TRANSITO', 'MANIFIESTO_EN_TRANSITO'], ['ENTREGADO', 'MANIFIESTO_ENTREGADO'],
    ['RECIBIDO', 'MANIFIESTO_RECIBIDO'], ['EN_TRATAMIENTO', 'INFO_GENERAL'],
    ['TRATADO', 'MANIFIESTO_TRATADO'], ['CANCELADO', 'INFO_GENERAL'],
  ])('renders the representative state notice %s via the owned notice and rechecks access', async (estado, tipo) => {
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'PRIVATE', establecimientoId: 'site' };
    const n = { ...notice, id: 'state-notice', usuarioId: 'rep', rol: 'OPERADOR', tipo, manifiestoId: 'm',
      datos: JSON.stringify({ tipo: 'estado_manifiesto', version: 1, estado, destino: 'representante', accesosEmpresa: [access] }) };
    mocks.manifest.mockResolvedValue({ isDemoData: false, generador: { usuarioId: 'owner' }, operador: { usuarioId: 'operator' } });
    mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [access] }]);
    expect(await notificationSourceEligible(n, 'manifiestos')).toBe(true);
    const content = notificationMailContent(n)!;
    expect(content.html).toContain('/notificaciones/state-notice'); expect(content.html).not.toContain('PRIVATE');
    mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [{ ...access, establecimientoId: 'other' }] }]);
    expect(await notificationSourceEligible(n, 'manifiestos')).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each([
    ['INCIDENTE', 'INCIDENTE_REPORTADO', 'alertas'], ['RECHAZO', 'MANIFIESTO_RECHAZADO', 'manifiestos'],
    ['DIFERENCIA_PESO', 'ALERTA_SISTEMA', 'alertas'], ['ENTREGA', 'MANIFIESTO_ENTREGADO', 'manifiestos'],
  ])('rechecks representative access for operational event %s without sending', async (evento, tipo, family) => {
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'PRIVATE', establecimientoId: 'site' };
    const n = { ...notice, id: 'operational-notice', usuarioId: 'rep', rol: 'OPERADOR', tipo, manifiestoId: 'm',
      datos: JSON.stringify({ tipo: 'alerta_evento_manifiesto', version: 1, destino: 'representante', evento, accesosEmpresa: [access] }) };
    mocks.manifest.mockResolvedValue({ isDemoData: false, generador: { usuarioId: 'owner' }, operador: { usuarioId: 'operator' } });
    mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [access] }]);
    expect(await notificationSourceEligible(n, family)).toBe(true);
    const content = notificationMailContent(n)!; expect(content.html).toContain('/notificaciones/operational-notice'); expect(content.html).not.toContain('PRIVATE');
    mocks.companyRecipients.mockResolvedValue([]); expect(await notificationSourceEligible(n, family)).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(['duracion_transito_configurada', 'alerta_regla_manifiesto'])('rechecks the exact representative activity and site for %s without sending', async tipo => {
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'PRIVATE', establecimientoId: 'site' };
    const n = { ...notice, id: 'rule-notice', usuarioId: 'rep', rol: 'OPERADOR', tipo: 'ALERTA_SISTEMA', manifiestoId: 'm',
      datos: JSON.stringify({ tipo, version: 1, destino: 'representante', accesosEmpresa: [access] }) };
    mocks.manifest.mockResolvedValue({ isDemoData: false, generador: { usuarioId: 'owner' }, operador: { usuarioId: 'operator' } });
    mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [access] }]);
    expect(await notificationSourceEligible(n, 'alertas')).toBe(true);
    const content = notificationMailContent(n)!;
    expect(content.html).toContain('/notificaciones/rule-notice'); expect(content.html).not.toContain('PRIVATE');
    mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [{ ...access, actividadId: 'other' }] }]);
    expect(await notificationSourceEligible(n, 'alertas')).toBe(false);
    mocks.companyRecipients.mockResolvedValue([]); expect(await notificationSourceEligible(n, 'alertas')).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('renders a configured transit threshold without implying a legal deadline or exposing free text', () => {
    const configured = notificationMailContent({ ...notice, tipo: 'ALERTA_SISTEMA', manifiestoId: 'manifest', datos: JSON.stringify({
      tipo: 'duracion_transito_configurada', version: 1, evento: 'TIEMPO_EXCESIVO', horasTransito: 25, descripcion: 'PRIVATE',
    }) })!;
    expect(mailText(configured.html)).toMatch(/umbral de duración configurado por Ambiente/i);
    expect(mailText(configured.html)).toMatch(/no implica un plazo obligatorio/i);
    expect(configured.html).not.toContain('PRIVATE'); expect(mocks.insert).not.toHaveBeenCalled();
    const historical = notificationMailContent({ ...notice, tipo: 'ALERTA_SISTEMA', manifiestoId: 'manifest', datos: JSON.stringify({
      evento: 'TIEMPO_EXCESIVO', horasTransito: 25,
    }) })!;
    expect(mailText(historical.html)).not.toMatch(/umbral de duración configurado por Ambiente/i);
  });
  it.each([
    { tipo: 'ANOMALIA_DETECTADA', datos: '{}' },
    { tipo: 'ALERTA_SISTEMA', datos: JSON.stringify({ evento: 'ANOMALIA_GPS', tipoAnomalia: 'VELOCIDAD_ANORMAL', descripcion: 'PRIVATE' }) },
  ])('renders a GPS observation as unconfirmed without sending or exposing free text', fields => {
    const rendered = notificationMailContent({ ...notice, ...fields, manifiestoId: 'manifest' })!;
    expect(mailText(rendered.html)).toMatch(/hora de captura.*recepci[oó]n/i);
    expect(mailText(rendered.html)).toMatch(/verific[aá].*transporte/i);
    expect(rendered.html).not.toContain('PRIVATE');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('renders origin coordination accurately for %s without sending mail', rol => {
    const n = { ...notice, rol, tipo: 'INFO_GENERAL', manifiestoId: 'manifest', datos: JSON.stringify({ tipo: 'propuesta_partes', version: 1, fase: 'iniciada', modalidad: 'IN_SITU', partesRequeridas: 3 }) };
    const content = notificationMailContent(n)!;
    expect(content.subject).toContain('Coordinación en origen iniciada');
    expect(mailText(content.html)).toContain('No hay retiro, viaje ni GPS');
    expect(mailText(content.html)).not.toContain('preparar el retiro');
    expect(content.html).toContain('/notificaciones/qa-notice');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('keeps ordinary and historical coordination notices truthful', () => {
    const common = { ...notice, tipo: 'INFO_GENERAL', manifiestoId: 'manifest' };
    const start = (modalidad?: string) => notificationMailContent({ ...common, datos: JSON.stringify({ tipo: 'propuesta_partes', version: 1, fase: 'iniciada', modalidad }) })!;
    expect(mailText(start('FIJO').html)).toContain('preparar el retiro');
    expect(mailText(start().html)).toContain('siguiente acción');
    expect(mailText(start().html)).not.toContain('preparar el retiro');
    const approved = (partesRequeridas?: number) => notificationMailContent({ ...common, datos: JSON.stringify({ tipo: 'propuesta_partes', version: 1, fase: 'aprobada', partesRequeridas }) })!;
    expect(approved(3).subject).toContain('tres partes');
    expect(approved().subject).not.toContain('tres partes');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('renders an individual %s approval as an event without claiming pending approvals', role => {
    const individual = { ...notice, rol: 'GENERADOR', tipo: 'INFO_GENERAL', manifiestoId: 'manifest',
      datos: JSON.stringify({ tipo: 'propuesta_partes', version: 1, fase: `aprobacion-${role}` }) };
    const content = notificationMailContent(individual)!;
    expect(mailText(content.html)).toContain('Consultá el estado actual de las aprobaciones');
    expect(mailText(content.html)).not.toContain('qué aprobaciones faltan');
    expect(content.html).toContain('/notificaciones/qa-notice');
    expect(notificationMailContent({ ...individual, rol: 'ADMIN' })!.html).toContain('/manifiestos/manifest');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(['certificado_manifiesto','propuesta_partes','adenda_manifiesto'])('revalidates representative %s access before any future delivery, including revocation', async tipo => {
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'QA Empresa' };
    const n = { ...notice, id: 'company-cert', usuarioId: 'representative', rol: 'OPERADOR', tipo: 'INFO_GENERAL', manifiestoId: 'm',
      datos: JSON.stringify({ tipo, version: 1, documentoId: 'doc', tipoCertificado: 'PARCIAL', accesosEmpresa: [access] }) };
    mocks.manifest.mockResolvedValue({isDemoData:false,generador:{usuarioId:'original'},operador:{usuarioId:'signer'}});
    mocks.certificate.mockResolvedValue({id:'doc'});
    mocks.companyRecipients.mockResolvedValue([{usuarioId:'representative',accesosEmpresa:[access]}]);
    expect(await notificationSourceEligible(n,'manifiestos')).toBe(true);
    mocks.companyRecipients.mockResolvedValue([]);
    expect(await notificationSourceEligible(n,'manifiestos')).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('never makes synthetic certificate notifications eligible for external delivery',async()=>{
    mocks.manifest.mockResolvedValue({isDemoData:true});
    const n={...notice,usuarioId:'representative',rol:'GENERADOR',manifiestoId:'m',datos:JSON.stringify({tipo:'certificado_manifiesto',version:1,accesosEmpresa:[{}]})};
    expect(await notificationSourceEligible(n,'manifiestos')).toBe(false);
    expect(mocks.companyRecipients).not.toHaveBeenCalled();expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('rechecks an approved secondary PSIP activity at delivery and rejects its revocation without sending', async () => {
    vi.stubEnv('ACTOR_MULTIROLE_ENABLED', 'true');
    const n = { ...notice, usuarioId: 'owner', rol: 'GENERADOR', tipo: 'INFO_GENERAL', datos: JSON.stringify({ tipo: 'intercambio_inspeccion', version: 1, correoVersion: 1, inspeccionId: 'case', intercambioId: 'exchange', secuencia: 2, evento: 'REQUERIMIENTO', parte: 'AUTORIDAD', destino: 'participacion', tipoActor: 'OPERADOR' }) };
    mocks.inspection.mockResolvedValue({ numeroActa: null, inspectorId: 'admin', tipoActor: 'OPERADOR', estado: 'EN_DESCARGO', operadorId: 'operator-own', operador: { usuarioId: 'owner' } });
    mocks.account.mockResolvedValue({ id: 'owner' });
    mocks.exchange.mockResolvedValue({ inspeccionId: 'case', secuencia: 2, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', autorId: 'admin' });
    expect(await notificationSourceEligible(n, 'inspecciones')).toBe(true);
    expect(mocks.account).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [
      { id: 'owner', activo: true }, expect.objectContaining({ operador: { is: { id: 'operator-own' } }, OR: expect.arrayContaining([expect.objectContaining({ solicitudes: { some: { estado: 'APROBADA', tipoActor: 'OPERADOR', operadorId: 'operator-own' } } })]) }),
    ] } }));
    mocks.account.mockResolvedValue(null);
    expect(await notificationSourceEligible(n, 'inspecciones')).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(['GENERADOR', 'OPERADOR'].flatMap(tipoActor => ['MODIFICACION_SOLICITADA', 'MODIFICACION_APROBADA', 'MODIFICACION_RECHAZADA'].map(tipo => ({ tipoActor, tipo }))))('renders bounded renewal context and the next action for $tipoActor / $tipo without private notes', ({ tipoActor, tipo }) => {
    const content = notificationMailContent({ ...notice, tipo, datos: JSON.stringify({
      tipo: 'renovacion_padron', version: 1, renovacionId: 'renewal-qa', tipoActor, actorNombre: 'Empresa <QA> & Asociados', anio: 2027,
      motivoRechazo: 'PRIVATE', observaciones: 'PRIVATE', importe: 'PRIVATE',
    }) })!;
    expect(content.subject).toContain('Renovación');
    expect(content.html).toContain('Empresa &lt;QA&gt; &amp; Asociados');
    expect(mailText(content.html)).toContain('Período 2027');
    expect(mailText(content.html)).toContain(tipoActor === 'GENERADOR' ? 'Generador' : 'Operador');
    expect(content.html).toContain(tipo === 'MODIFICACION_SOLICITADA' ? 'Revisar renovación' : 'Ver resultado');
    expect(content.html).toContain(tipo === 'MODIFICACION_SOLICITADA' ? '/admin/renovaciones?anio=&amp;revision=renewal-qa' : '/notificaciones/qa-notice');
    expect(content.html).not.toMatch(/PRIVATE|<QA>/);
  });
  it.each([{ anio: '2027' }, { anio: 2101 }, { version: 2 }, { actorNombre: 'a'.repeat(201) }, { tipoActor: 'TRANSPORTISTA' }, { actorNombre: '' }])('does not invent a renewal reference from invalid metadata %j', invalid => {
    const content = notificationMailContent({ ...notice, tipo: 'MODIFICACION_SOLICITADA', datos: JSON.stringify({
      tipo: 'renovacion_padron', version: 1, renovacionId: 'renewal-qa', tipoActor: 'GENERADOR', actorNombre: 'QA Fallback', anio: 2027, ...invalid,
    }) })!;
    expect(content.subject).toBe('[SITREP] Cambio de padrón pendiente de revisión');
    expect(content.html).not.toContain('Período');
    expect(content.html).toContain('/admin/renovaciones?anio=&amp;revision=renewal-qa');
  });
  it('links the reviewer to the exact renewal and the actor to their decision notice', () => {
    const data = JSON.stringify({ renovacionId: 'renewal-qa' });
    const review = notificationMailContent({ ...notice, tipo: 'MODIFICACION_SOLICITADA', datos: data })!;
    expect(review.html).toContain('/admin/renovaciones?anio=&amp;revision=renewal-qa');
    const result = notificationMailContent({ ...notice, tipo: 'MODIFICACION_APROBADA', rol: 'GENERADOR', datos: data })!;
    expect(result.html).toContain('/notificaciones/qa-notice');
  });
  it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN'])('explains individual approval and separate certificate issuance for %s', rol => {
    const common = { ...notice, rol, manifiestoId: 'manifest' };
    const approved = notificationMailContent({ ...common, tipo: 'INFO_GENERAL', datos: JSON.stringify({ tipo: 'adenda_manifiesto', evento: 'APROBADA', nota: 'PRIVATE', autorRol: '<PRIVATE>' }) })!;
    expect(approved.subject).toBe('[SITREP] Una parte aprobó la adenda');
    expect(mailText(approved.html)).toContain('aprobación individual');
    expect(mailText(approved.html)).toContain('No representa la decisión de las otras partes ni el cierre documental');
    expect(approved.html).toContain(rol === 'ADMIN' ? '/manifiestos/manifest/adendas' : '/notificaciones/qa-notice');
    expect(approved.html).not.toContain('PRIVATE');
    const closed = notificationMailContent({ ...common, tipo: 'MANIFIESTO_TRATADO', datos: '{}' })!;
    expect(closed.subject).toBe('[SITREP] Tratamiento finalizado');
    expect(mailText(closed.html)).toContain('no confirma que se haya emitido una certificación');
    expect(mailText(closed.html)).toContain('firma y emisión expresa del operador');
    expect(closed.html).not.toContain('Podés consultar su certificado de disposición');
    expect(closed.html).toContain(rol === 'ADMIN' ? '/manifiestos/manifest' : '/notificaciones/qa-notice');
  });
  it.each([{ solicitudId: 'application' }, { documentoId: 'document' }])('names the repeated receipt without leaking receipt or actor data: %j', origin => {
    const repeated = notificationMailContent({ ...notice, tipo: 'ALERTA_SISTEMA', rol: 'GENERADOR', datos: JSON.stringify({ tipo: 'comprobante_repetido', ...origin, ruta: 'https://untrusted.invalid', texto: 'PRIVATE', cuit: 'PRIVATE', importe: 'PRIVATE' }) })!;
    expect(repeated.subject).toBe('[SITREP] Comprobante repetido: revisá el documento');
    expect(repeated.family).toBe('alertas');
    expect(mailText(repeated.html)).toContain('no acredita un pago nuevo');
    expect(mailText(repeated.html)).toContain('huella del archivo');
    expect(repeated.html).toContain('solicitudId' in origin ? '/app/mi-solicitud?solicitud=application' : '/app/notificaciones/qa-notice');
    expect(repeated.html).not.toMatch(/PRIVATE|untrusted|fraude/);
    expect(notificationMailContent({ ...notice, tipo: 'ALERTA_SISTEMA', datos: '{}' })?.subject).toBe('[SITREP] Alerta para revisar');
  });
  it.each([['GENERADOR', '/app/mi-solicitud?solicitud=application&documento=document'], ['ADMIN_OPERADOR', '/app/admin/solicitudes/application?documento=document']])('links the repeated receipt to its document for %s', (rol, destination) => {
    const data = { tipo: 'comprobante_repetido', solicitudId: 'application', documentoId: 'document', ruta: '/mi-solicitud' };
    const rendered = notificationMailContent({ ...notice, tipo: 'ALERTA_SISTEMA', rol, datos: JSON.stringify(data) })!;
    expect(mailText(rendered.html)).toContain(destination);
    expect(rendered.html).not.toContain('PRIVATE');
  });
  it('does not put a malformed document identifier into the receipt mail destination', () => {
    const rendered = notificationMailContent({ ...notice, tipo: 'ALERTA_SISTEMA', rol: 'GENERADOR', datos: JSON.stringify({ tipo: 'comprobante_repetido', solicitudId: 'application', documentoId: '../otro' }) })!;
    expect(mailText(rendered.html)).toContain('/app/notificaciones');
    expect(rendered.html).not.toContain('../otro');
  });
  it.each([{ tipo: 'intercambio_inspeccion' }, { tipo: 'intercambio_inspeccion', soloCampana: true }, { soloCampana: true }])('never relays a PSIP or bell-only notice even with SMTP/family enabled: %j', async metadata => {
    const internal = { ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ inspeccionId: 'inspection', ...metadata }) };
    expect(notificationMailContent(internal)).toBeNull();
    mocks.query.mockResolvedValue([internal]);
    await queueCommittedNotificationEmails();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ estado: 'SUPRIMIDO' })] }));
    mocks.notice.mockResolvedValue({ ...internal, usuario: internal });
    expect(await queuedNoticeStillEligible('notification:qa-notice', internal.email)).toBe(false);
    expect(mocks.inspection).not.toHaveBeenCalled();
  });
  it.each(['SOLICITUD_ENVIADA', 'SOLICITUD_OBSERVADA', 'SOLICITUD_MENSAJE', 'SOLICITUD_APROBADA', 'SOLICITUD_RECHAZADA'])('names the actual application event %s without private text', tipo => {
    const rendered = notificationMailContent({ ...notice, tipo, datos: JSON.stringify({ solicitudId: 'sol-qa', mensaje: 'PRIVATE DO NOT COPY' }) })!;
    expect(rendered.subject).not.toContain('Novedad');
    expect(rendered.html).toContain('Abrir inscripción');
    expect(rendered.html).toContain('Gobierno de Mendoza');
    expect(rendered.html).not.toContain('PRIVATE DO NOT COPY');
  });
  it.each(['CREADO', 'EN_NOMBRE', 'RESPONDER', 'DERIVAR', 'TOMAR', 'ESPERAR', 'CERRAR', 'REABRIR'])('names support event %s without exposing its content', evento => {
    const rendered = notificationMailContent({ ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ tipo: 'soporte', ticketId: 'ticket', evento, cuerpo: 'PRIVATE' }) })!;
    expect(rendered.subject).not.toContain('Actualización');
    expect(rendered.html).toContain('Abrir ticket');
    expect(rendered.html).not.toContain('PRIVATE');
  });
  it('uses a safe fallback for unknown events and excludes internal support notices', () => {
    expect(notificationMailContent({ ...notice, tipo: 'INFO_GENERAL', datos: '{"tipo":"soporte","ticketId":"ticket","evento":"__proto__"}' })?.subject).toBe('[SITREP] Actualización en tu ticket de soporte');
    expect(notificationMailContent({ ...notice, tipo: 'INFO_GENERAL', datos: '{"tipo":"soporte","ticketId":"ticket","evento":"NOTA","interno":true}' })).toBeNull();
  });
  it('includes actionable closure follow-up and rechecks its case and manifest', async () => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'alertas');
    const followup = { ...notice, usuarioId: 'owner', tipo: 'INFO_GENERAL', manifiestoId: 'manifest', datos: '{"tipo":"seguimiento_cierre","casoId":"case"}' };
    mocks.notice.mockResolvedValue({ ...followup, usuario: followup });
    mocks.manifest.mockResolvedValue({ isDemoData: false });
    mocks.alert.mockResolvedValue({ estado: 'PENDIENTE', regla: { activa: true } });
    expect(notificationMailContent(followup)?.family).toBe('alertas');
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(true);
    mocks.alert.mockResolvedValue({ estado: 'DESCARTADA', regla: { activa: true } });
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(false);
  });
  it.each([
    ['MODIFICACION_SOLICITADA', 'ADMIN_GENERADOR', 'PENDIENTE', 'other', true],
    ['MODIFICACION_SOLICITADA', 'ADMIN_OPERADOR', 'PENDIENTE', 'other', false],
    ['MODIFICACION_SOLICITADA', 'ADMIN', 'APROBADA', 'other', false],
    ['MODIFICACION_APROBADA', 'GENERADOR', 'APROBADA', 'owner', true],
    ['MODIFICACION_RECHAZADA', 'GENERADOR', 'RECHAZADA', 'owner', true],
    ['MODIFICACION_APROBADA', 'GENERADOR', 'APROBADA', 'reassigned', false],
    ['MODIFICACION_RECHAZADA', 'GENERADOR', 'PENDIENTE', 'owner', false],
  ])('renewal %s revalidates %s / %s / %s', async (tipo, rol, estado, owner, expected) => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'padron');
    const renewalNotice = { ...notice, tipo, rol, usuarioId: 'owner', datos: '{"renovacionId":"renewal"}' };
    mocks.notice.mockResolvedValue({ ...renewalNotice, usuario: renewalNotice });
    mocks.renewal.mockResolvedValue({ tipoActor: 'GENERADOR', estado, generador: { usuarioId: owner } });
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(expected);
  });
  it('a rejection notice requires the own rejected result, not an old observation', async () => {
    const rejected = { ...notice, tipo: 'SOLICITUD_RECHAZADA', activo: false, rol: 'GENERADOR', usuarioId: 'applicant', motivoInactividad: 'PENDIENTE_APROBACION' };
    mocks.query.mockResolvedValue([rejected]); mocks.application.mockResolvedValue({ id: 'sol-qa' });
    await queueCommittedNotificationEmails();
    expect(mocks.application).toHaveBeenCalledWith({ where: { id: 'sol-qa', usuarioId: 'applicant', estado: { in: ['RECHAZADA'] } }, select: { id: true } });
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('PENDIENTE');
  });
  const certificate = { ...notice, tipo: 'INFO_GENERAL', usuarioId: 'owner', rol: 'GENERADOR', datos: JSON.stringify({ tipo: 'certificado_ambiental', documentoId: 'doc', actorTipo: 'generador', actorId: 'actor' }) };
  const document = { tipo: 'CERTIFICADO_AMBIENTAL', estado: 'APROBADO', generadorId: 'actor', generador: { usuarioId: 'owner' }, operador: null, transportista: null };
  it('queues the official certificate once and points to the owner-readable record', async () => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'certificados');
    mocks.query.mockResolvedValue([certificate]); mocks.document.mockResolvedValue(document);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0]).toMatchObject({ estado: 'PENDIENTE', id: 'notification:qa-notice' });
    expect(notificationMailContent(certificate)?.html).toContain('/notificaciones/qa-notice');
    expect(notificationMailContent(certificate)?.html).not.toContain('/api/');
  });
  it.each([null, { ...document, estado: 'RECHAZADO' }, { ...document, tipo: 'COMPROBANTE_PAGO' },
    { ...document, generadorId: 'other' }, { ...document, generador: { usuarioId: 'other' } },
    { ...document, operador: { usuarioId: 'owner' } },
  ])('suppresses a missing, revoked, unrelated or ambiguous certificate: %j', async current => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'certificados');
    mocks.document.mockResolvedValue(current); mocks.query.mockResolvedValue([certificate]);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('SUPRIMIDO');
    mocks.notice.mockResolvedValue({ ...certificate, usuario: certificate });
    expect(await queuedNoticeStillEligible('notification:qa-notice', certificate.email)).toBe(false);
  });
  const manifestNotice = { ...notice, tipo: 'MANIFIESTO_FIRMADO', manifiestoId: 'manifest', usuarioId: 'owner', rol: 'TRANSPORTISTA', datos: null };
  it.each(['MANIFIESTO_FIRMADO', 'MANIFIESTO_EN_TRANSITO', 'MANIFIESTO_ENTREGADO', 'MANIFIESTO_RECIBIDO', 'MANIFIESTO_TRATADO', 'MANIFIESTO_RECHAZADO'])('routes %s through the owned notice, without copying free text', tipo => {
    expect(notificationMailContent({ ...manifestNotice, tipo })?.html).toContain('/notificaciones/qa-notice');
    expect(notificationMailContent({ ...manifestNotice, tipo, manifiestoId: null })).toBeNull();
  });
  it('renders proposal and adenda mail from controlled events without copying private notes', () => {
    const proposal = { ...manifestNotice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ tipo: 'propuesta_partes', fase: 'creada', motivo: 'PRIVATE' }) };
    const adenda = { ...manifestNotice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ tipo: 'adenda_manifiesto', evento: 'OBSERVADA', nota: 'PRIVATE' }) };
    expect(notificationMailContent(proposal)?.subject).toContain('pendiente de aprobación');
    expect(notificationMailContent(proposal)?.html).toContain('/notificaciones/qa-notice');
    expect(notificationMailContent(adenda)?.html).toContain('/notificaciones/qa-notice');
    expect(notificationMailContent(adenda)?.html).not.toContain('PRIVATE');
    expect(notificationMailContent({ ...adenda, manifiestoId: null })).toBeNull();
  });

  it('mails a replacement through its limited profile and denies an unrelated carrier', async () => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'manifiestos');
    const handoff = { ...manifestNotice, tipo: 'INFO_GENERAL', datos: '{"tipo":"relevo_transporte","tramoId":"leg","url":"https://untrusted.invalid"}' };
    mocks.manifest.mockResolvedValue({ isDemoData: false, transportista: { usuarioId: 'original' } });
    mocks.notice.mockResolvedValue({ ...handoff, usuario: handoff });
    mocks.carrier.mockResolvedValue({ id: 'carrier' }); mocks.leg.mockResolvedValue({ id: 'own-leg' });
    expect(await queuedNoticeStillEligible('notification:qa-notice', handoff.email)).toBe(true);
    expect(notificationMailContent(handoff)?.html).toContain('/transporte/perfil');
    expect(notificationMailContent(handoff)?.html).not.toContain('untrusted');
    mocks.leg.mockResolvedValue(null);
    expect(await queuedNoticeStillEligible('notification:qa-notice', handoff.email)).toBe(false);
    mocks.manifest.mockResolvedValue({ isDemoData: true });
    mocks.carrier.mockResolvedValue({ id: 'carrier' }); mocks.leg.mockResolvedValue({ id: 'own-leg' });
    expect(await queuedNoticeStillEligible('notification:qa-notice', handoff.email)).toBe(false);
  });
  it.each([null, { isDemoData: true }, { isDemoData: false, transportista: { usuarioId: 'reassigned' } }])('suppresses deleted, synthetic or reassigned manifest %j', async current => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'manifiestos');
    mocks.manifest.mockResolvedValue(current); mocks.notice.mockResolvedValue({ ...manifestNotice, usuario: manifestNotice });
    expect(await queuedNoticeStillEligible('notification:qa-notice', manifestNotice.email)).toBe(false);
  });
  it.each([{ rol: 'TRANSPORTISTA' }, { rol: 'ADMIN_OPERADOR' }, { rol: 'GENERADOR', esInspector: true }])('rechecks legitimate manifest participant or staff %j', async user => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'manifiestos');
    mocks.manifest.mockResolvedValue({ isDemoData: false, transportista: { usuarioId: 'owner' } });
    mocks.notice.mockResolvedValue({ ...manifestNotice, usuario: { ...manifestNotice, ...user } });
    expect(await queuedNoticeStillEligible('notification:qa-notice', manifestNotice.email)).toBe(true);
  });
  it.each([null, { estado: 'RESUELTA', regla: { activa: true } }, { estado: 'PENDIENTE', regla: { activa: false } }])('does not mail a resolved or disabled catalogue case %j', async current => {
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'alertas');
    mocks.alert.mockResolvedValue(current);
    const alert = { ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ familia: 'catalogo_verificable', casoId: 'case', inspeccionId: 'inspection' }) };
    mocks.notice.mockResolvedValue({ ...alert, usuario: alert });
    expect(notificationMailContent(alert)?.family).toBe('alertas');
    expect(await queuedNoticeStillEligible('notification:qa-notice', alert.email)).toBe(false);
  });
  it('queues a verified pending applicant only for their own open application', async () => {
    const pending = { ...notice, activo: false, rol: 'GENERADOR', usuarioId: 'applicant', motivoInactividad: 'PENDIENTE_APROBACION' };
    mocks.query.mockResolvedValue([pending]); mocks.application.mockResolvedValue({ id: 'sol-qa' });
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('PENDIENTE');
    expect(mocks.application).toHaveBeenCalledWith({ where: { id: 'sol-qa', usuarioId: 'applicant', estado: { in: ['BORRADOR', 'ENVIADA', 'EN_REVISION', 'OBSERVADA'] } }, select: { id: true } });
    mocks.notice.mockResolvedValue({ ...pending, usuario: pending });
    expect(await queuedNoticeStillEligible('notification:qa-notice', pending.email)).toBe(true);
  });
  it.each([
    { motivoInactividad: 'SUSPENDIDA' }, { motivoInactividad: null }, { emailVerified: false },
    { notifEmail: false }, { tipo: 'INFO_GENERAL', datos: '{"tipo":"soporte","ticketId":"qa"}' },
  ])('never treats this inactive recipient as an approved applicant: %j', async changes => {
    const pending = { ...notice, activo: false, usuarioId: 'applicant', motivoInactividad: 'PENDIENTE_APROBACION', ...changes };
    mocks.query.mockResolvedValue([pending]); mocks.application.mockResolvedValue({ id: 'sol-qa' });
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('SUPRIMIDO');
    mocks.notice.mockResolvedValue({ ...pending, usuario: pending });
    expect(await queuedNoticeStillEligible('notification:qa-notice', pending.email)).toBe(false);
  });
  it('suppresses a pending applicant if the application closed, disappeared or belongs to someone else', async () => {
    const pending = { ...notice, activo: false, usuarioId: 'applicant', motivoInactividad: 'PENDIENTE_APROBACION' };
    mocks.query.mockResolvedValue([pending]); mocks.application.mockResolvedValue(null);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0].estado).toBe('SUPRIMIDO');
    mocks.notice.mockResolvedValue({ ...pending, usuario: pending });
    expect(await queuedNoticeStillEligible('notification:qa-notice', pending.email)).toBe(false);
  });
  it('rechecks the current recipient before sending an eligible queued notice', async () => {
    mocks.notice.mockResolvedValue({ ...notice, usuario: notice });
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(true);
    expect(mocks.notice).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'qa-notice' } }));
  });
  it.each([{ activo: false }, { emailVerified: false }, { notifEmail: false }, { email: 'changed@example.invalid' }])('does not send after recipient changed: %j', async changes => {
    mocks.notice.mockResolvedValue({ ...notice, usuario: { ...notice, ...changes } });
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(false);
  });
  it('does not reinterpret account-verification or reset mail as optional notifications', async () => {
    expect(await queuedNoticeStillEligible('ordinary-transactional', notice.email)).toBe(true);
    expect(mocks.notice).not.toHaveBeenCalled();
  });
  it('suppresses deleted notices and a family disabled since enqueue', async () => {
    mocks.notice.mockResolvedValue(null);
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(false);
    mocks.notice.mockResolvedValue({ ...notice, usuario: notice });
    vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', 'soporte');
    expect(await queuedNoticeStillEligible('notification:qa-notice', notice.email)).toBe(false);
  });
  it('links a reviewer to the exact application, without embedding applicant free text', () => {
    const mail = notificationMailContent({ ...notice, datos: JSON.stringify({ solicitudId: 'sol-qa', mensaje: 'secreto <img>' }) })!;
    expect(mail.html).toContain('/admin/solicitudes/sol-qa');
    expect(mail.html).not.toContain('secreto');
  });
  it('links a non-admin to their own application, not to administrative routes', () => {
    const mail = notificationMailContent({ ...notice, rol: 'GENERADOR' })!;
    expect(mail.html).toContain('/mi-solicitud'); expect(mail.html).not.toContain('/admin/');
  });
  it.each([
    [{ tipo: 'soporte', ticketId: 'ticket-qa' }, '/soporte/ticket-qa'],
    [{ inspeccionId: 'inspection-qa' }, '/inspecciones/inspection-qa'],
  ])('uses an exact resource action for %j', (data, path) => {
    expect(notificationMailContent({ ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify(data) })!.html).toContain(path);
  });
  it.each(['not-json', 'null', '{}', '{"interno":true,"solicitudId":"hidden"}'])('does not render unsafe/unknown notice %s', datos => {
    expect(notificationMailContent({ ...notice, datos })).toBeNull();
  });
  it.each([{ isDemoData: true }, { modo: 'revision' }, { modo: 'prueba' }])('excludes training context %j', context => {
    expect(notificationMailContent({ ...notice, datos: JSON.stringify({ solicitudId: 'qa', ...context }) })).toBeNull();
  });
  it.each([null, { numeroActa: 'ARP-DEMO-099' }, { numeroActa: 'DEMO/099' }])('does not mail training or missing inspection %j', async inspection => {
    mocks.query.mockResolvedValue([{ ...notice, tipo: 'INFO_GENERAL', datos: JSON.stringify({ inspeccionId: 'qa' }) }]);
    mocks.inspection.mockResolvedValue(inspection);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0]).toMatchObject({ estado: 'SUPRIMIDO', error: 'TRAINING_OR_MISSING_RESOURCE' });
  });
  it('persists a deterministic ID and unique conflict handling, never sends here', async () => {
    expect(await queueCommittedNotificationEmails()).toBe(1);
    expect(mocks.insert).toHaveBeenCalledWith({ skipDuplicates: true, data: [expect.objectContaining({ id: 'notification:qa-notice', estado: 'PENDIENTE', error: 'NOTIFICATION_READY', to: 'qa@example.invalid' })] });
    expect(mocks.query.mock.calls[0][0]).toContain('LEFT JOIN email_queue');
    expect(mocks.query.mock.calls[0][1]).toBeInstanceOf(Date);
  });
  it.each(['activo', 'emailVerified', 'notifEmail'] as const)('suppresses recipients without %s', async field => {
    mocks.query.mockResolvedValue([{ ...notice, [field]: false }]);
    await queueCommittedNotificationEmails();
    expect(mocks.insert.mock.calls[0][0].data[0]).toMatchObject({ estado: 'SUPRIMIDO', error: 'RECIPIENT_NOT_ELIGIBLE' });
  });
  it.each(['disabled', 'no-family', 'no-cutoff'])('does no work with %s', async scenario => {
    if (scenario === 'disabled') vi.stubEnv('DISABLE_EMAILS', 'true');
    if (scenario === 'no-family') vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES', '');
    if (scenario === 'no-cutoff') vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE', '');
    expect(await queueCommittedNotificationEmails()).toBe(0);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe('signature reminder mail freshness',()=>{
  it.each([['SEMANA',24,'RECIBIDO',true],['SEMANA',31,'RECIBIDO',false],['TREINTA_DIAS',31,'RECIBIDO',true],['TREINTA_DIAS',31,'TRATADO',false],['SEMANA',22,'RECIBIDO',false]])('phase %s at day %s in %s -> %s',async(fase,days,estado,expected)=>{
    const fechaFirma=new Date(Date.now()-Number(days)*86400000);
    mocks.manifest.mockResolvedValue({isDemoData:false,fechaFirma,estado,generador:{usuarioId:'actor'}});
    const n={...notice,rol:'GENERADOR',usuarioId:'actor',manifiestoId:'m',tipo:'VENCIMIENTO_PROXIMO',datos:JSON.stringify({tipo:'recordatorio_firma',version:1,fase,fechaFirma:fechaFirma.toISOString()})};
    expect(await notificationSourceEligible(n,'alertas')).toBe(expected);
    expect(notificationMailContent(n)?.html).toContain('30 días desde la firma:</strong>');
  });
  it('rechecks the original company and site for a representative before rendering the private notice link', async () => {
    const fechaFirma = new Date(Date.now() - 24 * 86400000);
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'PRIVATE', establecimientoId: 'site' };
    const n = { ...notice, id: 'signature-notice', usuarioId: 'rep', rol: 'OPERADOR', manifiestoId: 'm', tipo: 'VENCIMIENTO_PROXIMO',
      datos: JSON.stringify({ tipo: 'recordatorio_firma', version: 1, fase: 'SEMANA', fechaFirma: fechaFirma.toISOString(), destino: 'representante', accesosEmpresa: [access] }) };
    mocks.manifest.mockResolvedValue({ isDemoData: false, fechaFirma, estado: 'RECIBIDO', generador: { usuarioId: 'owner' }, operador: { usuarioId: 'other' } });
    mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [access] }]);
    expect(await notificationSourceEligible(n, 'alertas')).toBe(true);
    const content = notificationMailContent(n)!;
    expect(content.html).toContain('/notificaciones/signature-notice'); expect(content.html).not.toContain('PRIVATE');
    mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [{ ...access, establecimientoId: 'other' }] }]);
    expect(await notificationSourceEligible(n, 'alertas')).toBe(false);
    mocks.companyRecipients.mockResolvedValue([]);
    expect(await notificationSourceEligible(n, 'alertas')).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe('operation reminder mail', () => {
  it('recognizes a separately approved personal activity and suppresses it after revocation', async () => {
    vi.stubEnv('ACTOR_MULTIROLE_ENABLED', 'true');
    const planned = new Date(Date.now() + 3600000), fechaDia = planned.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' });
    const n = { ...notice, id: 'owner-multi', usuarioId: 'owner', rol: 'GENERADOR', manifiestoId: 'm', tipo: 'ALERTA_SISTEMA',
      datos: JSON.stringify({ tipo: 'recordatorio_operacion', version: 1, modalidad: 'FIJO', fechaDia }) };
    mocks.manifest.mockResolvedValue({ isDemoData: false, estado: 'APROBADO', modalidad: 'FIJO', fechaEstimadaRetiro: planned,
      generador: { id: 'other-g', activo: true, usuarioId: 'other' }, operador: { id: 'own-o', activo: true, usuarioId: 'owner' } });
    mocks.user.mockResolvedValue({ id: 'owner', rol: 'GENERADOR', activo: true, emailVerified: true,
      generador: { id: 'own-g', activo: true }, operador: { id: 'own-o', activo: true }, transportista: null });
    mocks.applicationContexts.mockResolvedValue([{ tipoActor: 'OPERADOR', operadorId: 'own-o' }]);
    expect(await notificationSourceEligible(n, 'alertas')).toBe(true);
    expect(notificationMailContent(n)?.html).toContain('/notificaciones/owner-multi');
    mocks.applicationContexts.mockResolvedValue([]); expect(await notificationSourceEligible(n, 'alertas')).toBe(false);
    vi.stubEnv('ACTOR_MULTIROLE_ENABLED', 'false'); expect(await notificationSourceEligible(n, 'alertas')).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(['FIJO', 'IN_SITU'])('keeps %s context and suppresses changed, closed or revoked cases', async modalidad => {
    const planned = new Date(Date.now() + 3600000);
    const fechaDia = planned.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' });
    const access = { empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'PRIVATE', establecimientoId: 'site' };
    const n = { ...notice, id: 'operation-notice', usuarioId: 'rep', rol: 'OPERADOR', manifiestoId: 'm', tipo: 'ALERTA_SISTEMA',
      datos: JSON.stringify({ tipo: 'recordatorio_operacion', version: 1, modalidad, fechaDia, destino: 'representante', accesosEmpresa: [access] }) };
    const manifest = { isDemoData: false, estado: 'APROBADO', modalidad, fechaEstimadaRetiro: planned,
      generador: { usuarioId: 'owner' }, operador: { usuarioId: 'other' } };
    mocks.manifest.mockResolvedValue(manifest); mocks.companyRecipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [access] }]);
    expect(await notificationSourceEligible(n, 'alertas')).toBe(true);
    const content = notificationMailContent(n)!; expect(content.html).toContain('/notificaciones/operation-notice');
    expect(content.html).toContain(fechaDia); expect(content.html).not.toContain('PRIVATE');
    if (modalidad === 'IN_SITU') expect(mailText(content.html)).toMatch(/No hay retiro, traslado ni GPS/i);
    for (const changed of [{ estado: 'EN_TRANSITO' }, { modalidad: modalidad === 'FIJO' ? 'IN_SITU' : 'FIJO' },
      { fechaEstimadaRetiro: new Date(planned.getTime() + 86400000) }, { fechaEstimadaRetiro: new Date(Date.now() - 1000) }, { isDemoData: true }]) {
      mocks.manifest.mockResolvedValue({ ...manifest, ...changed }); expect(await notificationSourceEligible(n, 'alertas')).toBe(false);
    }
    const far = new Date(Date.now() + 25 * 3600000);
    mocks.manifest.mockResolvedValue({ ...manifest, fechaEstimadaRetiro: far });
    expect(await notificationSourceEligible({ ...n, datos: JSON.stringify({ ...JSON.parse(n.datos), fechaDia: far.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' }) }) }, 'alertas')).toBe(false);
    mocks.manifest.mockResolvedValue(manifest); mocks.companyRecipients.mockResolvedValue([]);
    expect(await notificationSourceEligible(n, 'alertas')).toBe(false);
    expect(notificationMailContent({ ...n, datos: JSON.stringify({ tipo: 'recordatorio_operacion', version: 1, modalidad, fechaDia: '<script>' }) })).toBeNull();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

it('rechecks renewal representative access and decision before future mail without sending', async () => {
  const n = { ...notice, usuarioId: 'member', rol: 'TRANSPORTISTA', tipo: 'MODIFICACION_APROBADA', datos: JSON.stringify({ renovacionId: 'r' }) };
  mocks.renewal.mockResolvedValue({ id: 'r', estado: 'APROBADA', tipoActor: 'OPERADOR', operadorId: 'o', operador: { usuarioId: 'owner' } });
  renewalRecipients.mockResolvedValue(['member']);
  expect(await notificationSourceEligible(n, 'padron')).toBe(true);
  renewalRecipients.mockResolvedValue([]);
  expect(await notificationSourceEligible(n, 'padron')).toBe(false);
  mocks.renewal.mockResolvedValue({ id: 'r', estado: 'RECHAZADA', tipoActor: 'OPERADOR', operador: { usuarioId: 'owner' } });
  renewalRecipients.mockResolvedValue(['member']);
  expect(await notificationSourceEligible(n, 'padron')).toBe(false);
  expect(mocks.insert).not.toHaveBeenCalled();
});
