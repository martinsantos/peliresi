#!/usr/bin/env python3
"""
update-manual-screenshots.py
Inserts inline CU screenshots + Section 13 (Workflow Flows) into docs/manual/index.html.
Run from the project root or from anywhere with correct paths.
"""

import os
import re
import sys

MANUAL = os.path.join(os.path.dirname(__file__), '../../docs/manual/index.html')

# ── CU → (screenshot_path, caption) ─────────────────────────────────────────
CU_SHOTS = {
    'CU-A01': ('screenshots/desktop/23_admin_usuarios.png',                    'Gestión de Usuarios — tabla con 7 roles e impersonación'),
    'CU-A02': ('screenshots/desktop/64_generador_detalle.png',                 'Detalle de Generador'),
    'CU-A03': ('screenshots/desktop/63_transportista_detalle_flota.png',       'Detalle Transportista — flota y conductores'),
    'CU-A04': ('screenshots/desktop/65_operador_detalle.png',                  'Detalle Operador'),
    'CU-A05': ('screenshots/desktop/32_admin_catalogo_residuos.png',           'Catálogo de Residuos'),
    'CU-A06': ('screenshots/desktop/33_admin_tratamientos_grid.png',           'Catálogo de Tratamientos'),
    'CU-A07': ('screenshots/desktop/04_dashboard_admin.png',                   'Dashboard Admin — KPIs y manifiestos recientes'),
    'CU-A08': ('screenshots/desktop/05_centro_control.png',                    'Centro de Control — mapa y viajes activos'),
    'CU-A09': ('screenshots/desktop/17_reportes_manifiestos.png',              'Centro de Reportes — 8 pestañas'),
    'CU-A10': ('screenshots/desktop/35_admin_auditoria.png',                   'Auditoría del Sistema'),
    'CU-A11': ('screenshots/desktop/16_alertas_timeline.png',                  'Alertas — Timeline por criticidad'),
    'CU-A12': ('screenshots/desktop/36_carga_masiva.png',                      'Carga Masiva CSV'),
    'CU-A13': ('screenshots/desktop/34_admin_vehiculos.png',                   'Gestión de Vehículos'),
    'CU-A14': ('screenshots/desktop/37_configuracion_general.png',             'Configuración del Sistema'),
    'CU-A15': ('screenshots/desktop/61_centro_control_viajes.png',             'Anomalías — Centro de Control Viajes'),
    'CU-A16': ('screenshots/desktop/23_admin_usuarios.png',                    'Impersonación — ícono ojo naranja en tabla de usuarios'),
    'CU-A17': ('screenshots/desktop/24_admin_usuario_crear_modal.png',         'Sub-roles — modal con 7 opciones de rol'),
    'CU-A18': ('screenshots/desktop/25_busqueda_global_cmd_k.png',             'Búsqueda Global Cmd+K'),
    'CU-A19': ('screenshots/desktop/38_configuracion_notificaciones_email.png','Preferencias de Email por usuario'),
    # Generador
    'CU-G01': ('screenshots/desktop/14_nuevo_manifiesto_paso1.png',            'Nuevo Manifiesto — Paso 1: datos generales'),
    'CU-G02': ('screenshots/desktop/53_manifiesto_borrador_detalle.png',       'Firmar Manifiesto — botón Aprobar en estado BORRADOR'),
    'CU-G03': ('screenshots/desktop/48_manifiestos_generador.png',             'Mis Manifiestos — lista filtrada por generador'),
    'CU-G04': ('screenshots/desktop/53_manifiesto_borrador_detalle.png',       'Detalle de Manifiesto — acciones y timeline'),
    'CU-G05': ('screenshots/desktop/10_manifiestos_en_transito.png',           'Seguimiento — manifiestos EN_TRANSITO'),
    'CU-G06': ('screenshots/desktop/48_manifiestos_generador.png',             'Lista de Manifiestos — acción Cancelar disponible'),
    'CU-G07': ('screenshots/desktop/57_manifiesto_tratado_detalle.png',        'Descargar PDF — manifiesto TRATADO'),
    'CU-G08': ('screenshots/desktop/57_manifiesto_tratado_detalle.png',        'Descargar Certificado de Disposición Final'),
    'CU-G09': ('screenshots/desktop/47_dashboard_generador.png',               'Dashboard Generador — KPIs propios'),
    'CU-G10': ('screenshots/desktop/52_reportes_operador.png',                 'Reportes — filtrados por empresa'),
    'CU-G11': ('screenshots/desktop/37_configuracion_general.png',             'Notificaciones — configuración de alertas'),
    'CU-G12': ('screenshots/desktop/39_mi_perfil.png',                         'Mi Perfil — datos personales y contraseña'),
    # Transportista
    'CU-T01': ('screenshots/desktop/45_manifiestos_transportista.png',         'Manifiestos Asignados al Transportista'),
    'CU-T02': ('screenshots/desktop/54_manifiesto_aprobado_detalle.png',       'Confirmar Retiro — estado APROBADO'),
    'CU-T03': ('screenshots/mobile/M22_viaje_gps_activo_mobile.png',           'GPS en Tiempo Real — PWA móvil'),
    'CU-T04': ('screenshots/mobile/M22_viaje_gps_activo_mobile.png',           'Pausar/Reanudar Tracking GPS'),
    'CU-T05': ('screenshots/mobile/M22_viaje_gps_activo_mobile.png',           'Registrar Incidente durante el viaje'),
    'CU-T06': ('screenshots/desktop/54_manifiesto_aprobado_detalle.png',       'Confirmar Entrega — acciones en detalle'),
    'CU-T07': ('screenshots/desktop/46_escaner_qr_desktop.png',                'Escáner QR — verificación de manifiesto'),
    'CU-T08': ('screenshots/desktop/41_dashboard_transportista.png',           'Dashboard Transportista — viajes y KPIs'),
    'CU-T09': ('screenshots/desktop/44_transporte_perfil_historial.png',       'Historial de Viajes completados'),
    'CU-T10': ('screenshots/desktop/37_configuracion_general.png',             'Notificaciones Transportista'),
    'CU-T11': ('screenshots/desktop/43_transporte_perfil_tab_info.png',        'Perfil Transportista — datos de empresa'),
    'CU-T12': ('screenshots/desktop/63_transportista_detalle_flota.png',       'Gestión Autónoma de Flota — vehículos y conductores'),
    # Operador
    'CU-O01': ('screenshots/desktop/51_manifiestos_operador.png',              'Manifiestos Entrantes — lista ENTREGADO'),
    'CU-O02': ('screenshots/desktop/55_manifiesto_entregado_detalle.png',      'Confirmar Recepción — estado ENTREGADO'),
    'CU-O03': ('screenshots/desktop/56_manifiesto_recibido_detalle.png',       'Registrar Pesaje — estado RECIBIDO'),
    'CU-O04': ('screenshots/desktop/55_manifiesto_entregado_detalle.png',      'Aceptar Carga — estado ENTREGADO'),
    'CU-O05': ('screenshots/desktop/55_manifiesto_entregado_detalle.png',      'Rechazar Carga — motivo requerido'),
    'CU-O06': ('screenshots/desktop/56_manifiesto_recibido_detalle.png',       'Registrar Tratamiento — avance a EN_TRATAMIENTO'),
    'CU-O07': ('screenshots/desktop/57_manifiesto_tratado_detalle.png',        'Cerrar Manifiesto — estado final TRATADO'),
    'CU-O08': ('screenshots/desktop/57_manifiesto_tratado_detalle.png',        'Generar Certificado de Disposición Final'),
    'CU-O09': ('screenshots/desktop/50_dashboard_operador.png',                'Dashboard Operador — KPIs de planta'),
    'CU-O10': ('screenshots/desktop/52_reportes_operador.png',                 'Reportes Operador — tratamientos y volúmenes'),
    'CU-O11': ('screenshots/desktop/37_configuracion_general.png',             'Notificaciones Operador'),
    'CU-O12': ('screenshots/desktop/39_mi_perfil.png',                         'Mi Perfil Operador'),
    # Sistema
    'CU-S01': ('screenshots/desktop/66_verificar_manifiesto_detalle.png',      'Verificación Pública QR — sin autenticación'),
    'CU-S02': ('screenshots/desktop/37_configuracion_general.png',             'Notificaciones automáticas del sistema'),
    'CU-S03': ('screenshots/desktop/58_manifiesto_timeline.png',               'Timeline de Auditoría — eventos inmutables'),
    'CU-S04': ('screenshots/desktop/05_centro_control.png',                    'Tracking GPS almacenado — ruta del viaje'),
    'CU-S05': ('screenshots/desktop/61_centro_control_viajes.png',             'Detección de Anomalías en transporte'),
    'CU-S06': ('screenshots/desktop/60_alertas_reglas.png',                    'Reglas de Alertas — configuración'),
    'CU-S07': ('screenshots/desktop/67_centro_control_kpis.png',               'KPIs en Tiempo Real — Centro de Control'),
    'CU-S08': ('screenshots/mobile/M16_configuracion_mobile.png',              'Sincronización Offline — PWA móvil'),
    'CU-S09': ('screenshots/desktop/37_configuracion_general.png',             'Notificaciones Push'),
    'CU-S10': ('screenshots/desktop/53_manifiesto_borrador_detalle.png',       'Firma Digital — aprobación de manifiesto'),
    'CU-S11': ('screenshots/desktop/17_reportes_manifiestos.png',              'Integración API REST — datos en tiempo real'),
}

