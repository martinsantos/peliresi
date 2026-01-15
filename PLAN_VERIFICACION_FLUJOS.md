# PLAN DE VERIFICACION DE FLUJOS - SITREP
## Sistema de Trazabilidad de Residuos Peligrosos

**Fecha:** 2026-01-15
**Version:** 1.0
**URL Produccion:** https://sitrep.ultimamilla.com.ar
**Arquitectura:** v8.5+ (actualizada 14/01/2026)

---

## ARQUITECTURA NUEVA - CARACTERISTICAS PRINCIPALES

### Escalabilidad (miles de usuarios)
- **Rate Limiters Especificos:**
  - Auth: 10 req/min (previene brute force)
  - GPS: 10 req/seg (alta frecuencia tracking)
  - Sync: 20 req/min (operaciones pesadas)
  - API General: 100 req/min por usuario
- **Redis Cache:** Degraded mode si no disponible
- **WebSocket:** Actualizaciones en tiempo real
- **CRON Jobs:** Tareas programadas automaticas

### Servicios Backend
```
/api/auth           → Autenticacion y usuarios
/api/manifiestos    → CRUD manifiestos + flujos
/api/logistics      → GPS tracking, retiro, entrega
/api/viajes         → Tracking GPS alta frecuencia
/api/sync           → Sincronizacion offline
/api/notificaciones → Sistema notificaciones in-app
/api/alertas        → Reglas y alertas automaticas
/api/admin          → Funciones administrativas
/api/admin-sectorial → Dashboards por sector
/api/reportes       → Estadisticas y exportacion
/api/config         → Parametros del sistema
/api/cron           → Tareas programadas
```

---

## PERFILES DE USUARIO

| Perfil | Descripcion | Acceso |
|--------|-------------|--------|
| **ADMIN** | Admin General DGFA | WEB + APP |
| **GENERADOR** | Empresa generadora residuos | WEB + APP |
| **TRANSPORTISTA** | Empresa de transporte | WEB + APP |
| **OPERADOR** | Planta de tratamiento | WEB + APP |
| **ADMIN_TRANSPORTISTAS** | Admin sectorial transportes | WEB |
| **ADMIN_OPERADORES** | Admin sectorial operadores | WEB |
| **ADMIN_GENERADORES** | Admin sectorial generadores | WEB |

---

## CREDENCIALES DE PRUEBA

```
ADMIN:
  Email: admin@test.com
  Password: 123456

GENERADOR:
  Email: generador@test.com
  Password: 123456

TRANSPORTISTA:
  Email: transportista@test.com
  Password: 123456

OPERADOR:
  Email: operador@test.com
  Password: 123456
```

---

# FLUJOS POR PERFIL

## 1. ADMIN GENERAL (DGFA)

### 1.1 WEB - Centro de Control
| # | Flujo | Ruta | Estado |
|---|-------|------|--------|
| 1.1.1 | Login con token 2FA | `/login` | ⬜ |
| 1.1.2 | Dashboard ejecutivo con KPIs | `/dashboard` | ⬜ |
| 1.1.3 | Centro de Control (manifiestos, usuarios, viajes, alertas) | `/centro-control` | ⬜ |
| 1.1.4 | Timeline de actividad global | `/actividad` | ⬜ |
| 1.1.5 | Monitoreo GPS tiempo real (mapa) | `/tracking` | ⬜ |
| 1.1.6 | Gestion de usuarios | `/usuarios` | ⬜ |
| 1.1.7 | Aprobar/rechazar manifiestos | `/manifiestos/pendientes` | ⬜ |
| 1.1.8 | Log de auditoria con filtros | `/auditoria` | ⬜ |
| 1.1.9 | Reportes estadisticos | `/reportes` | ⬜ |
| 1.1.10 | Configurar alertas automaticas | `/alertas/configurar` | ⬜ |
| 1.1.11 | Gestion actores (Gen/Trans/Oper) | `/actores` | ⬜ |
| 1.1.12 | Carga masiva CSV | `/carga-masiva` | ⬜ |
| 1.1.13 | Parametros del sistema | `/configuracion` | ⬜ |
| 1.1.14 | Revertir estado de manifiestos | Desde detalle | ⬜ |

