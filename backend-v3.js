const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100mb' }));

// ===== VERSIÓN 3.0: REGLAS DE NEGOCIO ESTRICTAS =====
// Cada rol SOLO ve los datos que le corresponden

// ===== USUARIOS CON ASOCIACIÓN A ACTORES =====
const usuarios = [
    { id: '1', nombre: 'Admin', apellido: 'DGFA', email: 'admin@dgfa.mendoza.gov.ar', rol: 'ADMIN', activo: true, createdAt: '2026-01-01T10:00:00Z' },
    { id: '2', nombre: 'Juan', apellido: 'Pérez', email: 'generador@demo.com', rol: 'GENERADOR', activo: true, createdAt: '2026-01-02T11:00:00Z', generadorId: 'g1', generador: { id: 'g1', razonSocial: 'Industrias del Norte SA' } },
    { id: '3', nombre: 'María', apellido: 'González', email: 'maria@generador.com', rol: 'GENERADOR', activo: true, createdAt: '2026-01-03T09:00:00Z', generadorId: 'g2', generador: { id: 'g2', razonSocial: 'Química Cuyo SRL' } },
    { id: '4', nombre: 'Carlos', apellido: 'López', email: 'transportista@demo.com', rol: 'TRANSPORTISTA', activo: true, createdAt: '2026-01-04T14:00:00Z', transportistaId: 't1', transportista: { id: 't1', razonSocial: 'Transportes López' } },
    { id: '5', nombre: 'Pedro', apellido: 'Martínez', email: 'pedro@trans.com', rol: 'TRANSPORTISTA', activo: true, createdAt: '2026-01-05T08:00:00Z', transportistaId: 't2', transportista: { id: 't2', razonSocial: 'Logística Andina' } },
    { id: '6', nombre: 'Roberto', apellido: 'Silva', email: 'operador@demo.com', rol: 'OPERADOR', activo: true, createdAt: '2026-01-06T10:00:00Z', operadorId: 'o1', operador: { id: 'o1', razonSocial: 'Planta Tratamiento Mendoza' } },
    { id: '7', nombre: 'Laura', apellido: 'Fernández', email: 'laura@planta.com', rol: 'OPERADOR', activo: true, createdAt: '2026-01-07T11:00:00Z', operadorId: 'o2', operador: { id: 'o2', razonSocial: 'EcoTrat SA' } }
];

// ===== MAPEO TOKEN → USUARIO (Para Demo) =====
const tokenToUser = {
    'demo-token-admin': usuarios[0],
    'demo-token-generador': usuarios[1],
    'demo-token-transportista': usuarios[3],
    'demo-token-operador': usuarios[5]
};

// ===== MIDDLEWARE: EXTRAER USUARIO DEL TOKEN =====
const extractUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        req.user = tokenToUser[token] || null;
    }
    // También intentar extraer de headers específicos (fallback)
    if (!req.user && req.headers['x-user-role']) {
        const rol = req.headers['x-user-role'];
        const actorId = req.headers['x-actor-id'];
        req.user = usuarios.find(u => u.rol === rol &&
            (u.generadorId === actorId || u.transportistaId === actorId || u.operadorId === actorId || rol === 'ADMIN'));
    }
    next();
};

app.use(extractUser);