# ── CSS to inject ─────────────────────────────────────────────────────────────
EXTRA_CSS = """
/* Screenshots inline en CUs */
.cu-screenshot {
  margin: 0.75rem 0 1.25rem;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.cu-screenshot a { display: block; }
.cu-screenshot img {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  object-position: top;
  display: block;
  transition: transform 0.2s;
}
.cu-screenshot:hover img { transform: scale(1.02); }
.cu-screenshot-caption {
  background: #f8fafc;
  padding: 0.4rem 0.75rem;
  font-size: 0.72rem;
  color: #64748b;
  border-top: 1px solid #e2e8f0;
}

/* Flujos de trabajo visuales */
.wf-profile { margin-bottom: 3rem; }
.wf-step {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
  align-items: flex-start;
}
.wf-step-num {
  flex-shrink: 0;
  width: 38px; height: 38px;
  border-radius: 50%;
  background: #0D8A4F;
  color: white;
  font-weight: 700;
  font-size: 1rem;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 6px rgba(13,138,79,0.3);
}
.wf-step-body { flex: 1; min-width: 0; }
.wf-step-body h4 { margin: 0 0 0.4rem; font-size: 1rem; color: #1e293b; }
.wf-step-body p { margin: 0 0 0.75rem; color: #475569; font-size: 0.9rem; line-height: 1.6; }
.wf-step-img {
  width: 100%;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  max-height: 320px;
  object-fit: cover;
  object-position: top;
}
.wf-step-img-mobile {
  max-width: 260px;
  max-height: 480px;
  border-radius: 18px;
  border: 3px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  display: block;
}
.wf-role-badge {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: #f0fdf4; color: #166534;
  border: 1px solid #bbf7d0;
  border-radius: 100px; padding: 0.25rem 0.75rem;
  font-size: 0.8rem; font-weight: 600;
  margin-bottom: 1rem;
}
.wf-tip {
  background: #eff6ff; border-left: 3px solid #3b82f6;
  padding: 0.6rem 1rem; border-radius: 0 6px 6px 0;
  font-size: 0.85rem; color: #1e40af; margin: 0.5rem 0 0;
}
@media (max-width: 768px) {
  .wf-step { flex-direction: column; }
  .wf-step-num { width: 30px; height: 30px; font-size: 0.85rem; }
}
"""