### 1.2 APP MOVIL - Admin
| # | Flujo | Pantalla | Estado |
|---|-------|----------|--------|
| 1.2.1 | Login con seleccion de rol | Role Selector | ⬜ |
| 1.2.2 | Dashboard admin movil | `AdminDashboard` | ⬜ |
| 1.2.3 | Centro de Control movil | `CentroControlScreen` | ⬜ |
| 1.2.4 | Panel de usuarios | `AdminUsuariosScreen` | ⬜ |
| 1.2.5 | Ver manifiestos y estados | `ManifiestosScreen` | ⬜ |
| 1.2.6 | Ver actores del sistema | `ActoresScreen` | ⬜ |
| 1.2.7 | Notificaciones/alertas | `AlertasScreen` | ⬜ |

---

## 2. GENERADOR DE RESIDUOS

### 2.1 WEB - Generador
| # | Flujo | CU | Estado |
|---|-------|-----|--------|
| 2.1.1 | Login generador | CU-G01 | ⬜ |
| 2.1.2 | Dashboard con stats y recientes | CU-G02 | ⬜ |
| 2.1.3 | Crear manifiesto (formulario completo) | CU-G03 | ⬜ |
| 2.1.4 | Seleccionar tipo residuo de catalogo | CU-G04 | ⬜ |
| 2.1.5 | Asignar transportista habilitado | CU-G05 | ⬜ |
| 2.1.6 | Asignar operador destino | CU-G06 | ⬜ |
| 2.1.7 | Firmar manifiesto (genera QR) | CU-G07 | ⬜ |
| 2.1.8 | Enviar a aprobacion DGFA | -- | ⬜ |
| 2.1.9 | Consultar estado con timeline | CU-G08 | ⬜ |
| 2.1.10 | Consultar historial con filtros | CU-G09 | ⬜ |
| 2.1.11 | Descargar manifiesto PDF | CU-G10 | ⬜ |
| 2.1.12 | Ver notificaciones in-app | CU-G11 | ⬜ |
| 2.1.13 | Actualizar perfil | CU-G12 | ⬜ |

### 2.2 APP MOVIL - Generador
| # | Flujo | Pantalla | Estado |
|---|-------|----------|--------|
| 2.2.1 | Seleccionar rol GENERADOR | Role Selector | ⬜ |
| 2.2.2 | Home: Mis Manifiestos | `HomeScreen` | ⬜ |
| 2.2.3 | Ver lista de manifiestos | Tab manifiestos | ⬜ |
| 2.2.4 | Crear nuevo manifiesto (demo) | `nuevo` screen | ⬜ |
| 2.2.5 | Ver alertas/notificaciones | `AlertasScreen` | ⬜ |
| 2.2.6 | Ver perfil | `PerfilScreen` | ⬜ |

---

## 3. TRANSPORTISTA

### 3.1 WEB - Transportista
| # | Flujo | CU | Estado |
|---|-------|-----|--------|
| 3.1.1 | Login transportista | CU-T01 | ⬜ |
| 3.1.2 | Sincronizacion inicial offline | CU-T01 | ⬜ |
| 3.1.3 | Ver manifiestos asignados (APROBADOS) | CU-T02 | ⬜ |
| 3.1.4 | Confirmar retiro en origen | CU-T03 | ⬜ |
| 3.1.5 | Iniciar transporte (activa GPS) | CU-T04 | ⬜ |
| 3.1.6 | Registrar eventos en transito | CU-T05 | ⬜ |
| 3.1.7 | Registrar incidentes con foto | CU-T06 | ⬜ |
| 3.1.8 | Confirmar entrega en destino | CU-T07 | ⬜ |
| 3.1.9 | Ver historial de viajes | CU-T10 | ⬜ |
| 3.1.10 | Gestionar flota (vehiculos/choferes) | CU-T11 | ⬜ |