// Manifiestos con estados reales
let manifiestos = [
    { id: '1', numero: 'MAN-2026-0001', estado: 'EN_TRANSITO', generadorId: 'g1', generador: { razonSocial: 'Industrias del Norte SA' }, transportistaId: 't1', transportista: { razonSocial: 'Transportes López' }, operadorId: 'o1', operador: { razonSocial: 'Planta Tratamiento Mendoza' }, tipoResiduo: 'Solventes usados', pesoKg: 1500, origen: 'Buenos Aires', destino: 'Mendoza', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-11T14:30:00Z', inicioTransporte: '2026-01-11T14:30:00Z' },
    { id: '2', numero: 'MAN-2026-0002', estado: 'APROBADO', generadorId: 'g1', generador: { razonSocial: 'Industrias del Norte SA' }, transportistaId: 't1', transportista: { razonSocial: 'Transportes López' }, operadorId: 'o1', operador: { razonSocial: 'Planta Tratamiento Mendoza' }, tipoResiduo: 'Aceites minerales', pesoKg: 2000, origen: 'San Juan', destino: 'Mendoza', createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T16:00:00Z' },
    { id: '3', numero: 'MAN-2026-0003', estado: 'RECIBIDO', generadorId: 'g1', generador: { razonSocial: 'Industrias del Norte SA' }, transportistaId: 't2', transportista: { razonSocial: 'Logística Andina' }, operadorId: 'o1', operador: { razonSocial: 'Planta Tratamiento Mendoza' }, tipoResiduo: 'Baterías de plomo', pesoKg: 800, origen: 'Córdoba', destino: 'Mendoza', createdAt: '2026-01-09T09:00:00Z', updatedAt: '2026-01-11T11:00:00Z' },
    { id: '4', numero: 'MAN-2026-0004', estado: 'TRATADO', generadorId: 'g2', generador: { razonSocial: 'Química Cuyo SRL' }, transportistaId: 't2', transportista: { razonSocial: 'Logística Andina' }, operadorId: 'o2', operador: { razonSocial: 'EcoTrat SA' }, tipoResiduo: 'Residuos hospitalarios', pesoKg: 500, origen: 'Mendoza', destino: 'Luján', createdAt: '2026-01-08T07:00:00Z', updatedAt: '2026-01-10T18:00:00Z' },
    { id: '5', numero: 'MAN-2026-0005', estado: 'APROBADO', generadorId: 'g2', generador: { razonSocial: 'Química Cuyo SRL' }, transportistaId: 't2', transportista: { razonSocial: 'Logística Andina' }, operadorId: 'o2', operador: { razonSocial: 'EcoTrat SA' }, tipoResiduo: 'Filtros de aceite', pesoKg: 300, origen: 'San Luis', destino: 'Mendoza', createdAt: '2026-01-11T06:00:00Z', updatedAt: '2026-01-12T08:00:00Z' },
    { id: '6', numero: 'MAN-2026-0006', estado: 'BORRADOR', generadorId: 'g2', generador: { razonSocial: 'Química Cuyo SRL' }, transportistaId: null, transportista: null, operadorId: null, operador: null, tipoResiduo: 'Envases contaminados', pesoKg: 1200, origen: 'La Plata', destino: 'Por definir', createdAt: '2026-01-12T09:00:00Z', updatedAt: '2026-01-12T09:00:00Z' },
    { id: '7', numero: 'MAN-2026-0007', estado: 'ENTREGADO', generadorId: 'g1', generador: { razonSocial: 'Industrias del Norte SA' }, transportistaId: 't2', transportista: { razonSocial: 'Logística Andina' }, operadorId: 'o1', operador: { razonSocial: 'Planta Tratamiento Mendoza' }, tipoResiduo: 'Lodos industriales', pesoKg: 3000, origen: 'Salta', destino: 'Mendoza Sur', createdAt: '2026-01-08T05:00:00Z', updatedAt: '2026-01-12T10:00:00Z' },
    { id: '8', numero: 'MAN-2026-0008', estado: 'BORRADOR', generadorId: 'g2', generador: { razonSocial: 'Química Cuyo SRL' }, transportistaId: null, transportista: null, operadorId: null, operador: null, tipoResiduo: 'Catalizadores agotados', pesoKg: 450, origen: 'Jujuy', destino: 'Por definir', createdAt: '2026-01-12T10:00:00Z', updatedAt: '2026-01-12T10:00:00Z' },
    { id: '9', numero: 'MAN-2026-0009', estado: 'CERRADO', generadorId: 'g1', generador: { razonSocial: 'Industrias del Norte SA' }, transportistaId: 't1', transportista: { razonSocial: 'Transportes López' }, operadorId: 'o1', operador: { razonSocial: 'Planta Tratamiento Mendoza' }, tipoResiduo: 'Residuos electrónicos', pesoKg: 750, pesoRecibido: 745, origen: 'Buenos Aires', destino: 'Mendoza', createdAt: '2026-01-05T08:00:00Z', updatedAt: '2026-01-08T16:00:00Z', inicioTransporte: '2026-01-06T09:00:00Z', finTransporte: '2026-01-07T14:00:00Z', tipoTratamiento: 'Reciclaje y recuperación de metales', fechaTratamiento: '2026-01-08T10:00:00Z', fechaCierre: '2026-01-08T16:00:00Z', certificadoDisposicion: 'CERT-2026-0009', observacionesCierre: 'Ciclo completo - Disposición final certificada' }
];

const actividades = [
    { id: 'a1', tipo: 'MANIFIESTO', accion: 'CREACION', descripcion: 'Nuevo manifiesto MAN-2026-0008 creado', fecha: '2026-01-12T10:00:00Z', usuario: { nombre: 'María', apellido: 'González', rol: 'GENERADOR' }, manifiesto: { numero: 'MAN-2026-0008', estado: 'BORRADOR' }, metadata: {} },
    { id: 'a2', tipo: 'MANIFIESTO', accion: 'TRANSITO', descripcion: 'Manifiesto MAN-2026-0001 en tránsito', fecha: '2026-01-11T14:30:00Z', usuario: { nombre: 'Carlos', apellido: 'López', rol: 'TRANSPORTISTA' }, manifiesto: { numero: 'MAN-2026-0001', estado: 'EN_TRANSITO' }, metadata: {} },
    { id: 'a3', tipo: 'MANIFIESTO', accion: 'ENTREGA', descripcion: 'Manifiesto MAN-2026-0007 entregado en destino', fecha: '2026-01-12T10:00:00Z', usuario: { nombre: 'Pedro', apellido: 'Martínez', rol: 'TRANSPORTISTA' }, manifiesto: { numero: 'MAN-2026-0007', estado: 'ENTREGADO' }, metadata: {} },
    { id: 'a4', tipo: 'MANIFIESTO', accion: 'RECEPCION', descripcion: 'Manifiesto MAN-2026-0003 recibido en planta', fecha: '2026-01-11T11:00:00Z', usuario: { nombre: 'Roberto', apellido: 'Silva', rol: 'OPERADOR' }, manifiesto: { numero: 'MAN-2026-0003', estado: 'RECIBIDO' }, metadata: {} },
    { id: 'a5', tipo: 'SISTEMA', accion: 'LOGIN', descripcion: 'Inicio de sesión exitoso', fecha: '2026-01-12T07:30:00Z', usuario: { nombre: 'Admin', apellido: 'DGFA', rol: 'ADMIN' }, manifiesto: null, metadata: {} }
];

const tiposResiduo = [
    { id: '1', nombre: 'Solventes usados', codigo: 'Y6', categoria: 'Y', unidadMedida: 'kg' },
    { id: '2', nombre: 'Aceites minerales usados', codigo: 'Y8', categoria: 'Y', unidadMedida: 'litros' },
    { id: '3', nombre: 'Baterías de plomo', codigo: 'Y31', categoria: 'Y', unidadMedida: 'kg' },
    { id: '4', nombre: 'Residuos hospitalarios', codigo: 'Y1', categoria: 'Y', unidadMedida: 'kg' },
    { id: '5', nombre: 'Envases contaminados', codigo: 'Y12', categoria: 'Y', unidadMedida: 'unidades' },
    { id: '6', nombre: 'Filtros de aceite', codigo: 'Y9', categoria: 'Y', unidadMedida: 'kg' },
    { id: '7', nombre: 'Lodos industriales', codigo: 'Y18', categoria: 'Y', unidadMedida: 'kg' },
    { id: '8', nombre: 'Catalizadores agotados', codigo: 'Y22', categoria: 'Y', unidadMedida: 'kg' }
];

const transportistas = [
    { id: 't1', razonSocial: 'Transportes López', cuit: '20-31234567-0', numeroHabilitacion: 'TRP-2024-001', activo: true, vehiculos: [{ patente: 'AB123CD' }], choferes: [{ nombre: 'Carlos López' }] },
    { id: 't2', razonSocial: 'Logística Andina', cuit: '20-31234568-1', numeroHabilitacion: 'TRP-2024-002', activo: true, vehiculos: [{ patente: 'EF456GH' }], choferes: [{ nombre: 'Pedro Martínez' }] }
];

const operadores = [
    { id: 'o1', razonSocial: 'Planta Tratamiento Mendoza', cuit: '30-81234567-2', numeroHabilitacion: 'OP-2024-001', categoria: 'A', activo: true },
    { id: 'o2', razonSocial: 'EcoTrat SA', cuit: '30-81234568-3', numeroHabilitacion: 'OP-2024-002', categoria: 'B', activo: true }
];

const generadores = [
    { id: 'g1', razonSocial: 'Industrias del Norte SA', cuit: '30-71234567-8', numeroInscripcion: 'GEN-001', categoria: 'A', activo: true },
    { id: 'g2', razonSocial: 'Química Cuyo SRL', cuit: '30-71234568-9', numeroInscripcion: 'GEN-002', categoria: 'B', activo: true }
];

const reglasAlerta = [
    { id: '1', nombre: 'Tiempo Excesivo en Tránsito', evento: 'TIEMPO_EXCESIVO', umbralHoras: 48, activa: true, severidad: 'CRITICAL' },
    { id: '2', nombre: 'Vencimiento de Habilitación', evento: 'VENCIMIENTO', diasAnticipacion: 30, activa: true, severidad: 'WARNING' },
    { id: '3', nombre: 'Desvío de Ruta', evento: 'DESVIO_RUTA', distanciaMaxKm: 50, activa: true, severidad: 'WARNING' },
    { id: '4', nombre: 'Parada Prolongada', evento: 'PARADA_PROLONGADA', minutosMaximo: 120, activa: true, severidad: 'INFO' }
];

// ===== HELPER: FILTRAR MANIFIESTOS POR ROL =====
function filtrarManifiestosPorRol(user, lista) {
    if (!user) return lista; // Sin auth, devuelve todo (para compatibilidad)

    switch (user.rol) {
        case 'ADMIN':
            return lista; // Admin ve todo
        case 'GENERADOR':
            return lista.filter(m => m.generadorId === user.generadorId);
        case 'TRANSPORTISTA':
            return lista.filter(m => m.transportistaId === user.transportistaId);
        case 'OPERADOR':
            return lista.filter(m => m.operadorId === user.operadorId);
        default:
            return [];
    }
}

// ===== HELPER: VALIDAR ACCESO A UN MANIFIESTO =====
function tieneAcceso(user, manifiesto) {
    if (!user) return true; // Sin auth, permitir (compatibilidad)
    if (!manifiesto) return false;

    switch (user.rol) {
        case 'ADMIN':
            return true;
        case 'GENERADOR':
            return manifiesto.generadorId === user.generadorId;
        case 'TRANSPORTISTA':
            return manifiesto.transportistaId === user.transportistaId;
        case 'OPERADOR':
            return manifiesto.operadorId === user.operadorId;
        default:
            return false;
    }
}

// ===== HEALTH =====
app.get('/api/health', (req, res) => res.json({
    status: 'ok',
    version: '3.1-full-workflow',
    service: 'SITREP',
    features: [
        'role-based-filtering',
        'unique-trip-validation',
        'actor-notifications',
        'pdf-generation',
        'certificado-disposicion',
        'estado-cerrado',
        'firma-alternativa-token-sms'
    ],
    timestamp: new Date().toISOString()
}));

// ===== AUTH =====
app.post('/api/auth/login', (req, res) => res.json({ success: true, data: { user: usuarios[0], tokens: { accessToken: 'demo-token-admin', refreshToken: 'refresh' } } }));
app.get('/api/auth/me', (req, res) => res.json(req.user || usuarios[0]));
app.get('/api/auth/profile', (req, res) => res.json({ success: true, data: { user: req.user || usuarios[0] } }));
app.post('/api/auth/logout', (req, res) => res.json({ success: true }));

// ===== CATALOGOS =====
app.get('/api/catalogos/transportistas', (req, res) => res.json({ success: true, data: transportistas }));
app.get('/api/catalogos/operadores', (req, res) => res.json({ success: true, data: operadores }));
app.get('/api/catalogos/generadores', (req, res) => res.json({ success: true, data: generadores }));
app.get('/api/catalogos/tipos-residuos', (req, res) => res.json({ success: true, data: tiposResiduo }));
app.get('/api/tipos-residuo', (req, res) => res.json({ success: true, data: tiposResiduo }));

// ===== MANIFIESTOS (FILTRADO POR ROL) =====
app.get('/api/manifiestos', (req, res) => {
    const { estado, page = 1, limit = 20 } = req.query;

    // 🔐 REGLA DE NEGOCIO: Filtrar según rol del usuario
    let filtered = filtrarManifiestosPorRol(req.user, manifiestos);

    // Filtros adicionales opcionales
    if (estado) filtered = filtered.filter(m => m.estado === estado);

    // Log para debug
    console.log(`[GET /manifiestos] User: ${req.user?.nombre || 'anon'} (${req.user?.rol || 'N/A'}) → ${filtered.length} manifiestos`);

    res.json({
        success: true,
        data: {
            manifiestos: filtered,
            pagination: { page: +page, limit: +limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) },
            _meta: {
                filteredByRole: req.user?.rol || 'none',
                actorId: req.user?.generadorId || req.user?.transportistaId || req.user?.operadorId || null
            }
        }
    });
});

app.get('/api/manifiestos/dashboard', (req, res) => {
    // 🔐 REGLA DE NEGOCIO: Dashboard muestra solo datos del usuario
    const misManifiestos = filtrarManifiestosPorRol(req.user, manifiestos);
    const porEstado = misManifiestos.reduce((acc, m) => { acc[m.estado] = (acc[m.estado] || 0) + 1; return acc; }, {});

    res.json({
        success: true,
        data: {
            total: misManifiestos.length,
            porEstado,
            recientes: misManifiestos.slice(0, 5),
            _meta: { filteredByRole: req.user?.rol || 'none' }
        }
    });
});

app.get('/api/manifiestos/:id', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);

    // 🔐 REGLA DE NEGOCIO: Validar acceso al manifiesto
    if (!m) {
        return res.status(404).json({ success: false, error: 'No encontrado' });
    }

    if (!tieneAcceso(req.user, m)) {
        console.log(`[ACCESO DENEGADO] User ${req.user?.nombre} (${req.user?.rol}) intentó acceder a manifiesto ${m.numero}`);
        return res.status(403).json({ success: false, error: 'No tienes permiso para ver este manifiesto' });
    }

    res.json({ success: true, data: { manifiesto: m } });
});