# ── Section 13 HTML ───────────────────────────────────────────────────────────
def make_wf_step(num, title, text, img_path, mobile=False, tip=None):
    img_class = 'wf-step-img-mobile' if mobile else 'wf-step-img'
    tip_html = f'\n<div class="wf-tip">{tip}</div>' if tip else ''
    return f'''<div class="wf-step">
  <div class="wf-step-num">{num}</div>
  <div class="wf-step-body">
    <h4>{title}</h4>
    <p>{text}</p>
    <a href="{img_path}" target="_blank"><img src="{img_path}" alt="{title}" loading="lazy" class="{img_class}"></a>{tip_html}
  </div>
</div>'''

def section13():
    d = 'screenshots/desktop'
    m = 'screenshots/mobile'

    admin_steps = [
        make_wf_step(1,  'Acceso al Sistema',              'Login con credenciales DGFA. Panel de acceso rápido con roles demo disponible para pruebas.',                                                     f'{d}/01_login.png'),
        make_wf_step(2,  'Dashboard — Visión General',      '7 KPIs principales: borradores, aprobados, en tránsito, entregados, recibidos, tratados, total. Tabla de manifiestos recientes con links directos. Auto-refresco cada 30 segundos.',  f'{d}/04_dashboard_admin.png'),
        make_wf_step(3,  'Centro de Control — Mapa en Vivo','Mapa Leaflet con capas: generadores (violeta), transportistas (naranja), operadores (azul), viajes activos (rojo pulsante). Presets de fecha: Hoy, 7d, 30d, 90d. Auto-refresco 30s.',  f'{d}/05_centro_control.png'),
        make_wf_step(4,  'Gestión de Usuarios',             'Crear, editar, activar/desactivar usuarios. Asignar 7 roles disponibles. Ícono ojo naranja para impersonación (Acceso Comodín). La columna de acciones muestra solo opciones permitidas.', f'{d}/23_admin_usuarios.png'),
        make_wf_step(5,  'Búsqueda Global Cmd+K',           'Atajo Cmd+K (Mac) / Ctrl+K (Windows) desde cualquier página. Resultados agrupados por tipo: manifiestos, actores, usuarios. Chips de filtro por estado de manifiesto.',               f'{d}/25_busqueda_global_cmd_k.png',
                         tip='Tip: Escribe el número de manifiesto (ej: 2026-000042) para ir directamente al detalle.'),
        make_wf_step(6,  'Centro de Reportes',              '8 pestañas: Manifiestos, Residuos, Transporte, Establecimientos, Operadores, Departamentos, Mapa de Actores. Exportar a PDF client-side (jsPDF) o CSV (hasta 10.000 filas).',           f'{d}/17_reportes_manifiestos.png'),
        make_wf_step(7,  'Gestión de Alertas',              'Timeline con tarjetas coloreadas por criticidad (crítica, alta, media, baja). Tab Reglas para configurar alertas automáticas por condición: vencimiento, demora, anomalía.',           f'{d}/16_alertas_timeline.png'),
        make_wf_step(8,  'Carga Masiva de Datos',           'Importación CSV de generadores, transportistas y operadores. Descarga de plantillas con formato exacto. Reporte por fila de éxitos y errores con descripción del problema.',           f'{d}/36_carga_masiva.png'),
        make_wf_step(9,  'Auditoría del Sistema',           'Registro inmutable de todas las acciones: quién hizo qué, cuándo y desde qué IP. Filtros por usuario, acción y rango de fechas. No se puede modificar ni eliminar.',                   f'{d}/35_admin_auditoria.png'),
        make_wf_step(10, 'Configuración y Sub-roles',       'Delegar administración con roles ADMIN_GENERADOR, ADMIN_TRANSPORTISTA, ADMIN_OPERADOR. Cada sub-rol ve solo su dominio en el menú lateral sin acceso a otros módulos.',                f'{d}/24_admin_usuario_crear_modal.png'),
    ]

    generador_steps = [
        make_wf_step(1, 'Acceso al Sistema',             'Login con credenciales de generador. El sistema carga automáticamente con filtrado por tu generadorId. Solo ves tus propios manifiestos.',                                          f'{d}/01_login.png'),
        make_wf_step(2, 'Dashboard — Mis Manifiestos',   'Vista rápida de manifiestos por estado. Acciones rápidas: Nuevo Manifiesto, Ver Reportes. Los manifiestos en tránsito se destacan para seguimiento inmediato.',                     f'{d}/47_dashboard_generador.png'),
        make_wf_step(3, 'Crear Manifiesto — Paso 1',     'Seleccionar generador de la lista. El sistema auto-completa CUIT, teléfono, domicilio y número de habilitación al seleccionar. Seleccionar tipo de residuo del catálogo Ley 24.051.', f'{d}/14_nuevo_manifiesto_paso1.png'),
        make_wf_step(4, 'Agregar Residuos',              'Seleccionar tipo de residuo del catálogo (codificación Y conforme Ley 24.051). Ingresar cantidad, unidad y descripción detallada. Múltiples residuos por manifiesto.',              f'{d}/62_manifiesto_nuevo_paso3_residuos.png'),
        make_wf_step(5, 'Seleccionar Transportista y Operador', 'Elegir transportista habilitado y operador de destino. El sistema muestra solo actores con habilitaciones vigentes. Se auto-completa información de contacto.',             f'{d}/15_nuevo_manifiesto_paso2.png'),
        make_wf_step(6, 'Firmar y Aprobar',              'El manifiesto en estado BORRADOR muestra el botón "Firmar/Aprobar". Al firmar, el estado cambia a APROBADO y se notifica automáticamente al transportista asignado.',              f'{d}/53_manifiesto_borrador_detalle.png'),
        make_wf_step(7, 'Seguimiento del Transporte',    'Ver posición GPS del vehículo en tiempo real desde la página del manifiesto. Timeline con cada evento del ciclo: retiro, incidentes, entrega, tratamiento.',                      f'{d}/10_manifiestos_en_transito.png'),
        make_wf_step(8, 'Manifiesto TRATADO — Descarga', 'Una vez completado el ciclo, descargar PDF del manifiesto (Ley 24.051) o el Certificado de Tratamiento y Disposición Final. Ambos documentos tienen membrete oficial SITREP.',    f'{d}/57_manifiesto_tratado_detalle.png'),
        make_wf_step(9, 'Mis Reportes',                  'Reportes filtrados automáticamente por tu empresa: por estado, tipo de residuo, período. Gráficos interactivos (Recharts). Exportar a PDF/CSV para auditorías internas.',          f'{d}/52_reportes_operador.png'),
    ]

    transportista_steps = [
        make_wf_step(1,  'Acceso — Web o PWA',            'Login desde desktop o desde la PWA instalada en el celular. La PWA funciona offline y sincroniza datos cuando vuelve la conexión.',                                                f'{d}/01_login.png'),
        make_wf_step(2,  'Dashboard — Viajes Pendientes',  'El dashboard muestra un banner con viajes activos (EN_TRANSITO) con botón directo "Ir al viaje". También lista los viajes APROBADO pendientes de tomar.',                        f'{d}/41_dashboard_transportista.png'),
        make_wf_step(3,  'Ver Manifiestos APROBADO',       'Lista de manifiestos asignados al transportista. Los APROBADO están destacados indicando que hay un viaje listo para retirar.',                                                   f'{d}/45_manifiestos_transportista.png'),
        make_wf_step(4,  'Tomar Viaje (desde móvil)',      'En el perfil del transportista, la pestaña Viaje lista los manifiestos APROBADO. El botón "Tomar Viaje" navega a la pantalla de control del viaje.',                            f'{m}/M21_tomar_viaje_mobile.png', mobile=True),
        make_wf_step(5,  'Confirmar Retiro',               'En el detalle del manifiesto APROBADO, "Confirmar Retiro" registra la fecha y hora de retiro y cambia el estado a EN_TRANSITO. El GPS comienza a registrar posición.',           f'{d}/54_manifiesto_aprobado_detalle.png'),
        make_wf_step(6,  'GPS Activo durante el Viaje',    'La pantalla de viaje en curso muestra el mapa con la ruta, velocidad actual, tiempo transcurrido y controles: Pausar, Registrar Incidente, Confirmar Entrega.',                  f'{m}/M22_viaje_gps_activo_mobile.png', mobile=True,
                         tip='El sistema envía la posición GPS cada 30 segundos. Los puntos se guardan aunque no haya conexión (hasta 5 puntos en cola offline).'),
        make_wf_step(7,  'Registrar Incidente (si aplica)','Si ocurre una avería o problema durante el traslado, "Registrar Incidente" crea un evento en el timeline del manifiesto. No cambia el estado — el viaje continúa.',             f'{m}/M22_viaje_gps_activo_mobile.png', mobile=True),
        make_wf_step(8,  'Escanear QR en Destino',         'Al llegar a la planta operadora, escanear el QR del manifiesto para verificar la identidad del cargamento. Compatible con cámara de iOS y Android.',                              f'{d}/46_escaner_qr_desktop.png'),
        make_wf_step(9,  'Confirmar Entrega',               '"Confirmar Entrega" registra fecha/hora de entrega y cambia el estado a ENTREGADO. El operador de destino es notificado automáticamente.',                                      f'{d}/54_manifiesto_aprobado_detalle.png'),
        make_wf_step(10, 'Gestionar mi Flota',              'Desde el perfil de transportista, gestionar vehículos (patente, habilitación, vencimiento) y conductores (DNI, licencia) de forma autónoma sin intervención del administrador.', f'{d}/63_transportista_detalle_flota.png'),
    ]

    operador_steps = [
        make_wf_step(1, 'Acceso al Sistema',           'Login con credenciales de operador/planta. El sistema carga automáticamente filtrado por tu operadorId. Solo ves los manifiestos destinados a tu planta.',                         f'{d}/01_login.png'),
        make_wf_step(2, 'Dashboard — Entrantes',       'El dashboard muestra manifiestos ENTREGADO pendientes de recepción y KPIs del período: volumen total, tasa de tratamiento, tiempo promedio de procesamiento.',                    f'{d}/50_dashboard_operador.png'),
        make_wf_step(3, 'Ver Manifiestos ENTREGADO',   'Lista filtrada por tu operadorId. Los manifiestos ENTREGADO aparecen destacados en naranja indicando acción requerida. Click en el número para ver el detalle completo.',          f'{d}/51_manifiestos_operador.png'),
        make_wf_step(4, 'Confirmar Recepción',         'Al llegar el transportista, "Confirmar Recepción" cambia el estado a RECIBIDO. El sistema registra fecha, hora y usuario que confirmó. El generador es notificado.',              f'{d}/55_manifiesto_entregado_detalle.png'),
        make_wf_step(5, 'Registrar Pesaje Real',       'Ingresar el peso real por tipo de residuo. El sistema compara con el peso declarado por el generador y alerta automáticamente sobre discrepancias mayores al 10%.',              f'{d}/56_manifiesto_recibido_detalle.png'),
        make_wf_step(6, 'Rechazar Carga (si aplica)',  'Si la carga no cumple los requisitos (embalaje inadecuado, residuo no autorizado), "Rechazar Carga" cambia el estado a RECHAZADO. El motivo queda registrado en el timeline.',   f'{d}/55_manifiesto_entregado_detalle.png'),
        make_wf_step(7, 'Registrar Tratamiento',       'Seleccionar el tipo de tratamiento aplicado del catálogo autorizado para la planta. El estado avanza a EN_TRATAMIENTO. Se pueden registrar múltiples tratamientos por manifiesto.', f'{d}/56_manifiesto_recibido_detalle.png'),
        make_wf_step(8, 'Cerrar Manifiesto',           '"Cerrar Manifiesto" finaliza el ciclo: estado TRATADO. El sistema notifica automáticamente al generador, al transportista y al administrador DGFA.',                              f'{d}/57_manifiesto_tratado_detalle.png'),
        make_wf_step(9, 'Certificado de Disposición', 'PDF oficial con membrete SITREP, datos completos del tratamiento, firma del operador responsable, conforme Ley 24.051 y Decreto 831/93. Descargable por todos los actores.',       f'{d}/57_manifiesto_tratado_detalle.png',
                        tip='El Certificado de Disposición Final es el documento legal que acredita el tratamiento correcto de los residuos peligrosos ante organismos de control.'),
    ]

    def steps_html(steps):
        return '\n'.join(steps)

    return f'''
<section id="flujos" data-role="all">
<h2>13. Flujos de Trabajo Visuales por Perfil</h2>
<p class="section-intro">Guía paso a paso del flujo de trabajo de cada perfil de usuario, con capturas reales del sistema en cada etapa del proceso.</p>

<!-- Flujo Admin -->
<div class="wf-profile" id="flujo-admin">
<h3>13.1 Flujo del Administrador DGFA</h3>
<div class="wf-role-badge">&#128737; Administrador DGFA</div>
{steps_html(admin_steps)}
</div>

<!-- Flujo Generador -->
<div class="wf-profile" id="flujo-generador">
<h3>13.2 Flujo del Generador de Residuos</h3>
<div class="wf-role-badge">&#127981; Generador</div>
{steps_html(generador_steps)}
</div>

<!-- Flujo Transportista -->
<div class="wf-profile" id="flujo-transportista">
<h3>13.3 Flujo del Transportista</h3>
<div class="wf-role-badge">&#128666; Transportista</div>
{steps_html(transportista_steps)}
</div>

<!-- Flujo Operador -->
<div class="wf-profile" id="flujo-operador">
<h3>13.4 Flujo del Operador de Tratamiento</h3>
<div class="wf-role-badge">&#9878; Operador</div>
{steps_html(operador_steps)}
</div>

</section>
'''