### 3.2 APP MOVIL - Transportista (CRITICO)
| # | Flujo | Validacion | Estado |
|---|-------|------------|--------|
| 3.2.1 | Seleccionar rol TRANSPORTISTA | Role Selector | ⬜ |
| 3.2.2 | Home: Mis Viajes | Stats, pendientes, en curso | ⬜ |
| 3.2.3 | Ver manifiestos APROBADOS | Lista con filtros | ⬜ |
| 3.2.4 | **ESCANEAR QR** de manifiesto | Camera + decode | ⬜ |
| 3.2.5 | **INICIAR VIAJE** desde QR | Confirma retiro automatico | ⬜ |
| 3.2.6 | **INICIAR VIAJE** desde lista | Seleccionar manifiesto | ⬜ |
| 3.2.7 | **TRACKING GPS** activo | TripTracker, banner | ⬜ |
| 3.2.8 | Registrar incidente durante viaje | Modal incidente | ⬜ |
| 3.2.9 | Registrar parada programada | Modal parada | ⬜ |
| 3.2.10 | **FINALIZAR VIAJE** (entrega) | Confirma entrega + GPS | ⬜ |
| 3.2.11 | Ver historial de viajes | HistorialViajes | ⬜ |
| 3.2.12 | Ver notificaciones | AlertasScreen | ⬜ |

### 3.3 VALIDACIONES CRITICAS TRANSPORTISTA
| # | Validacion | Resultado Esperado | Estado |
|---|------------|-------------------|--------|
| 3.3.1 | Solo ve manifiestos APROBADOS+EN_TRANSITO+ENTREGADO | sync-inicial correcto | ⬜ |
| 3.3.2 | **Solo 1 viaje EN_TRANSITO a la vez** | Error 409 si intenta 2do | ⬜ |
| 3.3.3 | GPS tracking envia ubicacion cada 30s | Puntos en BD | ⬜ |
| 3.3.4 | **Modo offline**: guarda localmente | IndexedDB funciona | ⬜ |
| 3.3.5 | **Sincronizacion al reconectar** | Datos se envian | ⬜ |
| 3.3.6 | **Viaje activo se muestra en banner** | TripBanner visible | ⬜ |
| 3.3.7 | No puede navegar a otras pantallas con viaje activo | ActiveTripOverlay | ⬜ |
| 3.3.8 | Recuperacion de viaje guardado | TripRecoveryModal | ⬜ |

---

## 4. OPERADOR

### 4.1 WEB - Operador
| # | Flujo | CU | Estado |
|---|-------|-----|--------|
| 4.1.1 | Login operador | CU-O01 | ⬜ |
| 4.1.2 | Ver manifiestos entrantes | CU-O02 | ⬜ |
| 4.1.3 | **Escanear QR** (validacion offline) | CU-O03 | ⬜ |
| 4.1.4 | Confirmar recepcion | CU-O03 | ⬜ |
| 4.1.5 | Registrar pesaje | CU-O04 | ⬜ |
| 4.1.6 | Registrar diferencias de carga | CU-O05 | ⬜ |
| 4.1.7 | Rechazar carga (total/parcial) | CU-O06 | ⬜ |
| 4.1.8 | Firmar recepcion conforme | CU-O07 | ⬜ |
| 4.1.9 | Registrar tratamiento aplicado | CU-O08 | ⬜ |
| 4.1.10 | Cerrar manifiesto (ciclo completo) | CU-O09 | ⬜ |
| 4.1.11 | Generar certificado disposicion PDF | CU-O10 | ⬜ |
| 4.1.12 | Consultar historial recepciones | CU-O11 | ⬜ |
| 4.1.13 | Generar reportes del operador | CU-O12 | ⬜ |