app.post('/api/manifiestos', (req, res) => {
    const { transportistaId, operadorId, residuos, observaciones } = req.body;

    // 🔐 REGLA: Solo GENERADOR o ADMIN pueden crear manifiestos
    if (req.user && !['ADMIN', 'GENERADOR'].includes(req.user.rol)) {
        return res.status(403).json({ success: false, error: 'Solo generadores pueden crear manifiestos' });
    }

    const trans = transportistas.find(t => t.id === transportistaId);
    const oper = operadores.find(o => o.id === operadorId);
    const nuevoId = String(manifiestos.length + 1);
    const nuevoNumero = 'MAN-2026-' + String(manifiestos.length + 1).padStart(4, '0');

    // El generadorId viene del usuario autenticado
    const generadorId = req.user?.generadorId || 'g1';
    const generadorInfo = generadores.find(g => g.id === generadorId);

    const nuevo = {
        id: nuevoId, numero: nuevoNumero, estado: 'BORRADOR',
        generadorId, generador: { razonSocial: generadorInfo?.razonSocial || 'Generador Demo' },
        transportistaId, transportista: trans ? { razonSocial: trans.razonSocial } : null,
        operadorId, operador: oper ? { razonSocial: oper.razonSocial } : null,
        residuos, observaciones,
        tipoResiduo: residuos?.[0]?.descripcion || 'Residuo',
        pesoKg: residuos?.reduce((sum, r) => sum + (r.cantidad || 0), 0) || 0,
        origen: 'Generador Demo', destino: oper?.razonSocial || 'Destino',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    manifiestos.push(nuevo);

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'CREACION',
        descripcion: `Nuevo manifiesto ${nuevoNumero} creado por ${req.user?.nombre || 'Usuario'}`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Usuario', apellido: req.user?.apellido || 'Demo', rol: req.user?.rol || 'GENERADOR' },
        manifiesto: { numero: nuevoNumero, estado: 'BORRADOR' },
        metadata: {}
    });

    res.json({ success: true, data: { manifiesto: nuevo }, message: 'Manifiesto creado exitosamente' });
});

app.post('/api/manifiestos/:id/firmar', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'No encontrado' });

    // 🔐 REGLA: Solo el generador dueño o ADMIN puede firmar
    if (!tieneAcceso(req.user, m)) {
        return res.status(403).json({ success: false, error: 'No tienes permiso para firmar este manifiesto' });
    }

    m.estado = 'PENDIENTE_APROBACION';
    m.updatedAt = new Date().toISOString();

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'FIRMA',
        descripcion: `Manifiesto ${m.numero} firmado por ${req.user?.nombre || 'Generador'}`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Generador', apellido: req.user?.apellido || 'Demo', rol: req.user?.rol || 'GENERADOR' },
        manifiesto: { numero: m.numero, estado: m.estado },
        metadata: {}
    });

    res.json({ success: true, data: { manifiesto: m } });
});

