# SITREP v6 - Plan UI/UX 988% Mejora

## 🔍 Análisis de Problemas (de las capturas)

### Problema 1: Tarjetas de Reportes (Mobile & Desktop)
- **Síntoma**: Botón "Generar" con ícono "›" desborda el contenedor
- **Causa**: Diseño inline sin espacio suficiente, paddings incorrectos
- **Solución**: Rediseño de tarjeta con layout flex, botón como block element

### Problema 2: Viajes en Progreso
- **Síntoma**: Iconos de camiones posicionados de forma diagonal caótica
- **Causa**: Posicionamiento absoluto sin grid/flex structure
- **Solución**: Timeline horizontal o lista vertical con mapa real

### Problema 3: Faltan páginas críticas
- Listado de Operadores (con capacidad, estado, acciones)
- Listado de Transportistas (con flota, conductor, estado)
- Vista de QR por manifiesto
- Vista de Viaje en Curso (tracking real)

---

## 🎨 Design System Mejorado

### Tokens de Diseño
```css
/* Colores */
--primary-500: #0D8A4F;
--primary-600: #0A6B3D;
--surface-elevated: rgba(255,255,255,0.95);

/* Sombras */
--shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05);
--shadow-elevated: 0 4px 6px rgba(0,0,0,0.05), 0 10px 40px rgba(0,0,0,0.08);
--shadow-float: 0 8px 24px rgba(13,138,79,0.15);

/* Bordes */
--radius-card: 16px;
--radius-button: 12px;
--radius-input: 12px;

/* Espaciado */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
```

### Principios
1. **Air & Space**: Más padding, menos elementos amontonados
2. **Visual Hierarchy**: Contraste claro entre secciones
3. **Interactive Feedback**: Toda fila/tab es clickeable
4. **Mobile First**: Diseño nativo-app, no web comprimida

---

## 📦 Nuevos Componentes

### 1. OperadoresPage
```
┌─────────────────────────────────────┐
│ Operadores de Tratamiento     [+]   │
├─────────────────────────────────────┤
│ 🔍 Buscar operador...               │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🏭 Planta Norte          [VER]  │ │
│ │    Capacidad: 85%  ● En línea   │ │
│ │    1,240 Tn procesadas este mes │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🏭 EcoResiduos Sur      [VER]   │ │
│ │    Capacidad: 62%  ● En línea   │ │
│ │    890 Tn procesadas este mes   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2. TransportistasPage
```
┌─────────────────────────────────────┐
│ Transportistas                [+]   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🚛 Transportes Rápidos          │ │
│ │    12 vehículos | 8 activos     │ │
│ │    [Ver Flota] [Ver Rutas]      │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 3. ViajeEnCurso (Componente)
```
┌─────────────────────────────────────┐
│ ← Viaje en Curso              [MAP] │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │      🗺️ [MAPA INTERACTIVO]      │ │
│ │         🚛                      │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ M-2025-089                      │ │
│ │ 🟢 En tránsito                  │ │
│ │                                   │ │
│ │ Origen: Química Mendoza         │ │
│ │ Destino: Planta Norte           │ │
│ │                                   │ │
│ │ Conductor: Juan López           │ │
│ │ Vehículo: ABC-123               │ │
│ │ ETA: 45 minutos                 │ │
│ │                                   │ │
│ │ [Ver Manifiesto] [Contactar]    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 4. QRModal
```
┌─────────────────────────────────────┐
│           Cerrar [X]                │
│                                     │
│     ┌─────────────────┐             │
│     │  ▄▄▄ ▄▄▄ ▄▄▄    │             │
│     │  █ █ █ █ █ █    │  ← QR       │
│     │  ▀▀▀ ▀▀▀ ▀▀▀    │             │
│     └─────────────────┘             │
│                                     │
│     M-2025-089                      │
│     Escanear para ver detalles      │
│                                     │
│     [Descargar] [Compartir]         │
└─────────────────────────────────────┘
```

---

## 🚀 Implementación Paso a Paso

### Fase 1: Fix Críticos (AHORA)
- [x] Corregir tarjetas Reportes (desbordamiento)
- [x] Corregir Viajes en Progreso (layout)
- [x] Tablas clickeables (cursor + hover)

### Fase 2: Páginas Faltantes
- [ ] OperadoresPage completa
- [ ] TransportistasPage completa
- [ ] QRModal componente

### Fase 3: Experiencia Avanzada
- [ ] ViajeEnCurso con mapa
- [ ] Transiciones de página
- [ ] Animaciones micro-interacciones
- [ ] Skeleton loaders

### Fase 4: Polish 988%
- [ ] Rediseño dashboard
- [ ] Mejores gráficos
- [ ] Dark mode opcional
- [ ] Gestos táctiles (swipe)

---

## 📱 Mobile UX Improvements

### Gestos
- Swipe right: Abrir menú
- Swipe left en fila: Acciones rápidas (editar/eliminar)
- Pull down: Refresh
- Pinch: Zoom en mapas

### Navegación
- Bottom sheet para acciones
- FAB contextual por página
- Transiciones slide entre páginas
- Breadcrumbs en desktop

### Feedback
- Haptic feedback en botones
- Toast notifications con progreso
- Loading states animados
- Empty states ilustrados

---

## 🎯 KPIs de Éxito

1. **Consistencia visual**: 100% componentes unificados
2. **Interactividad**: Toda fila/tabla clickeable
3. **Performance**: <100ms feedback visual
4. **Mobile UX**: App-like experience
5. **Accessibility**: WCAG 2.1 AA compliance
