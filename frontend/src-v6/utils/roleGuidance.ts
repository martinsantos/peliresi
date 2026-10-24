export type GuideStep = { title: string; desc: string; icon: 'actors' | 'manifest' | 'approve' | 'trip' | 'notice' | 'certificate' | 'help' };
const proposals: GuideStep = { icon: 'approve', title: 'Proponer y aprobar entre las partes', desc: 'Generador, transportista u operador pueden proponer un manifiesto. Cada parte revisa desde su cuenta; sólo con todas las aprobaciones se habilita la coordinación.' };
export const ROLE_GUIDANCE: Record<string, GuideStep[]> = {
  GENERADOR: [
    { icon: 'manifest', title: 'Tu trabajo como generador', desc: 'Creá una propuesta o revisá las que te involucran. En Manifiestos pendientes ves qué requiere tu aprobación y qué está esperando a otra parte.' },
    proposals,
    { icon: 'notice', title: 'Seguí la carga y sus cambios', desc: 'La campana abre el manifiesto o la adenda precisa. Revisá las diferencias informadas por el operador; leer el aviso no equivale a aprobar.' },
    { icon: 'certificate', title: 'Recibí las certificaciones', desc: 'Cuando el operador firma y libera una parcial o final, recibís un aviso. Desde Certificaciones podés descargar el documento emitido.' },
  ],
  TRANSPORTISTA: [
    { icon: 'trip', title: 'Tus viajes, juntos y ordenados', desc: 'Podés proponer manifiestos y aprobar los que te asignan. En Cargas en este móvil encontrás tus viajes simultáneos y los relevos aceptados.' },
    proposals,
    { icon: 'trip', title: 'Retiro físico y ubicación', desc: 'Confirmá el retiro cuando recibas la carga. Activá Ubicación y verificá el permiso y el estado GPS. Si falla, reintentá; la ubicación no se garantiza con la app cerrada.' },
    { icon: 'notice', title: 'Incidentes, relevos y entrega', desc: 'Registrá la avería y el traspaso desde el viaje que corresponda. Al llegar confirmá la entrega; el operador confirma la recepción y continúa el tratamiento.' },
  ],
  OPERADOR: [
    { icon: 'manifest', title: 'Desde la propuesta hasta la certificación', desc: 'También podés crear un manifiesto. Manifiestos pendientes reúne aprobaciones, cargas por recibir, tratamientos y certificaciones pendientes.' },
    proposals,
    { icon: 'notice', title: 'Recibir, pesar y documentar hallazgos', desc: 'Registrá el peso recibido y el tratamiento. Si la carga difiere, documentá el hallazgo dentro de la adenda y seguí la revisión de las partes.' },
    { icon: 'certificate', title: 'Firmá y liberá cada certificación', desc: 'Emití parciales por lo tratado. La final requiere cierre y adendas resueltas. Cerrar el tratamiento no emite la final: vos revisás, firmás y publicás; las partes reciben el aviso.' },
  ],
  INSPECTOR: [
    { icon: 'manifest', title: 'Tu trabajo como inspector', desc: 'En Inspecciones encontrás tus visitas asignadas y los expedientes que podés continuar.' },
    { icon: 'notice', title: 'Las asignaciones llegan a la campana', desc: 'Cada aviso abre el expediente asignado. No se envía correo ni push por esta asignación.' },
    { icon: 'approve', title: 'En campo y en seguimiento', desc: 'Iniciá la visita en el lugar y registrá lo observado. En el expediente consultá requerimientos, respuestas, plazos y quién debe actuar.' },
    { icon: 'help', title: 'Guardá y retomá', desc: 'Revisá la confirmación de guardado. Una copia en el dispositivo no significa que el servidor la recibió. Ayuda explica la pantalla actual y permite contactar soporte.' },
  ],
  ADMIN: [
    { icon: 'actors', title: 'Sos Administrador General del Sistema', desc: 'Revisá altas, actividades y representantes desde sus trámites. Una razón social puede tener varios roles y hasta dos personas en total, incluida la titular.' },
    { icon: 'approve', title: 'Decisiones con contexto', desc: 'Revisá los avisos de altas, adendas y hallazgos. En PSIP seguí la agenda, los plazos y la parte responsable de responder.' },
    { icon: 'trip', title: 'Centro de Control', desc: 'Consultá manifiestos en tránsito, varios viajes de un transporte y relevos. El mapa muestra las ubicaciones recibidas y su antigüedad.' },
    { icon: 'help', title: 'Ayuda en cada pantalla', desc: 'El botón Ayuda explica el próximo paso y abre el manual correspondiente. Soporte permite enviar un reporte revisado por vos.' },
  ],
  AUDITOR: [
    { icon: 'manifest', title: 'Tu espacio de consulta', desc: 'Consultá los registros habilitados para tu cuenta. Este perfil no crea manifiestos ni aprueba por las partes.' },
    { icon: 'notice', title: 'Revisá la trazabilidad', desc: 'Contrastá el estado actual con sus eventos y documentos. Un aviso informa un hecho; no reemplaza la decisión registrada.' },
  ],
};
for (const [role, actors] of Object.entries({ ADMIN_GENERADOR: 'generadores', ADMIN_TRANSPORTISTA: 'transportistas', ADMIN_OPERADOR: 'operadores' })) {
  ROLE_GUIDANCE[role] = [
    { icon: 'actors', title: 'Administración de ' + actors, desc: 'Revisá altas, documentación y modificaciones de tu sector. La actividad aprobada y los permisos determinan qué puede hacer cada persona.' },
    { icon: 'approve', title: 'Tu revisión de adendas', desc: 'Revisá las corrientes nuevas que requieran autoridad. Registrá la decisión y el motivo; la revisión de cada parte conserva su propia trazabilidad.' },
    { icon: 'notice', title: 'Pendientes y seguimiento', desc: 'La agenda y la campana te llevan al caso. Consultá su estado actual antes de decidir; leer un aviso no completa el trámite.' },
  ];
}
export function presentationRole(role: string, inspector = false) { return inspector && !role.startsWith('ADMIN') ? 'INSPECTOR' : role; }