# ── Sidebar nav entry for Section 13 ─────────────────────────────────────────
SIDEBAR_NAV_ADDITION = '''  <div class="nav-section-title">13. Flujos por Perfil</div>
  <a href="#flujos" class="nav-link">Flujos de Trabajo</a>
  <a href="#flujo-admin" class="nav-link level-2">Administrador</a>
  <a href="#flujo-generador" class="nav-link level-2">Generador</a>
  <a href="#flujo-transportista" class="nav-link level-2">Transportista</a>
  <a href="#flujo-operador" class="nav-link level-2">Operador</a>
</nav>'''

# ── cu_screenshot block ───────────────────────────────────────────────────────
def cu_screenshot_html(path, caption):
    return (
        f'<div class="cu-screenshot">'
        f'<a href="{path}" target="_blank">'
        f'<img src="{path}" alt="{caption}" loading="lazy"></a>'
        f'<div class="cu-screenshot-caption">{caption}</div>'
        f'</div>\n'
    )

# ── Main processing ───────────────────────────────────────────────────────────
def process(html: str) -> str:

    # 1. Inject extra CSS before </style>
    html = html.replace('</style>', EXTRA_CSS + '</style>', 1)

    # 2. Insert CU screenshots into collapsible bodies
    # Strategy: find each "CU-Xxx:" in a collapsible-header line, then find
    # the next <div class="collapsible-body"> and insert the screenshot HTML
    # right after it.

    lines = html.split('\n')
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        result.append(line)

        # Detect CU header
        if 'collapsible-header' in line:
            m = re.search(r'>(CU-[A-Z]\d+):', line)
            if m:
                cu_id = m.group(1)
                # Look ahead for the next collapsible-body opening
                j = i + 1
                while j < len(lines) and j < i + 5:
                    next_line = lines[j]
                    if '<div class="collapsible-body">' in next_line:
                        # Will be appended naturally; we'll inject after it
                        result.append(next_line)  # append the collapsible-body div
                        i = j  # advance i to j so the outer loop continues after j
                        if cu_id in CU_SHOTS:
                            path, caption = CU_SHOTS[cu_id]
                            result.append(cu_screenshot_html(path, caption))
                        break
                    j += 1

        i += 1

    html = '\n'.join(result)

    # 3. Add Section 13 before </main>
    html = html.replace('</main>', section13() + '\n</main>', 1)

    # 4. Update sidebar nav: replace closing </nav> with nav + section 13 links
    html = html.replace('  <a href="#galeria" class="nav-link level-2">Mobile PWA (17 capturas)</a>\n</nav>',
                        '  <a href="#galeria" class="nav-link level-2">Mobile PWA (17 capturas)</a>\n' + SIDEBAR_NAV_ADDITION,
                        1)

    return html

def main():
    manual_path = os.path.normpath(os.path.join(os.path.dirname(__file__), '../../docs/manual/index.html'))
    print(f'Reading: {manual_path}')
    with open(manual_path, 'r', encoding='utf-8') as f:
        html = f.read()

    original_size = len(html)
    modified = process(html)
    new_size = len(modified)

    with open(manual_path, 'w', encoding='utf-8') as f:
        f.write(modified)

    print(f'Done. Size: {original_size:,} → {new_size:,} bytes (+{new_size - original_size:,})')

    # Quick validation
    cu_count = len(re.findall(r'class="cu-screenshot"', modified))
    wf_count = len(re.findall(r'class="wf-step"', modified))
    sec13 = 'id="flujos"' in modified
    nav13 = '13. Flujos por Perfil' in modified
    print(f'  CU screenshots inserted: {cu_count}')
    print(f'  Workflow steps: {wf_count}')
    print(f'  Section 13 present: {sec13}')
    print(f'  Sidebar nav Section 13: {nav13}')

if __name__ == '__main__':
    main()
