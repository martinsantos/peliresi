# BUGS CORREGIDOS - 2025-12-08

## Resumen de Correcciones

Este documento registra los bugs corregidos en el sistema de trazabilidad RRPP el 8 de diciembre de 2025.

---

## Bug 1: Bloques Blancos en Stat-Cards

**Problema**: Las tarjetas de estadísticas (stat-cards) en el Dashboard se mostraban como bloques blancos vacíos sin contenido visible.

**Causa**: Faltaban propiedades CSS para asegurar altura mínima y visibilidad del contenido.

**Solución aplicada** (Dashboard.css):
- Añadido `min-height: 90px` a `.stat-card`
- Añadido `overflow: visible`
- Añadido `min-height` y `display: flex` a `.stat-value`
- Añadido `min-height` a `.stat-label`
- Añadido `gap: var(--space-1)` a `.stat-content`

**Archivos modificados**: 
- `frontend/src/pages/Dashboard.css`

---

## Bug 2: Mapa Superpuesto al Menú

**Problema**: El mapa del dashboard (iframe de OpenStreetMap) se superponía al menú lateral (sidebar) cuando éste estaba abierto.

**Causa**: El z-index del mapa era demasiado alto y el sidebar no tenía suficiente prioridad de capas.

**Solución aplicada**:
- Reducido z-index del `.dashboard-map-container` de 1 a 0
- Añadido `isolation: isolate` al contenedor del mapa
- Aumentado z-index del `.sidebar` de 1000 a 9999
- Aumentado z-index del `.sidebar-overlay` de 999 a 9998

**Archivos modificados**: 
- `frontend/src/pages/Dashboard.css`
- `frontend/src/components/Layout.css`

---

## Bug 3: Mal Despliegue en Móviles

**Problema**: El dashboard y la sección de reportes tenían problemas de responsividad en dispositivos móviles con pantallas pequeñas.

**Causa**: Media queries insuficientes y estilos faltantes para pantallas menores a 768px y 480px.

**Solución aplicada**:
- Completada la sección responsive en Dashboard.css para pantallas de 768px y 480px
- Añadidos estilos específicos para:
  - `.stat-card` con dirección flex correcta
  - `.stat-icon` con tamaños mínimos
  - `.stat-value` y `.stat-label` con tamaños de fuente ajustados
  - `.mobile-promo-card` con layout vertical
  - `.quick-stats` con orientación columnar
  - `.dashboard-welcome` con padding reducido
  - `.btn-nuevo-manifiesto` a ancho completo
- Añadido breakpoint para 480px específicamente

**Archivos modificados**: 
- `frontend/src/pages/Dashboard.css`
- `frontend/src/pages/Reportes.css`

---

## Bug 4: Iconos Sin Mostrar Correctamente

**Problema**: Los iconos SVG (Lucide Icons) no se mostraban correctamente en algunos contextos, especialmente en móviles.

**Causa**: Faltaban reglas CSS para dimensionar y comportar los SVG dentro de sus contenedores.

**Solución aplicada**:
- Añadido `.stat-icon svg` con `width`, `height` y `color: inherit`
- Añadido `.btn svg` globalmente con `flex-shrink: 0` y dimensiones específicas
- Añadido `.btn-nuevo-manifiesto` con estilos de base

**Archivos modificados**: 
- `frontend/src/pages/Dashboard.css`
- `frontend/src/index.css`

---

## Verificación

1. Build exitoso: `npm run build` completado sin errores
2. Servidor de desarrollo: `http://localhost:5173/demoambiente/`
3. El CSS total del dist es 120.11 kB (gzip: 24.82 kB)

---

## Instrucciones de Prueba

### Probar en Desktop:
```bash
cd frontend && npm run dev
# Navegar a http://localhost:5173/demoambiente/login
# Login: admin@dgfa.gob.ar / admin123
```

### Probar en Móvil:
- Usar Chrome DevTools (F12) > Toggle device toolbar
- Probar con iPhone 12 Pro (390x844) y Galaxy S21 (360x800)
- Verificar que:
  1. Las stat-cards muestran valores numéricos
  2. El sidebar se abre correctamente sobre el contenido
  3. El mapa NO aparece sobre el sidebar
  4. Los iconos son visibles en todos los botones
  5. El botón "Nuevo Manifiesto" tiene formato correcto

---

**Fecha de Corrección**: 2025-12-08T14:59 UTC-3
**Estado**: ✅ CORREGIDO - Pendiente verificación visual