### 4.2 APP MOVIL - Operador
| # | Flujo | Pantalla | Estado |
|---|-------|----------|--------|
| 4.2.1 | Seleccionar rol OPERADOR | Role Selector | ⬜ |
| 4.2.2 | Home: Recepciones (entrantes) | HomeScreen | ⬜ |
| 4.2.3 | **ESCANEAR QR** en garita | QRScannerView | ⬜ |
| 4.2.4 | Ver detalle manifiesto escaneado | ManifiestoDetail | ⬜ |
| 4.2.5 | **CONFIRMAR RECEPCION** con pesaje | RecepcionModal | ⬜ |
| 4.2.6 | **RECHAZAR CARGA** con motivo | RechazoModal | ⬜ |
| 4.2.7 | **REGISTRAR TRATAMIENTO** | TratamientoModal | ⬜ |
| 4.2.8 | **CERRAR MANIFIESTO** (certificado) | handleCerrar | ⬜ |
| 4.2.9 | Ver manifiestos recibidos | Tab Recibidos | ⬜ |
| 4.2.10 | Ver alertas/notificaciones | AlertasScreen | ⬜ |

### 4.3 VALIDACIONES CRITICAS OPERADOR
| # | Validacion | Resultado Esperado | Estado |
|---|------------|-------------------|--------|
| 4.3.1 | **Solo operador asignado puede confirmar** | 403 si no autorizado | ⬜ |
| 4.3.2 | Validar QR contra lista esperados (offline) | Funciona sin red | ⬜ |
| 4.3.3 | Pesaje: diferencia >10% genera alerta | AlertaGenerada en BD | ⬜ |
| 4.3.4 | Rechazo notifica a transportista/generador | Notificaciones creadas | ⬜ |
| 4.3.5 | Cierre genera certificado PDF | PDF descargable | ⬜ |

---

## 5. ADMINISTRACIONES SECTORIALES

### 5.1 ADMIN TRANSPORTISTAS
| # | Flujo | Endpoint | Estado |
|---|-------|----------|--------|
| 5.1.1 | Dashboard transportistas | `GET /api/admin-sectorial/transportistas/dashboard` | ⬜ |
| 5.1.2 | Listar transportistas con paginacion | `GET /api/admin-sectorial/transportistas` | ⬜ |
| 5.1.3 | Aprobar transportista | `POST /api/admin-sectorial/transportistas/:id/aprobar` | ⬜ |
| 5.1.4 | Reportes por transportista | `GET /api/admin-sectorial/transportistas/reportes` | ⬜ |

### 5.2 ADMIN OPERADORES
| # | Flujo | Endpoint | Estado |
|---|-------|----------|--------|
| 5.2.1 | Dashboard operadores | `GET /api/admin-sectorial/operadores/dashboard` | ⬜ |
| 5.2.2 | Listar operadores con paginacion | `GET /api/admin-sectorial/operadores` | ⬜ |
| 5.2.3 | Aprobar operador | `POST /api/admin-sectorial/operadores/:id/aprobar` | ⬜ |
| 5.2.4 | Reportes por operador | `GET /api/admin-sectorial/operadores/reportes` | ⬜ |

### 5.3 ADMIN GENERADORES
| # | Flujo | Endpoint | Estado |
|---|-------|----------|--------|
| 5.3.1 | Dashboard generadores | `GET /api/admin-sectorial/generadores/dashboard` | ⬜ |
| 5.3.2 | Listar generadores con paginacion | `GET /api/admin-sectorial/generadores` | ⬜ |
| 5.3.3 | Aprobar generador | `POST /api/admin-sectorial/generadores/:id/aprobar` | ⬜ |
| 5.3.4 | Reportes por generador | `GET /api/admin-sectorial/generadores/reportes` | ⬜ |

---

## 6. FLUJO COMPLETO DE MANIFIESTO (E2E)