// ===== WORKFLOW: CONFIRMAR RETIRO CON VALIDACIÓN =====
app.post('/api/manifiestos/:id/confirmar-retiro', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });

    // 🔐 REGLA: Solo el transportista asignado puede confirmar retiro
    if (req.user && req.user.rol === 'TRANSPORTISTA' && m.transportistaId !== req.user.transportistaId) {
        return res.status(403).json({ success: false, error: 'Este manifiesto no está asignado a ti' });
    }

    // ⚠️ VALIDACIÓN: No permitir 2 viajes simultáneos
    const viajeActivo = manifiestos.find(x =>
        x.transportistaId === m.transportistaId &&
        x.estado === 'EN_TRANSITO' &&
        x.id !== m.id
    );

    if (viajeActivo) {
        return res.status(409).json({
            success: false,
            error: 'VIAJE_ACTIVO_EXISTENTE',
            message: `Ya tienes un viaje activo: ${viajeActivo.numero}. Debes finalizarlo antes de iniciar otro.`,
            viajeActivo: { id: viajeActivo.id, numero: viajeActivo.numero }
        });
    }

    m.estado = 'EN_TRANSITO';
    m.updatedAt = new Date().toISOString();
    m.inicioTransporte = new Date().toISOString();

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'TRANSITO',
        descripcion: `${req.user?.nombre || 'Transportista'} inició viaje con ${m.numero}`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Transportista', apellido: req.user?.apellido || 'Demo', rol: 'TRANSPORTISTA' },
        manifiesto: { numero: m.numero, estado: m.estado },
        metadata: { ubicacion: req.body.ubicacion }
    });

    res.json({ success: true, data: { manifiesto: m }, message: 'Retiro confirmado, viaje iniciado' });
});

// ===== WORKFLOW: UBICACIÓN GPS =====
app.post('/api/manifiestos/:id/ubicacion', (req, res) => {
    const { lat, lng, timestamp } = req.body;
    const m = manifiestos.find(x => x.id === req.params.id);

    if (!m) return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });

    // 🔐 REGLA: Solo el transportista asignado puede actualizar ubicación
    if (req.user && req.user.rol === 'TRANSPORTISTA' && m.transportistaId !== req.user.transportistaId) {
        return res.status(403).json({ success: false, error: 'No puedes actualizar ubicación de este viaje' });
    }

    m.ubicacionActual = { lat, lng, timestamp: timestamp || new Date().toISOString() };
    res.json({ success: true, message: 'Ubicación actualizada' });
});

// ===== WORKFLOW: CONFIRMAR ENTREGA =====
app.post('/api/manifiestos/:id/confirmar-entrega', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });

    // 🔐 REGLA: Solo el transportista asignado puede confirmar entrega
    if (req.user && req.user.rol === 'TRANSPORTISTA' && m.transportistaId !== req.user.transportistaId) {
        return res.status(403).json({ success: false, error: 'Este viaje no te pertenece' });
    }

    m.estado = 'ENTREGADO';
    m.updatedAt = new Date().toISOString();
    m.finTransporte = new Date().toISOString();

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'ENTREGA',
        descripcion: `${req.user?.nombre || 'Transportista'} entregó ${m.numero} en ${m.operador?.razonSocial || 'destino'}`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Transportista', apellido: req.user?.apellido || 'Demo', rol: 'TRANSPORTISTA' },
        manifiesto: { numero: m.numero, estado: m.estado },
        metadata: {}
    });

    res.json({ success: true, data: { manifiesto: m }, message: 'Entrega confirmada' });
});

// ===== WORKFLOW: CONFIRMAR RECEPCIÓN (Operador) =====
app.post('/api/manifiestos/:id/confirmar-recepcion', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });

    // 🔐 REGLA: Solo el operador destino puede confirmar recepción
    if (req.user && req.user.rol === 'OPERADOR' && m.operadorId !== req.user.operadorId) {
        return res.status(403).json({ success: false, error: 'Este manifiesto no está destinado a tu planta' });
    }

    m.estado = 'RECIBIDO';
    m.updatedAt = new Date().toISOString();
    m.pesoRecibido = req.body.pesoRecibido || m.pesoKg;
    m.observacionesRecepcion = req.body.observaciones;

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'RECEPCION',
        descripcion: `${req.user?.nombre || 'Operador'} confirmó recepción de ${m.numero}`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Operador', apellido: req.user?.apellido || 'Demo', rol: 'OPERADOR' },
        manifiesto: { numero: m.numero, estado: m.estado },
        metadata: { pesoRecibido: m.pesoRecibido }
    });

    res.json({ success: true, data: { manifiesto: m }, message: 'Recepción confirmada' });
});

// ===== WORKFLOW: TRATAMIENTO =====
app.post('/api/manifiestos/:id/tratamiento', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });

    // 🔐 REGLA: Solo el operador destino puede registrar tratamiento
    if (req.user && req.user.rol === 'OPERADOR' && m.operadorId !== req.user.operadorId) {
        return res.status(403).json({ success: false, error: 'No puedes registrar tratamiento en este manifiesto' });
    }

    m.estado = 'TRATADO';
    m.updatedAt = new Date().toISOString();
    m.tipoTratamiento = req.body.tipoTratamiento || 'Tratamiento estándar';
    m.fechaTratamiento = new Date().toISOString();

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'TRATAMIENTO',
        descripcion: `${req.user?.nombre || 'Operador'} completó tratamiento de ${m.numero}`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Operador', apellido: req.user?.apellido || 'Demo', rol: 'OPERADOR' },
        manifiesto: { numero: m.numero, estado: m.estado },
        metadata: {}
    });

    res.json({ success: true, data: { manifiesto: m }, message: 'Tratamiento registrado' });
});

// ===== WORKFLOW: APROBAR MANIFIESTO (Solo ADMIN) =====
app.post('/api/manifiestos/:id/aprobar', (req, res) => {
    // 🔐 REGLA: Solo ADMIN puede aprobar
    if (req.user && req.user.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Solo administradores pueden aprobar manifiestos' });
    }

    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'No encontrado' });

    m.estado = 'APROBADO';
    m.updatedAt = new Date().toISOString();

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'APROBACION',
        descripcion: `Manifiesto ${m.numero} aprobado por ${req.user?.nombre || 'DGFA'}`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Admin', apellido: req.user?.apellido || 'DGFA', rol: 'ADMIN' },
        manifiesto: { numero: m.numero, estado: m.estado },
        metadata: {}
    });

    res.json({ success: true, data: { manifiesto: m }, message: 'Manifiesto aprobado' });
});

// ===== ASIGNAR TRANSPORTISTA (Solo ADMIN o GENERADOR dueño) =====
app.post('/api/manifiestos/:id/asignar-transportista', (req, res) => {
    const { transportistaId } = req.body;
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'No encontrado' });

    // 🔐 REGLA: Solo ADMIN o el generador dueño pueden asignar
    if (req.user && req.user.rol !== 'ADMIN' && (req.user.rol !== 'GENERADOR' || m.generadorId !== req.user.generadorId)) {
        return res.status(403).json({ success: false, error: 'No tienes permiso para asignar transportista a este manifiesto' });
    }

    const trans = transportistas.find(t => t.id === transportistaId);
    if (!trans) return res.status(400).json({ success: false, error: 'Transportista inválido' });

    // Verificar que transportista no tenga viaje activo
    const viajeActivo = manifiestos.find(x =>
        x.transportistaId === transportistaId && x.estado === 'EN_TRANSITO'
    );
    if (viajeActivo) {
        return res.status(409).json({
            success: false,
            error: 'TRANSPORTISTA_OCUPADO',
            message: `El transportista ${trans.razonSocial} tiene un viaje activo: ${viajeActivo.numero}`
        });
    }

    m.transportistaId = transportistaId;
    m.transportista = { razonSocial: trans.razonSocial };
    m.updatedAt = new Date().toISOString();

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'ASIGNACION',
        descripcion: `Manifiesto ${m.numero} asignado a ${trans.razonSocial}`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Sistema', apellido: req.user?.apellido || '', rol: req.user?.rol || 'SISTEMA' },
        manifiesto: { numero: m.numero, estado: m.estado },
        metadata: { transportistaId, transportistaNombre: trans.razonSocial }
    });

    res.json({ success: true, data: { manifiesto: m }, message: 'Transportista asignado' });
});

