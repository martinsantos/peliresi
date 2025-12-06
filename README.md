# Sistema de Trazabilidad de Residuos Peligrosos - Demo

## Descripción
Sistema completo para la gestión y trazabilidad de residuos peligrosos según la Ley 24.051, implementado con arquitectura moderna y escalable para la DGFA de Mendoza.

## Arquitectura

### Backend
- **Node.js + Express + TypeScript** - API RESTful
- **PostgreSQL + Prisma ORM** - Base de datos relacional
- **JWT** - Autenticación con tokens
- **bcryptjs** - Encriptación de contraseñas
- **QRCode** - Generación de códigos QR para manifiestos

### Frontend
- **React 18 + TypeScript** - Interfaz de usuario
- **Vite** - Build tool y dev server
- **React Router v6** - Navegación SPA
- **Leaflet + React-Leaflet** - Mapas interactivos para tracking GPS
- **Lucide React** - Iconografía
- **Axios** - Cliente HTTP

## Requisitos

- Node.js 18+ 
- PostgreSQL 14+ (o Docker)
- npm o yarn

## Instalación

### 1. Clonar e instalar dependencias

```bash
# Backend
cd trazabilidad-rrpp-demo/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configurar base de datos

Opción A: PostgreSQL local
```bash
# Crear base de datos
createdb trazabilidad_rrpp

# Configurar .env en backend/
DATABASE_URL="postgresql://tu_usuario:tu_password@localhost:5432/trazabilidad_rrpp?schema=public"
```

Opción B: Docker
```bash
docker run --name trazabilidad-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=trazabilidad_rrpp -p 5432:5432 -d postgres:14
```

### 3. Ejecutar migraciones y seed

```bash
cd backend

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Cargar datos de prueba
npm run db:seed
```

### 4. Iniciar la aplicación

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

La aplicación estará disponible en:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## Usuarios de prueba

| Rol | Email | Contraseña |
|-----|-------|------------|
| **Admin DGFA** | admin@dgfa.mendoza.gov.ar | admin123 |
| **Generador** | quimica.mendoza@industria.com | gen123 |
| **Transportista** | transportes.andes@logistica.com | trans123 |
| **Operador** | tratamiento.residuos@planta.com | op123 |

## Funcionalidades de la Demo

### 1. Dashboard
- Estadísticas de manifiestos por estado
- Manifiestos recientes
- Transportes activos en tiempo real

### 2. Gestión de Manifiestos
- Listado con filtros y paginación
- Crear nuevo manifiesto (Generador)
- Firmar electrónicamente
- Flujo completo: Creación → Firma → Retiro → Transporte → Entrega → Recepción → Tratamiento

### 3. Tracking GPS
- Mapa interactivo con ubicación de transportes
- Visualización de rutas
- Detalles del transporte seleccionado

### 4. Flujo de trabajo por rol

**Generador:**
- Crear manifiesto con residuos
- Asignar transportista y operador
- Firmar electrónicamente

**Transportista:**
- Ver manifiestos asignados
- Confirmar retiro de carga
- Actualizar ubicación GPS
- Confirmar entrega en destino

**Operador:**
- Ver entregas pendientes
- Confirmar recepción
- Registrar tratamiento
- Cerrar manifiesto

**Administrador DGFA:**
- Visualizar todo el sistema
- Monitorear transportes en tiempo real
- Acceso a reportes y estadísticas
- Gestión de catálogos y usuarios (Configuración)

### 5. Demo de App Móvil 📱

**Acceso**: Desde el Dashboard web, hacer clic en la tarjeta "Versión Móvil Disponible"

La demo incluye simuladores visuales de apps móviles para:

**App del Transportista:**
- Dashboard con resumen de tareas (Retiros pendientes, En viaje)
- Lista de manifiestos asignados con información detallada
- Botones de acción contextuales (Iniciar Retiro, Reportar Incidente, Confirmar Llegada)
- Navegación por tabs (Pendientes, En Curso, Historial)
- Botón flotante de escaneo QR
- Interfaz táctil optimizada para uso en ruta

**App del Operador:**
- Dashboard de recepción con manifiestos entrantes
- Visualización de ETA (tiempo estimado de llegada)
- Comparador visual de peso declarado vs real
- Indicadores de diferencias con alertas
- Botones de Aprobación/Rechazo de carga
- Navegación por tabs (En Camino, Recibidos, Tratados)
- Botón flotante para captura de evidencia fotográfica

**Características del Simulador:**
- Marco realista de teléfono (iPhone/Android)
- Status bar funcional (hora, señal, batería)
- Contenido scrolleable dentro de la app
- Selector de roles para cambiar entre Transportista y Operador
- Diseño Mobile-First completamente responsive

Ver documentación completa en [MOBILE_DEMO.md](./MOBILE_DEMO.md)

### 6. Códigos QR

Los manifiestos firmados generan automáticamente un código QR único que contiene:
- Número de manifiesto
- ID del manifiesto
- Timestamp de generación

**Acceso**: En el detalle de cualquier manifiesto firmado, botón "Ver QR"

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `GET /api/auth/profile` - Obtener perfil
- `POST /api/auth/logout` - Cerrar sesión

### Manifiestos
- `GET /api/manifiestos/dashboard` - Estadísticas
- `GET /api/manifiestos` - Listar manifiestos
- `GET /api/manifiestos/:id` - Detalle de manifiesto
- `POST /api/manifiestos` - Crear manifiesto
- `POST /api/manifiestos/:id/firmar` - Firmar manifiesto
- `POST /api/manifiestos/:id/confirmar-retiro` - Confirmar retiro
- `POST /api/manifiestos/:id/ubicacion` - Actualizar GPS
- `POST /api/manifiestos/:id/confirmar-entrega` - Confirmar entrega
- `POST /api/manifiestos/:id/confirmar-recepcion` - Confirmar recepción
- `POST /api/manifiestos/:id/cerrar` - Cerrar manifiesto

### Catálogos
- `GET /api/catalogos/tipos-residuos` - Tipos de residuos
- `GET /api/catalogos/generadores` - Generadores
- `GET /api/catalogos/transportistas` - Transportistas
- `GET /api/catalogos/operadores` - Operadores

## Estructura del Proyecto

```
trazabilidad-rrpp-demo/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Modelo de datos
│   │   ├── seed.ts          # Datos de prueba
│   │   └── migrations/      # Migraciones
│   └── src/
│       ├── controllers/     # Controladores
│       ├── routes/          # Rutas API
│       ├── middlewares/     # Autenticación, errores
│       ├── config/          # Configuración
│       └── index.ts         # Entrada
├── frontend/
│   └── src/
│       ├── components/      # Componentes reutilizables
│       ├── pages/           # Páginas de la aplicación
│       ├── context/         # Context API (Auth)
│       ├── services/        # Servicios API
│       ├── types/           # Tipos TypeScript
│       └── App.tsx          # Componente principal
└── README.md
```

## Stack Tecnológico

- **Backend**: Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Frontend**: React, TypeScript, Vite, Leaflet
- **Autenticación**: JWT
- **Base de datos**: PostgreSQL
- **Mapas**: OpenStreetMap + Leaflet

## Licencia

MIT - Desarrollado para la Dirección de Gestión y Fiscalización Ambiental (DGFA) de la Provincia de Mendoza.