### Estados del Manifiesto
```
BORRADOR → PENDIENTE_APROBACION → APROBADO → EN_TRANSITO → ENTREGADO → RECIBIDO → EN_TRATAMIENTO → TRATADO → CERRADO
                                                                    ↓
                                                              RECHAZADO
```

### Test E2E Completo
| # | Paso | Actor | Estado Resultante | Estado |
|---|------|-------|-------------------|--------|
| E1 | Crear manifiesto | GENERADOR | BORRADOR | ⬜ |
| E2 | Firmar manifiesto | GENERADOR | FIRMADO | ⬜ |
| E3 | Enviar a aprobacion | GENERADOR | PENDIENTE_APROBACION | ⬜ |
| E4 | Aprobar manifiesto | ADMIN | APROBADO | ⬜ |
| E5 | Confirmar retiro | TRANSPORTISTA | EN_TRANSITO | ⬜ |
| E6 | Tracking GPS (varios puntos) | TRANSPORTISTA | EN_TRANSITO | ⬜ |
| E7 | Confirmar entrega | TRANSPORTISTA | ENTREGADO | ⬜ |
| E8 | Escanear QR en garita | OPERADOR | ENTREGADO | ⬜ |
| E9 | Confirmar recepcion + pesaje | OPERADOR | RECIBIDO | ⬜ |
| E10 | Registrar tratamiento | OPERADOR | EN_TRATAMIENTO | ⬜ |
| E11 | Cerrar manifiesto | OPERADOR | TRATADO | ⬜ |
| E12 | Descargar certificado PDF | OPERADOR | TRATADO | ⬜ |

---

## 7. TESTS DE ESTRES (ARQUITECTURA NUEVA)

### 7.1 Concurrencia
| # | Test | Criterio Exito | Estado |
|---|------|----------------|--------|
| 7.1.1 | 10 transportistas login simultaneo | >80% exito | ⬜ |
| 7.1.2 | 5 transportistas tracking GPS simultaneo | Todos registran puntos | ⬜ |
| 7.1.3 | 10 confirmaciones retiro simultaneas | >80% exito | ⬜ |
| 7.1.4 | Race condition mismo manifiesto | Solo 1 exito | ⬜ |

### 7.2 Offline/Sync
| # | Test | Criterio Exito | Estado |
|---|------|----------------|--------|
| 7.2.1 | Confirmar retiro offline | Guarda en IndexedDB | ⬜ |
| 7.2.2 | GPS perdido por 30 min | Detecta anomalia | ⬜ |
| 7.2.3 | Sincronizar al reconectar | Datos enviados <5s | ⬜ |
| 7.2.4 | Throttling 3G | Login <10s, sync <5s | ⬜ |

### 7.3 Background/Bateria
| # | Test | Criterio Exito | Estado |
|---|------|----------------|--------|
| 7.3.1 | Tracking con app en background | Min 2-3 puntos GPS | ⬜ |
| 7.3.2 | CPU throttling 6x | Sigue funcionando | ⬜ |
| 7.3.3 | Service worker post-cierre | Operaciones persisten | ⬜ |

---

## 8. REVERSIONES DE ESTADO

### Flujos de Reversion Permitidos
| Reversion | De | A | Roles Permitidos |
|-----------|-----|-----|------------------|
| Revertir entrega | ENTREGADO | EN_TRANSITO | TRANSPORTISTA, OPERADOR, ADMIN, ADMIN_TRANSPORTISTAS, ADMIN_OPERADORES |
| Rechazar recepcion | RECIBIDO | ENTREGADO | OPERADOR, ADMIN, ADMIN_OPERADORES |
| Revertir certificado | TRATADO | RECIBIDO | OPERADOR, ADMIN, ADMIN_OPERADORES |
| Revertir cualquier estado | * | * | Solo ADMIN |

---

## 9. NOTIFICACIONES Y ALERTAS