// ===== TRANSPORTISTA: VIAJE ACTIVO Y PENDIENTES =====
app.get('/api/transportista/:id/viaje-activo', (req, res) => {
    // 🔐 REGLA: Un transportista solo puede ver su propio viaje activo
    if (req.user && req.user.rol === 'TRANSPORTISTA' && req.user.transportistaId !== req.params.id) {
        return res.status(403).json({ success: false, error: 'No puedes ver información de otro transportista' });
    }

    const viajeActivo = manifiestos.find(m =>
        m.transportistaId === req.params.id && m.estado === 'EN_TRANSITO'
    );

    res.json({
        success: true,
        data: {
            viaje: viajeActivo || null,
            tieneViajeActivo: !!viajeActivo
        }
    });
});

app.get('/api/transportista/:id/pendientes', (req, res) => {
    // 🔐 REGLA: Un transportista solo puede ver sus propios pendientes
    if (req.user && req.user.rol === 'TRANSPORTISTA' && req.user.transportistaId !== req.params.id) {
        return res.status(403).json({ success: false, error: 'No puedes ver información de otro transportista' });
    }

    const pendientes = manifiestos.filter(m =>
        m.transportistaId === req.params.id && m.estado === 'APROBADO'
    );

    res.json({ success: true, data: { manifiestos: pendientes, total: pendientes.length } });
});

// ===== SYNC OFFLINE =====
app.post('/api/viajes/sync', (req, res) => {
    const { eventos } = req.body;
    console.log('Sync offline recibido:', eventos?.length || 0, 'eventos');
    res.json({ success: true, message: 'Viaje sincronizado', sincronizados: eventos?.length || 0 });
});

// ===== NOTIFICACIONES FILTRADAS POR ACTOR =====
app.get('/api/notificaciones', (req, res) => {
    // 🔐 Notificaciones genéricas (fallback)
    res.json({
        notificaciones: [
            { id: '1', tipo: 'INFO', titulo: 'Bienvenido a SITREP', mensaje: 'Sistema de trazabilidad activo', prioridad: 'NORMAL', leida: false, createdAt: new Date().toISOString() }
        ],
        noLeidas: 1
    });
});

// ===== NOTIFICACIONES: MIS ALERTAS FILTRADAS =====
app.get('/api/notificaciones/mis-alertas', (req, res) => {
    // 🔐 Usar usuario del token, NO de query params
    const user = req.user;
    const rol = user?.rol || req.query.rol;
    const actorId = user?.generadorId || user?.transportistaId || user?.operadorId || req.query.actorId;

    let notificaciones = [];

    if (rol === 'GENERADOR' && actorId) {
        const misManifiestos = manifiestos.filter(m => m.generadorId === actorId);
        misManifiestos.forEach(m => {
            if (m.estado === 'EN_TRANSITO') {
                notificaciones.push({ id: 'n-g-' + m.id, tipo: 'ESTADO', titulo: 'Tu manifiesto en tránsito', mensaje: `${m.numero} está siendo transportado`, manifiestoId: m.id, relevancia: 'DIRECTA', prioridad: 'ALTA', leida: false, createdAt: m.updatedAt });
            }
            if (m.estado === 'ENTREGADO') {
                notificaciones.push({ id: 'n-g2-' + m.id, tipo: 'ESTADO', titulo: 'Tu manifiesto entregado', mensaje: `${m.numero} fue entregado en destino`, manifiestoId: m.id, relevancia: 'DIRECTA', prioridad: 'NORMAL', leida: false, createdAt: m.updatedAt });
            }
        });
    }

    if (rol === 'TRANSPORTISTA' && actorId) {
        const misViajes = manifiestos.filter(m => m.transportistaId === actorId);
        const pendientes = misViajes.filter(m => m.estado === 'APROBADO');
        const activo = misViajes.find(m => m.estado === 'EN_TRANSITO');

        pendientes.forEach(m => {
            notificaciones.push({ id: 'n-t-' + m.id, tipo: 'ASIGNACION', titulo: 'Viaje asignado', mensaje: `Tienes pendiente el manifiesto ${m.numero}`, manifiestoId: m.id, relevancia: 'DIRECTA', prioridad: 'URGENTE', leida: false, createdAt: m.updatedAt });
        });

        if (activo) {
            notificaciones.push({ id: 'n-t-activo', tipo: 'EN_CURSO', titulo: 'Viaje activo', mensaje: `Tienes en curso ${activo.numero}`, manifiestoId: activo.id, relevancia: 'DIRECTA', prioridad: 'ALTA', leida: false, createdAt: activo.inicioTransporte });
        }
    }

    if (rol === 'OPERADOR' && actorId) {
        const enCamino = manifiestos.filter(m => m.operadorId === actorId && m.estado === 'EN_TRANSITO');
        const entregados = manifiestos.filter(m => m.operadorId === actorId && m.estado === 'ENTREGADO');

        enCamino.forEach(m => {
            notificaciones.push({ id: 'n-o-' + m.id, tipo: 'EN_CAMINO', titulo: 'Carga en camino', mensaje: `${m.numero} viene hacia tu planta (${m.pesoKg}kg)`, manifiestoId: m.id, relevancia: 'DIRECTA', prioridad: 'ALTA', leida: false, createdAt: m.inicioTransporte });
        });

        entregados.forEach(m => {
            notificaciones.push({ id: 'n-o2-' + m.id, tipo: 'RECEPCION_PENDIENTE', titulo: 'Pendiente de recepción', mensaje: `${m.numero} llegó y espera tu confirmación`, manifiestoId: m.id, relevancia: 'DIRECTA', prioridad: 'URGENTE', leida: false, createdAt: m.updatedAt });
        });
    }

    if (rol === 'ADMIN') {
        const enTransito = manifiestos.filter(m => m.estado === 'EN_TRANSITO');
        enTransito.forEach(m => {
            notificaciones.push({ id: 'n-a-' + m.id, tipo: 'MONITOREO', titulo: 'Manifiesto en tránsito', mensaje: `${m.numero} - ${m.transportista?.razonSocial || 'Sin asignar'}`, manifiestoId: m.id, relevancia: 'DIRECTA', prioridad: 'NORMAL', leida: false, createdAt: m.inicioTransporte });
        });
    }

    res.json({
        notificaciones: notificaciones.slice(0, 10),
        noLeidas: notificaciones.filter(n => !n.leida).length,
        _meta: { filteredByRole: rol, actorId }
    });
});

app.post('/api/notificaciones/:id/leer', (req, res) => {
    res.json({ success: true, message: 'Notificación marcada como leída' });
});

// ===== USUARIOS =====
app.get('/api/usuarios', (req, res) => res.json({ success: true, data: usuarios, total: usuarios.length }));

// ===== KPIs (Filtrados por rol) =====
app.get('/api/kpis', (req, res) => {
    const misManifiestos = filtrarManifiestosPorRol(req.user, manifiestos);
    const porEstado = misManifiestos.reduce((acc, m) => { acc[m.estado] = (acc[m.estado] || 0) + 1; return acc; }, {});

    res.json({ success: true, data: {
        manifiestos: { total: misManifiestos.length, ...porEstado },
        alertas: { criticas: 1, warnings: 1, info: 2 },
        usuarios: req.user?.rol === 'ADMIN' ? { total: usuarios.length, activos: usuarios.filter(u => u.activo).length } : undefined,
        _meta: { filteredByRole: req.user?.rol || 'none' }
    }});
});

