# 📋 CHECKLIST DE TESTING PRE-PRODUCCIÓN

**Sistema:** Trazabilidad RRPP Demo - DGFA Mendoza  
**Fecha:** 2025-12-09  
**Versión:** 1.0.0  

---

## 🖥️ TESTING DESKTOP (1920x1080)

### Dashboard
| Item | Verificación | Estado |
|------|--------------|--------|
| Carga correctamente | Datos demo visibles | ⬜ |
| Welcome section | Muestra nombre y rol | ⬜ |
| Stats cards | 4 tarjetas con datos | ⬜ |
| Manifiestos recientes | Lista con 3 items | ⬜ |
| En tránsito | Lista con 2 items | ⬜ |
| Promo App Móvil | Banner visible | ⬜ |

### Manifiestos
| Item | Verificación | Estado |
|------|--------------|--------|
| Lista paginada | Tabla con columnas | ⬜ |
| Filtros | Búsqueda funciona | ⬜ |
| Acciones | Botón ver detalle | ⬜ |

### Tracking GPS
| Item | Verificación | Estado |
|------|--------------|--------|
| Mapa visible | Se renderiza mapa | ⬜ |
| Marcadores | Transportes visibles | ⬜ |
| Panel lateral | Lista de activos | ⬜ |

### Reportes
| Item | Verificación | Estado |
|------|--------------|--------|
| Gráficos | Charts renderizados | ⬜ |
| Filtros fecha | Funcionan | ⬜ |
| Exportar | Botones visibles | ⬜ |

### Menú Lateral
| Item | Verificación | Estado |
|------|--------------|--------|
| Logo DGFA | Visible y correcto | ⬜ |
| Items navegación | Links funcionan | ⬜ |
| Rol actual | Badge en sidebar | ⬜ |
| Cambio de rol | Menú desplegable | ⬜ |

---

## 📱 TESTING MÓVIL (375x667)

### Responsive General
| Item | Verificación | Estado |
|------|--------------|--------|
| Sidebar oculto | Menu hamburguesa | ⬜ |
| Cards apilados | Sin overflow | ⬜ |
| Tablas scroll | Horizontalmente | ⬜ |
| Touch targets | >44px | ⬜ |

### Dashboard Móvil
| Item | Verificación | Estado |
|------|--------------|--------|
| Welcome compacto | Texto legible | ⬜ |
| Stats en grid | 2 columnas | ⬜ |
| Listas | Sin desborde | ⬜ |

### DemoApp
| Item | Verificación | Estado |
|------|--------------|--------|
| Phone mockup | Centrado | ⬜ |
| Roles accordion | Expandible | ⬜ |
| Install PWA | Botón visible | ⬜ |

---

## 🔄 TESTING FUNCIONAL

### Cambio de Rol
| Rol | Menú diferente | Dashboard diferente | Estado |
|-----|----------------|---------------------|--------|
| ADMIN | 8 items | Verde | ⬜ |
| GENERADOR | 4 items | Azul | ⬜ |
| TRANSPORTISTA | 3 items | Naranja | ⬜ |
| OPERADOR | 4 items | Violeta | ⬜ |

### Navegación
| Ruta | Carga correcta | Estado |
|------|----------------|--------|
| /dashboard | ✅ | ⬜ |
| /manifiestos | ✅ | ⬜ |
| /manifiestos/:id | ✅ | ⬜ |
| /tracking | ✅ | ⬜ |
| /reportes | ✅ | ⬜ |
| /actores | ✅ (sólo ADMIN) | ⬜ |
| /alertas | ✅ (sólo ADMIN) | ⬜ |
| /configuracion | ✅ (sólo ADMIN) | ⬜ |
| /demo-app | ✅ | ⬜ |

### Datos Demo
| Verificación | Estado |
|--------------|--------|
| Stats no vacíos | ⬜ |
| Manifiestos con datos | ⬜ |
| Detalle manifiesto completo | ⬜ |
| QR code visible | ⬜ |

---

## 🎨 VERIFICACIÓN UI/UX

### Estética
| Item | Verificación | Estado |
|------|--------------|--------|
| Tema oscuro consistente | ✅ | ⬜ |
| Gradientes correctos | ✅ | ⬜ |
| Iconos visibles | ✅ | ⬜ |
| Tipografía legible | ✅ | ⬜ |
| Animaciones suaves | ✅ | ⬜ |

### Errores Visuales
| Item | Verificación | Estado |
|------|--------------|--------|
| Sin text overflow | ✅ | ⬜ |
| Sin elementos cortados | ✅ | ⬜ |
| Botones con hover | ✅ | ⬜ |
| Focus visible | ✅ | ⬜ |

---

## 🔒 VERIFICACIÓN SEGURIDAD DEMO

### Analytics (Acceso Privado)
| Item | Verificación | Estado |
|------|--------------|--------|
| /analytics-admin | Solo por URL | ⬜ |
| No en menú | Oculto | ⬜ |
| Requiere contraseña | adminanalytics2024 | ⬜ |

---

## ⚠️ ERRORES ESPERADOS (Sin Backend)

Los siguientes errores en consola son NORMALES porque no hay backend:

- `GET http://localhost:3002/api/... net::ERR_CONNECTION_REFUSED`
- `Dashboard error: AxiosError Network Error`
- `Usando datos demo por error`

✅ **La aplicación maneja estos errores con fallback a datos demo**

---

## 📊 RESULTADO FINAL

| Categoría | Aprobado | Observaciones |
|-----------|----------|---------------|
| Desktop | ⬜ | |
| Móvil | ⬜ | |
| Funcional | ⬜ | |
| UI/UX | ⬜ | |
| Seguridad | ⬜ | |

**ESTADO GENERAL:** ⬜ PENDIENTE DE REVISIÓN MANUAL

---

## 📝 INSTRUCCIONES PARA TESTER

1. Abrir `http://localhost:5173/demoambiente/dashboard`
2. Verificar cada item del checklist
3. Probar en Developer Tools (F12) → Responsive mode para móvil
4. Cambiar de rol desde el menú de usuario (arriba derecha)
5. Verificar que cada rol muestra menú y dashboard diferente

### URLs de Prueba:
- Dashboard: `/demoambiente/dashboard`
- Manifiestos: `/demoambiente/manifiestos`
- Tracking: `/demoambiente/tracking`
- Demo App: `/demoambiente/demo-app`
- Analytics (privado): `/demoambiente/analytics-admin`

---

**Tester:** _______________  
**Fecha:** _______________  
**Firma:** _______________
