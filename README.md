# SITREP — Sistema de Trazabilidad de Residuos Peligrosos

## Instalacion Rapida

| Archivo | Descripcion |
|---------|-------------|
| **[SETUP.html](SETUP.html)** | Wizard interactivo de instalacion (8 pasos, funciona sin servidor) |
| **[MANUAL.html](MANUAL.html)** | Manual del sistema con indice, guia de instalacion y links |
| **[DEPLOY-NUEVO-SERVIDOR.md](DEPLOY-NUEVO-SERVIDOR.md)** | Guia tecnica completa de deploy en servidor nuevo |
| **[docs/manual/index.html](docs/manual/index.html)** | Manual interactivo completo con capturas de pantalla |

Para instalar SITREP desde cero, abrir **SETUP.html** en el navegador y seguir los 8 pasos.

---

## Demo DGFA Mendoza

---

## Acceso a la Demo

**URL de Producción:** [https://www.ultimamilla.com.ar/demoambiente/](https://www.ultimamilla.com.ar/demoambiente/)

### Acceso Directo (Sin Login)

La demo está configurada para **acceso directo al Dashboard** sin necesidad de login.

Para cambiar de rol, usar el **menú de usuario** (esquina superior derecha).

### Roles Disponibles

| Rol | Identificador | Color |
|-----|---------------|-------|
| 🛡️ Administrador DGFA | ADMIN | Verde |
| 🏭 Generador | GENERADOR | Azul |
| 🚛 Transportista | TRANSPORTISTA | Naranja |
| 🏢 Operador | OPERADOR | Violeta |

---

## 📋 Descripción del Sistema

Sistema integral de **trazabilidad de residuos peligrosos** para la Dirección de Gestión y Fiscalización Ambiental (DGFA) de la Provincia de Mendoza.

### Características Principales

| Característica | Descripción |
|----------------|-------------|
| **Manifiestos Electrónicos** | Creación, firma y seguimiento digital |
| **Firma Electrónica** | Validación legal en cada etapa |
| **Tracking GPS** | Ubicación en tiempo real de transportes |
| **Modo Offline** | Funcionamiento sin conexión |
| **Código QR** | Verificación instantánea |
| **Auditoría Completa** | Registro inmutable de operaciones |
| **Alertas Automáticas** | Detección proactiva de anomalías |

---

## 🏗️ Arquitectura

### Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Node.js + Express + TypeScript |
| **Base de Datos** | PostgreSQL 15 |
| **ORM** | Prisma |
| **Autenticación** | JWT |
| **Deployment** | PM2 + Nginx |

### Infraestructura de Producción

```
Servidor: 23.105.176.45
│
├── Nginx (443/80) - Proxy reverso + SSL
│   ├── /demoambiente/ → Frontend estático
│   └── /api/ → Backend Node.js
│
├── PM2
│   ├── demo-backend (puerto 3010)
│   ├── astro-ultimamilla (puerto 4321) [sitio principal]
│   └── sgi (puerto 3456) [otro servicio]
│
└── Docker
    └── PostgreSQL (directus-admin-database-1)
        └── Base de datos: trazabilidad_demo
```

---

## 📁 Estructura del Proyecto

```
trazabilidad-rrpp-demo/
├── frontend/                 # Aplicación React
│   ├── src/
│   │   ├── components/       # Componentes reutilizables
│   │   │   ├── Layout.tsx
│   │   │   ├── OnboardingTour.tsx  # Guía interactiva
│   │   │   └── ...
│   │   ├── pages/            # Páginas de la aplicación
│   │   ├── services/         # API y servicios
│   │   ├── context/          # Context providers
│   │   └── types/            # TypeScript types
│   └── dist/                 # Build de producción
│
├── backend/                  # API Express
│   ├── src/
│   │   ├── controllers/      # Controladores
│   │   ├── routes/           # Rutas API
│   │   ├── middlewares/      # Middlewares
│   │   └── config/           # Configuración
│   ├── prisma/
│   │   ├── schema.prisma     # Modelo de datos
│   │   ├── seed.ts           # Seed inicial
│   │   └── seed-demo.ts      # Datos de demo
│   └── dist/                 # Build de producción
│
├── GUIA_DEMO.md              # Guía paso a paso para demo
├── TUTORIAL_DEMO.md          # Tutorial técnico completo
├── DEPLOY.md                 # Instrucciones de deployment
└── README.md                 # Este archivo
```

---

## 🚀 Guía de Instalación Local

### Requisitos

- Node.js 18+
- PostgreSQL 15+
- npm o yarn

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Configurar DATABASE_URL en .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔧 Variables de Entorno

### Backend (.env)

```env
NODE_ENV=production
PORT=3010
DATABASE_URL="postgresql://user:pass@localhost:5432/trazabilidad_demo"
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
CORS_ORIGIN=https://your-domain.com
ENABLE_ANALYTICS=true
```

### Frontend (.env.production)

```env
VITE_API_URL=https://your-domain.com/api
```

---

## 📊 Modelo de Datos

### Entidades Principales

| Entidad | Descripción |
|---------|-------------|
| **Usuario** | Usuarios del sistema con rol asignado |
| **Generador** | Empresas que generan residuos |
| **Transportista** | Empresas de transporte habilitadas |
| **Operador** | Plantas de tratamiento/disposición |
| **Manifiesto** | Documento de trazabilidad |
| **TipoResiduo** | Catálogo según Ley 24.051 |
| **TrackingGPS** | Puntos de ubicación del transporte |
| **Auditoria** | Log de operaciones del sistema |

---

## 🎯 Casos de Uso Implementados

### Administrador (CU-A)
- ✅ CU-A01: Iniciar sesión
- ✅ CU-A02: Dashboard ejecutivo
- ✅ CU-A03: Gestionar usuarios
- ✅ CU-A09: Monitoreo en tiempo real
- ✅ CU-A10: Consultar auditoría
- ✅ CU-A13: Configurar alertas

### Generador (CU-G)
- ✅ CU-G01: Iniciar sesión
- ✅ CU-G02: Dashboard del generador
- ✅ CU-G03: Crear manifiesto
- ✅ CU-G07: Firmar manifiesto
- ✅ CU-G08: Consultar estado

### Transportista (CU-T)
- ✅ CU-T01: Iniciar sesión
- ✅ CU-T02: Ver manifiestos asignados
- ✅ CU-T03: Confirmar retiro
- ✅ CU-T04: Iniciar transporte
- ✅ CU-T07: Confirmar entrega

### Operador (CU-O)
- ✅ CU-O01: Iniciar sesión
- ✅ CU-O02: Ver manifiestos entrantes
- ✅ CU-O03: Recepción con QR
- ✅ CU-O04: Registrar pesaje
- ✅ CU-O07: Firmar recepción
- ✅ CU-O08: Registrar tratamiento
- ✅ CU-O09: Cerrar manifiesto

---

## 🔒 Seguridad

| Aspecto | Implementación |
|---------|----------------|
| **Autenticación** | JWT con refresh tokens |
| **Autorización** | RBAC por rol de usuario |
| **CORS** | Orígenes permitidos configurables |
| **No-indexación** | robots noindex + X-Robots-Tag |
| **Auditoría** | Log completo de operaciones |
| **API protegida** | Middleware de autenticación |

---

## 📱 Características Especiales

### Tour de Onboarding

Al primer login, el sistema muestra una guía interactiva personalizada según el rol del usuario:

- Pasos destacados con zona a observar
- Navegación Anterior/Siguiente
- Botón "Ayuda" para re-ver el tour

### Modo Offline

La aplicación soporta operación sin conexión:

- IndexedDB para almacenamiento local
- Service Worker para sincronización
- Resolución automática de conflictos

---

## 📄 Documentación Adicional

| Archivo | Contenido |
|---------|-----------|
| `docs/MANUAL_TUTORIAL.md` | **📘 Manual Tutorial Completo** - Guía profesional con 34+ capturas de pantalla |
| `GUIA_DEMO.md` | Guía paso a paso para demostración |
| `TUTORIAL_DEMO.md` | Tutorial técnico completo |
| `DEPLOY.md` | Instrucciones de deployment |

### 📸 Capturas de Pantalla

El manual incluye capturas reales del sistema organizadas por tipo:

- `docs/screenshots/desktop/` - 15 capturas de vistas desktop
- `docs/screenshots/mobile/` - 19 capturas de aplicación móvil

---

## 🧪 Datos de Demo

El sistema incluye datos precargados:

- **8 usuarios** (Admin, Generadores, Transportistas, Operadores)
- **3 generadores** de residuos
- **2 transportistas** habilitados
- **2 operadores** de tratamiento
- **15 tipos de residuos** (Ley 24.051)
- **70 manifiestos** históricos

---

## 📝 Auditoría y Logs

El sistema registra automáticamente:

- Logins de usuarios (IP, User Agent, Timestamp)
- Operaciones CRUD en manifiestos
- Cambios de estado
- Firmas electrónicas

Consultar en: Menú → Configuración → Auditoría

---

## 🔗 Enlaces

- **Demo:** https://www.ultimamilla.com.ar/demoambiente/
- **Repositorio:** https://github.com/martinsantos/peliresi
- **API Health:** https://www.ultimamilla.com.ar/api/health

---

## 📊 Acceso a Analytics (Privado)

**URL Privada:** `/demoambiente/analytics-admin`

Esta ruta NO está visible en el menú. Solo accesible por URL directa.

**Credencial de acceso:**
- **Password:** `adminanalytics2024`

---

## 📅 Versión

**Versión:** Demo Diciembre 2025  
**Última actualización:** 2025-12-09

---

*Desarrollado para DGFA Mendoza - Licitación Sistema de Trazabilidad RRPP*