// ===== ALERTAS (Arrays directos) =====
app.get('/api/alertas/advertencias', (req, res) => {
    res.json([
        { reglaId: '1', reglaNombre: 'Tiempo Excesivo en Tránsito', evento: 'TIEMPO_EXCESIVO', descripcion: 'MAN-2026-0001 lleva más de 48h en tránsito', severidad: 'CRITICAL', detalles: { manifiestoId: '1', horasTranscurridas: 52 }, accionRequerida: 'Verificar estado del transporte' }
    ]);
});

app.get('/api/alertas/evaluar-tiempos', (req, res) => {
    res.json([
        { reglaId: '1', reglaNombre: 'Tiempo Excesivo', evento: 'TIEMPO_EXCESIVO', descripcion: 'MAN-2026-0001 excede tiempo máximo', severidad: 'CRITICAL', detalles: { manifiestoId: '1', horasTranscurridas: 52, umbralHoras: 48 }, accionRequerida: 'Contactar transportista' }
    ]);
});

app.get('/api/alertas/evaluar-vencimientos', (req, res) => {
    res.json([
        { reglaId: '2', reglaNombre: 'Vencimiento Próximo', evento: 'VENCIMIENTO', descripcion: 'Habilitación TRP-2024-001 vence pronto', severidad: 'WARNING', detalles: { transportistaId: 't1', diasRestantes: 15, tipo: 'habilitacion' }, accionRequerida: 'Iniciar trámite de renovación' }
    ]);
});

app.get('/api/alertas/evaluar/:id', (req, res) => res.json([]));
app.get('/api/alertas/reglas', (req, res) => res.json(reglasAlerta));

// ===== ADMIN (Solo para ADMIN) =====
app.get('/api/admin/actividad', (req, res) => {
    // 🔐 REGLA: Solo ADMIN puede ver actividad global
    if (req.user && req.user.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Solo administradores pueden ver la actividad global' });
    }

    const { tipo, limit = 100 } = req.query;
    let filtered = [...actividades];
    if (tipo && tipo !== 'TODOS') filtered = filtered.filter(a => a.tipo === tipo);

    res.json({ success: true, data: {
        actividades: filtered.slice(0, +limit),
        stats: {
            eventosHoy: actividades.filter(a => new Date(a.fecha).toDateString() === new Date().toDateString()).length,
            manifestosActivos: manifiestos.filter(m => m.estado === 'EN_TRANSITO').length,
            usuariosActivos: usuarios.filter(u => u.activo).length
        },
        pagination: { page: 1, limit: +limit }
    }});
});

app.get('/api/admin/usuarios', (req, res) => {
    // 🔐 REGLA: Solo ADMIN puede ver usuarios
    if (req.user && req.user.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Solo administradores pueden ver usuarios' });
    }

    const { rol, activo, busqueda } = req.query;
    let filtered = [...usuarios];
    if (rol && rol !== 'TODOS') filtered = filtered.filter(u => u.rol === rol);
    if (busqueda) filtered = filtered.filter(u => u.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    const porRol = usuarios.reduce((acc, u) => { acc[u.rol] = (acc[u.rol] || 0) + 1; return acc; }, {});

    res.json({ success: true, data: {
        usuarios: filtered,
        stats: { total: usuarios.length, activos: usuarios.filter(u => u.activo).length, inactivos: 0, porRol },
        pagination: { page: 1, limit: 20, total: filtered.length, pages: 1 }
    }});
});

app.get('/api/admin/usuarios/pendientes', (req, res) => res.json({ success: true, data: { usuarios: [], total: 0 } }));

app.get('/api/admin/usuarios/:id', (req, res) => {
    if (req.user && req.user.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Solo administradores' });
    }
    const u = usuarios.find(x => x.id === req.params.id);
    if (u) res.json({ success: true, data: { usuario: u, actividadReciente: [] } });
    else res.status(404).json({ success: false, error: 'No encontrado' });
});

app.put('/api/admin/usuarios/:id', (req, res) => {
    if (req.user && req.user.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Solo administradores' });
    }
    res.json({ success: true, data: { usuario: usuarios[0] } });
});

app.post('/api/admin/usuarios/:id/aprobar', (req, res) => res.json({ success: true, data: { usuario: usuarios[0] } }));
app.post('/api/admin/usuarios/:id/rechazar', (req, res) => res.json({ success: true }));

app.get('/api/admin/estadisticas', (req, res) => {
    // 🔐 REGLA: Solo ADMIN puede ver estadísticas globales
    if (req.user && req.user.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Solo administradores pueden ver estadísticas globales' });
    }

    const porEstado = manifiestos.reduce((acc, m) => { acc[m.estado] = (acc[m.estado] || 0) + 1; return acc; }, {});
    const porRol = usuarios.reduce((acc, u) => { acc[u.rol] = (acc[u.rol] || 0) + 1; return acc; }, {});

    res.json({ success: true, data: {
        usuarios: { total: usuarios.length, activos: usuarios.filter(u => u.activo).length, pendientes: 0, porRol },
        manifiestos: { total: manifiestos.length, porEstado }
    }});
});

app.get('/api/admin/stats', (req, res) => {
    if (req.user && req.user.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Solo administradores' });
    }
    res.json({ success: true, data: {
        usuarios: { total: 7, activos: 7, pendientes: 0 },
        manifiestos: { total: manifiestos.length, hoy: 2, semana: 5 },
        alertas: { activas: 2, resueltas: 10 }
    }});
});

// ===== ACTORES =====
app.get('/api/actores/generadores', (req, res) => res.json({ success: true, data: { generadores, pagination: { page: 1, limit: 20, total: generadores.length, pages: 1 } } }));
app.get('/api/actores/transportistas', (req, res) => res.json({ success: true, data: { transportistas, pagination: { page: 1, limit: 20, total: transportistas.length, pages: 1 } } }));
app.get('/api/actores/operadores', (req, res) => res.json({ success: true, data: { operadores, pagination: { page: 1, limit: 20, total: operadores.length, pages: 1 } } }));

// ===== REPORTES (Filtrados por rol) =====
app.get('/api/reportes/manifiestos', (req, res) => {
    const misManifiestos = filtrarManifiestosPorRol(req.user, manifiestos);
    const porEstado = misManifiestos.reduce((acc, m) => { acc[m.estado] = (acc[m.estado] || 0) + 1; return acc; }, {});

    res.json({ success: true, data: {
        total: misManifiestos.length,
        porEstado,
        porMes: [],
        pesoTotal: misManifiestos.reduce((s, m) => s + m.pesoKg, 0),
        _meta: { filteredByRole: req.user?.rol || 'none' }
    }});
});

app.get('/api/reportes/tratados', (req, res) => {
    const misManifiestos = filtrarManifiestosPorRol(req.user, manifiestos);
    const tratados = misManifiestos.filter(m => m.estado === 'TRATADO');

    res.json({ success: true, data: {
        total: tratados.length,
        porTipoResiduo: {},
        pesoTratado: tratados.reduce((s, m) => s + m.pesoKg, 0)
    }});
});

app.get('/api/reportes/transporte', (req, res) => {
    const misManifiestos = filtrarManifiestosPorRol(req.user, manifiestos);

    res.json({ success: true, data: {
        viajesCompletados: misManifiestos.filter(m => ['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(m.estado)).length,
        viajesEnCurso: misManifiestos.filter(m => m.estado === 'EN_TRANSITO').length,
        promedioHorasTransito: 36
    }});
});

app.get('/api/reportes/auditoria', (req, res) => {
    // 🔐 Solo ADMIN ve auditoría completa
    if (req.user && req.user.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Solo administradores pueden ver auditoría' });
    }
    res.json({ success: true, data: { eventos: actividades, pagination: { page: 1, limit: 50, total: actividades.length } } });
});

// ===== TRACKING (Filtrado por rol) =====
app.get('/api/tracking/manifiestos', (req, res) => {
    let enTransito = manifiestos.filter(m => m.estado === 'EN_TRANSITO');

    // 🔐 REGLA: Filtrar tracking según rol
    if (req.user) {
        switch (req.user.rol) {
            case 'GENERADOR':
                enTransito = enTransito.filter(m => m.generadorId === req.user.generadorId);
                break;
            case 'TRANSPORTISTA':
                enTransito = enTransito.filter(m => m.transportistaId === req.user.transportistaId);
                break;
            case 'OPERADOR':
                enTransito = enTransito.filter(m => m.operadorId === req.user.operadorId);
                break;
            // ADMIN ve todo
        }
    }

    res.json({ success: true, data: enTransito.map(m => ({
        ...m,
        ubicacionActual: m.ubicacionActual || { lat: -32.889 + Math.random() * 0.1, lng: -68.844 + Math.random() * 0.1 }
    })), _meta: { filteredByRole: req.user?.rol || 'none' } });
});

// ===== WORKFLOW: CERRAR MANIFIESTO (Estado Final) =====
app.post('/api/manifiestos/:id/cerrar', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });

    // 🔐 REGLA: Solo el operador destino o ADMIN puede cerrar
    if (req.user && req.user.rol === 'OPERADOR' && m.operadorId !== req.user.operadorId) {
        return res.status(403).json({ success: false, error: 'No puedes cerrar este manifiesto' });
    }

    // Validar que esté en estado TRATADO antes de cerrar
    if (m.estado !== 'TRATADO') {
        return res.status(400).json({
            success: false,
            error: 'Solo se pueden cerrar manifiestos en estado TRATADO',
            estadoActual: m.estado
        });
    }

    m.estado = 'CERRADO';
    m.updatedAt = new Date().toISOString();
    m.fechaCierre = new Date().toISOString();
    m.certificadoDisposicion = `CERT-${m.numero.replace('MAN-', '')}`;
    m.observacionesCierre = req.body.observaciones || 'Ciclo completo';

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'CIERRE',
        descripcion: `Manifiesto ${m.numero} CERRADO - Ciclo completo`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Operador', apellido: req.user?.apellido || 'Demo', rol: req.user?.rol || 'OPERADOR' },
        manifiesto: { numero: m.numero, estado: m.estado },
        metadata: { certificado: m.certificadoDisposicion }
    });

    res.json({
        success: true,
        data: { manifiesto: m, certificado: m.certificadoDisposicion },
        message: 'Manifiesto cerrado. Certificado de disposición generado.'
    });
});