### 9.1 Eventos que Generan Notificacion
| Evento | Destinatarios |
|--------|---------------|
| Manifiesto aprobado | GENERADOR, TRANSPORTISTA |
| Retiro confirmado | GENERADOR, OPERADOR |
| Entrega confirmada | GENERADOR, OPERADOR |
| Recepcion confirmada | GENERADOR, TRANSPORTISTA |
| Carga rechazada | GENERADOR, TRANSPORTISTA, ADMIN |
| Manifiesto cerrado | GENERADOR, TRANSPORTISTA |
| Anomalia detectada | ADMIN, TRANSPORTISTA |

### 9.2 Verificacion Notificaciones
| # | Test | Estado |
|---|------|--------|
| 9.2.1 | GET /api/notificaciones retorna lista | ⬜ |
| 9.2.2 | PUT /api/notificaciones/:id/leer marca leida | ⬜ |
| 9.2.3 | PUT /api/notificaciones/leer-todas funciona | ⬜ |
| 9.2.4 | DELETE /api/notificaciones/:id elimina | ⬜ |
| 9.2.5 | Badge contador en header | ⬜ |

---

## 10. COMANDOS DE VERIFICACION

### Health Check
```bash
curl https://sitrep.ultimamilla.com.ar/api/health
# Esperado: {"status":"ok"}
```

### Verificar Sync Inicial (Transportista)
```bash
curl https://sitrep.ultimamilla.com.ar/api/manifiestos/sync-inicial \
  -H "Authorization: Bearer TOKEN_TRANSPORTISTA"
# Esperado: Manifiestos en APROBADO, EN_TRANSITO, ENTREGADO (NO FIRMADO)
```

### Verificar Restriccion 1-Viaje
```bash
# Primer viaje: debe funcionar
curl -X POST https://sitrep.ultimamilla.com.ar/api/manifiestos/MAN-001/confirmar-retiro \
  -H "Authorization: Bearer TOKEN_TRANSPORTISTA" \
  -d '{"latitud":-32.88,"longitud":-68.84}'
# Esperado: 200 OK

# Segundo viaje: debe fallar
curl -X POST https://sitrep.ultimamilla.com.ar/api/manifiestos/MAN-002/confirmar-retiro \
  -H "Authorization: Bearer TOKEN_TRANSPORTISTA" \
  -d '{"latitud":-32.88,"longitud":-68.84}'
# Esperado: 409 "Ya tienes un viaje en transito..."
```

### Verificar Validacion Operador Asignado
```bash
# Transportista intenta confirmar recepcion: debe fallar
curl -X POST https://sitrep.ultimamilla.com.ar/api/manifiestos/MAN-001/confirmar-recepcion \
  -H "Authorization: Bearer TOKEN_TRANSPORTISTA"
# Esperado: 403 "No eres el operador asignado"

# Operador correcto: debe funcionar
curl -X POST https://sitrep.ultimamilla.com.ar/api/manifiestos/MAN-001/confirmar-recepcion \
  -H "Authorization: Bearer TOKEN_OPERADOR_ASIGNADO"
# Esperado: 200 OK
```

---

## RESUMEN EJECUTIVO

| Modulo | Total Tests | Completados | Pendientes |
|--------|-------------|-------------|------------|
| ADMIN GENERAL | 21 | ⬜ | ⬜ |
| GENERADOR | 19 | ⬜ | ⬜ |
| TRANSPORTISTA | 26 | ⬜ | ⬜ |
| OPERADOR | 18 | ⬜ | ⬜ |
| ADMIN SECTORIALES | 12 | ⬜ | ⬜ |
| FLUJO E2E | 12 | ⬜ | ⬜ |
| ESTRES | 11 | ⬜ | ⬜ |
| NOTIFICACIONES | 5 | ⬜ | ⬜ |
| **TOTAL** | **124** | **0** | **124** |

---

**Tester:** _______________
**Fecha Inicio:** _______________
**Fecha Fin:** _______________
**Firma:** _______________