// ===== PDF DE MANIFIESTO CON QR (CU-G10) =====
app.get('/api/manifiestos/:id/pdf', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });

    // 🔐 REGLA: Verificar acceso al manifiesto
    if (!tieneAcceso(req.user, m)) {
        return res.status(403).json({ success: false, error: 'No tienes permiso para descargar este PDF' });
    }

    const generador = generadores.find(g => g.id === m.generadorId);
    const trans = transportistas.find(t => t.id === m.transportistaId);
    const oper = operadores.find(o => o.id === m.operadorId);

    // Generar contenido del PDF (HTML que se puede convertir a PDF en frontend)
    const qrUrl = `https://sitrep.ultimamilla.com.ar/api/public/verify/${m.id}`;

    const pdfData = {
        numero: m.numero,
        estado: m.estado,
        fechaEmision: m.createdAt,
        fechaActualizacion: m.updatedAt,

        generador: {
            razonSocial: generador?.razonSocial || m.generador?.razonSocial,
            cuit: generador?.cuit || 'N/A',
            inscripcion: generador?.numeroInscripcion || 'N/A'
        },

        transportista: {
            razonSocial: trans?.razonSocial || m.transportista?.razonSocial || 'No asignado',
            cuit: trans?.cuit || 'N/A',
            habilitacion: trans?.numeroHabilitacion || 'N/A',
            vehiculo: trans?.vehiculos?.[0]?.patente || 'N/A',
            chofer: trans?.choferes?.[0]?.nombre || 'N/A'
        },

        operador: {
            razonSocial: oper?.razonSocial || m.operador?.razonSocial || 'No asignado',
            cuit: oper?.cuit || 'N/A',
            habilitacion: oper?.numeroHabilitacion || 'N/A'
        },

        residuos: {
            tipo: m.tipoResiduo,
            peso: m.pesoKg,
            pesoRecibido: m.pesoRecibido || null,
            unidad: 'kg'
        },

        recorrido: {
            origen: m.origen,
            destino: m.destino,
            inicioTransporte: m.inicioTransporte || null,
            finTransporte: m.finTransporte || null
        },

        tratamiento: m.estado === 'TRATADO' || m.estado === 'CERRADO' ? {
            tipo: m.tipoTratamiento || 'No especificado',
            fecha: m.fechaTratamiento || null
        } : null,

        certificado: m.certificadoDisposicion || null,

        qrCode: qrUrl,
        qrVerificationUrl: qrUrl,

        firmas: {
            generador: { firmado: ['PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO', 'CERRADO'].includes(m.estado), fecha: m.createdAt },
            transportista: { firmado: ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO', 'CERRADO'].includes(m.estado), fecha: m.inicioTransporte },
            operador: { firmado: ['RECIBIDO', 'TRATADO', 'CERRADO'].includes(m.estado), fecha: m.updatedAt }
        }
    };

    res.json({
        success: true,
        data: pdfData,
        message: 'Datos del PDF generados. Use estos datos para renderizar el PDF en el cliente.'
    });
});

// ===== CERTIFICADO DE DISPOSICIÓN FINAL (CU-O10) =====
app.get('/api/manifiestos/:id/certificado', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });

    // Solo manifiestos TRATADO o CERRADO pueden tener certificado
    if (!['TRATADO', 'CERRADO'].includes(m.estado)) {
        return res.status(400).json({
            success: false,
            error: 'Solo manifiestos tratados o cerrados tienen certificado de disposición',
            estadoActual: m.estado
        });
    }

    const oper = operadores.find(o => o.id === m.operadorId);
    const generador = generadores.find(g => g.id === m.generadorId);

    const certificado = {
        numero: m.certificadoDisposicion || `CERT-${m.numero.replace('MAN-', '')}`,
        manifiesto: m.numero,
        fechaEmision: m.fechaCierre || m.fechaTratamiento || new Date().toISOString(),

        operador: {
            razonSocial: oper?.razonSocial || m.operador?.razonSocial,
            cuit: oper?.cuit || 'N/A',
            habilitacion: oper?.numeroHabilitacion || 'N/A',
            categoria: oper?.categoria || 'N/A'
        },

        generador: {
            razonSocial: generador?.razonSocial || m.generador?.razonSocial,
            cuit: generador?.cuit || 'N/A'
        },

        residuo: {
            tipo: m.tipoResiduo,
            pesoRecibido: m.pesoRecibido || m.pesoKg,
            unidad: 'kg'
        },

        tratamiento: {
            tipo: m.tipoTratamiento || 'Tratamiento según norma',
            fecha: m.fechaTratamiento || new Date().toISOString(),
            resultado: 'DISPOSICIÓN FINAL COMPLETADA'
        },

        declaracion: `Certifico que los residuos peligrosos descriptos en el Manifiesto ${m.numero} ` +
                     `han sido recibidos y sometidos a tratamiento/disposición final de acuerdo ` +
                     `a las normativas vigentes en la Provincia de Mendoza.`,

        firmaOperador: {
            nombre: oper?.razonSocial || 'Operador Autorizado',
            fecha: m.fechaCierre || new Date().toISOString(),
            sello: `OPERADOR HABILITADO - ${oper?.numeroHabilitacion || 'OP-XXXX'}`
        },

        qrVerification: `https://sitrep.ultimamilla.com.ar/api/public/verify/${m.id}`
    };

    res.json({
        success: true,
        data: certificado,
        message: 'Certificado de disposición final generado'
    });
});

// ===== FIRMA CON ALTERNATIVAS PARA PRUEBAS (CU-G07) =====
app.post('/api/manifiestos/:id/firmar-con-token', (req, res) => {
    const { metodoFirma, tokenPin, codigoSMS } = req.body;
    const m = manifiestos.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });

    // 🔐 REGLA: Verificar acceso
    if (!tieneAcceso(req.user, m)) {
        return res.status(403).json({ success: false, error: 'No tienes permiso para firmar este manifiesto' });
    }

    // Validar método de firma
    const metodosValidos = ['USUARIO_PASSWORD', 'TOKEN_PIN', 'CODIGO_SMS', 'CERTIFICADO_DIGITAL'];
    if (metodoFirma && !metodosValidos.includes(metodoFirma)) {
        return res.status(400).json({
            success: false,
            error: 'Método de firma inválido',
            metodosDisponibles: metodosValidos
        });
    }

    // Para pruebas: validar tokens/PIN simulados
    const tokensValidos = {
        'TOKEN_PIN': ['123456', '000000', 'DEMO123'],
        'CODIGO_SMS': ['999999', '123456', 'SMS2026']
    };

    if (metodoFirma === 'TOKEN_PIN' && !tokensValidos['TOKEN_PIN'].includes(tokenPin)) {
        return res.status(401).json({
            success: false,
            error: 'PIN inválido',
            hint: 'Para pruebas use: 123456, 000000, o DEMO123'
        });
    }

    if (metodoFirma === 'CODIGO_SMS' && !tokensValidos['CODIGO_SMS'].includes(codigoSMS)) {
        return res.status(401).json({
            success: false,
            error: 'Código SMS inválido',
            hint: 'Para pruebas use: 999999, 123456, o SMS2026'
        });
    }

    // Firma exitosa
    m.estado = 'PENDIENTE_APROBACION';
    m.updatedAt = new Date().toISOString();
    m.firmaDigital = {
        metodo: metodoFirma || 'USUARIO_PASSWORD',
        fecha: new Date().toISOString(),
        firmante: req.user?.nombre + ' ' + req.user?.apellido || 'Usuario Demo',
        hashFirma: 'SHA256:' + Buffer.from(m.numero + new Date().toISOString()).toString('base64').substring(0, 32)
    };

    actividades.unshift({
        id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'FIRMA_DIGITAL',
        descripcion: `Manifiesto ${m.numero} firmado digitalmente (${m.firmaDigital.metodo})`,
        fecha: new Date().toISOString(),
        usuario: { nombre: req.user?.nombre || 'Usuario', apellido: req.user?.apellido || 'Demo', rol: req.user?.rol || 'GENERADOR' },
        manifiesto: { numero: m.numero, estado: m.estado },
        metadata: { metodoFirma: m.firmaDigital.metodo }
    });

    res.json({
        success: true,
        data: {
            manifiesto: m,
            firma: m.firmaDigital
        },
        message: `Manifiesto firmado exitosamente con ${m.firmaDigital.metodo}`
    });
});

// ===== ENVIAR CÓDIGO SMS PARA FIRMA (Simulación) =====
app.post('/api/auth/enviar-codigo-sms', (req, res) => {
    const { telefono } = req.body;

    // Simulación: en producción real enviaría SMS
    console.log(`[SIMULACIÓN] Enviando código SMS a ${telefono || 'número no especificado'}`);

    res.json({
        success: true,
        message: 'Código SMS enviado (simulación)',
        hint: 'Para pruebas, use los códigos: 999999, 123456, o SMS2026',
        expiraEn: 300 // 5 minutos
    });
});

// ===== MÉTODOS DE FIRMA DISPONIBLES =====
app.get('/api/firma/metodos-disponibles', (req, res) => {
    res.json({
        success: true,
        data: {
            metodos: [
                {
                    id: 'USUARIO_PASSWORD',
                    nombre: 'Usuario y Contraseña',
                    descripcion: 'Firma con credenciales de acceso al sistema',
                    requiere2FA: false,
                    disponible: true
                },
                {
                    id: 'TOKEN_PIN',
                    nombre: 'Token + PIN',
                    descripcion: 'Ingrese el PIN de su token de firma',
                    requiere2FA: true,
                    disponible: true,
                    pinsDePrueba: ['123456', '000000', 'DEMO123']
                },
                {
                    id: 'CODIGO_SMS',
                    nombre: 'Código SMS',
                    descripcion: 'Se enviará un código a su teléfono registrado',
                    requiere2FA: true,
                    disponible: true,
                    codigosDePrueba: ['999999', '123456', 'SMS2026']
                },
                {
                    id: 'CERTIFICADO_DIGITAL',
                    nombre: 'Certificado Digital',
                    descripcion: 'Firma con certificado digital (p.ej. token USB)',
                    requiere2FA: true,
                    disponible: false,
                    nota: 'Requiere integración con proveedor de certificados'
                }
            ],
            _nota: 'Para pruebas de demo, use los PINs/códigos indicados en cada método'
        }
    });
});

// ===== VERIFICACIÓN PÚBLICA QR =====
app.get('/api/public/verify/:id', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id || x.numero === req.params.id);
    if (m) {
        // Solo datos públicos, no sensibles
        res.json({
            success: true,
            data: {
                numero: m.numero,
                estado: m.estado,
                tipoResiduo: m.tipoResiduo,
                origen: m.origen,
                destino: m.destino,
                fechaCreacion: m.createdAt
            }
        });
    } else {
        res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });
    }
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`\n🚀 SITREP Backend v3.0 - Business Rules Edition`);
    console.log(`   Running on port ${PORT}`);
    console.log(`\n   🔐 REGLAS DE NEGOCIO ACTIVAS:`);
    console.log(`      - ADMIN: ve todo, aprueba manifiestos`);
    console.log(`      - GENERADOR: solo sus manifiestos (generadorId)`);
    console.log(`      - TRANSPORTISTA: solo sus viajes (transportistaId)`);
    console.log(`      - OPERADOR: solo sus recepciones (operadorId)`);
    console.log(`      - Validación viaje único por transportista`);
    console.log(`      - Notificaciones filtradas por actor\n`);
});
