const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100mb' }));

// ===== DATOS DE DEMO =====
const usuarios = [
    { id: '1', nombre: 'Admin', apellido: 'DGFA', email: 'admin@dgfa.mendoza.gov.ar', rol: 'ADMIN', activo: true, createdAt: '2026-01-01T10:00:00Z' },
    { id: '2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@generador.com', rol: 'GENERADOR', activo: true, createdAt: '2026-01-02T11:00:00Z', generador: { id: 'g1', razonSocial: 'Industrias del Norte SA' } },
    { id: '3', nombre: 'María', apellido: 'González', email: 'maria@generador.com', rol: 'GENERADOR', activo: true, createdAt: '2026-01-03T09:00:00Z', generador: { id: 'g2', razonSocial: 'Química Cuyo SRL' } },
    { id: '4', nombre: 'Carlos', apellido: 'López', email: 'carlos@trans.com', rol: 'TRANSPORTISTA', activo: true, createdAt: '2026-01-04T14:00:00Z', transportista: { id: 't1', razonSocial: 'Transportes López' } },
    { id: '5', nombre: 'Pedro', apellido: 'Martínez', email: 'pedro@trans.com', rol: 'TRANSPORTISTA', activo: true, createdAt: '2026-01-05T08:00:00Z', transportista: { id: 't2', razonSocial: 'Logística Andina' } },
    { id: '6', nombre: 'Roberto', apellido: 'Silva', email: 'roberto@planta.com', rol: 'OPERADOR', activo: true, createdAt: '2026-01-06T10:00:00Z', operador: { id: 'o1', razonSocial: 'Planta Tratamiento Mendoza' } },
    { id: '7', nombre: 'Laura', apellido: 'Fernández', email: 'laura@planta.com', rol: 'OPERADOR', activo: true, createdAt: '2026-01-07T11:00:00Z', operador: { id: 'o2', razonSocial: 'EcoTrat SA' } }
];

let manifiestos = [
    { id: '1', numero: 'MAN-2026-0001', estado: 'EN_TRANSITO', generadorId: 'g1', generador: { razonSocial: 'Industrias del Norte SA' }, transportistaId: 't1', transportista: { razonSocial: 'Transportes López' }, operadorId: 'o1', operador: { razonSocial: 'Planta Tratamiento Mendoza' }, tipoResiduo: 'Solventes usados', pesoKg: 1500, origen: 'Buenos Aires', destino: 'Mendoza', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-11T14:30:00Z' },
    { id: '2', numero: 'MAN-2026-0002', estado: 'APROBADO', generadorId: 'g2', generador: { razonSocial: 'Química Cuyo SRL' }, transportistaId: 't2', transportista: { razonSocial: 'Logística Andina' }, operadorId: 'o2', operador: { razonSocial: 'EcoTrat SA' }, tipoResiduo: 'Aceites minerales', pesoKg: 2000, origen: 'San Juan', destino: 'Mendoza', createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T16:00:00Z' },
    { id: '3', numero: 'MAN-2026-0003', estado: 'RECIBIDO', generadorId: 'g1', generador: { razonSocial: 'Industrias del Norte SA' }, transportistaId: 't1', transportista: { razonSocial: 'Transportes López' }, operadorId: 'o1', operador: { razonSocial: 'Planta Tratamiento Mendoza' }, tipoResiduo: 'Baterías de plomo', pesoKg: 800, origen: 'Córdoba', destino: 'Mendoza', createdAt: '2026-01-09T09:00:00Z', updatedAt: '2026-01-11T11:00:00Z' },
    { id: '4', numero: 'MAN-2026-0004', estado: 'TRATADO', generadorId: 'g2', generador: { razonSocial: 'Química Cuyo SRL' }, transportistaId: 't2', transportista: { razonSocial: 'Logística Andina' }, operadorId: 'o2', operador: { razonSocial: 'EcoTrat SA' }, tipoResiduo: 'Residuos hospitalarios', pesoKg: 500, origen: 'Mendoza', destino: 'Luján', createdAt: '2026-01-08T07:00:00Z', updatedAt: '2026-01-10T18:00:00Z' },
    { id: '5', numero: 'MAN-2026-0005', estado: 'EN_TRANSITO', generadorId: 'g1', generador: { razonSocial: 'Industrias del Norte SA' }, transportistaId: 't1', transportista: { razonSocial: 'Transportes López' }, operadorId: 'o1', operador: { razonSocial: 'Planta Tratamiento Mendoza' }, tipoResiduo: 'Filtros de aceite', pesoKg: 300, origen: 'San Luis', destino: 'Mendoza', createdAt: '2026-01-11T06:00:00Z', updatedAt: '2026-01-12T08:00:00Z' },
    { id: '6', numero: 'MAN-2026-0006', estado: 'BORRADOR', generadorId: 'g2', generador: { razonSocial: 'Química Cuyo SRL' }, transportistaId: null, transportista: null, operadorId: null, operador: null, tipoResiduo: 'Envases contaminados', pesoKg: 1200, origen: 'La Plata', destino: 'Por definir', createdAt: '2026-01-12T09:00:00Z', updatedAt: '2026-01-12T09:00:00Z' },
    { id: '7', numero: 'MAN-2026-0007', estado: 'EN_TRANSITO', generadorId: 'g1', generador: { razonSocial: 'Industrias del Norte SA' }, transportistaId: 't2', transportista: { razonSocial: 'Logística Andina' }, operadorId: 'o2', operador: { razonSocial: 'EcoTrat SA' }, tipoResiduo: 'Lodos industriales', pesoKg: 3000, origen: 'Salta', destino: 'Mendoza Sur', createdAt: '2026-01-08T05:00:00Z', updatedAt: '2026-01-09T10:00:00Z' },
    { id: '8', numero: 'MAN-2026-0008', estado: 'BORRADOR', generadorId: 'g2', generador: { razonSocial: 'Química Cuyo SRL' }, transportistaId: null, transportista: null, operadorId: null, operador: null, tipoResiduo: 'Catalizadores agotados', pesoKg: 450, origen: 'Jujuy', destino: 'Por definir', createdAt: '2026-01-12T10:00:00Z', updatedAt: '2026-01-12T10:00:00Z' }
];

const actividades = [
    { id: 'a1', tipo: 'MANIFIESTO', accion: 'CREACION', descripcion: 'Nuevo manifiesto MAN-2026-0008 creado', fecha: '2026-01-12T10:00:00Z', usuario: { nombre: 'María', apellido: 'González', rol: 'GENERADOR' }, manifiesto: { numero: 'MAN-2026-0008', estado: 'BORRADOR' }, metadata: {} },
    { id: 'a2', tipo: 'MANIFIESTO', accion: 'TRANSITO', descripcion: 'Manifiesto MAN-2026-0005 iniciando transporte', fecha: '2026-01-12T08:00:00Z', usuario: { nombre: 'Carlos', apellido: 'López', rol: 'TRANSPORTISTA' }, manifiesto: { numero: 'MAN-2026-0005', estado: 'EN_TRANSITO' }, metadata: {} },
    { id: 'a3', tipo: 'MANIFIESTO', accion: 'RECEPCION', descripcion: 'Manifiesto MAN-2026-0003 recibido en planta', fecha: '2026-01-11T11:00:00Z', usuario: { nombre: 'Roberto', apellido: 'Silva', rol: 'OPERADOR' }, manifiesto: { numero: 'MAN-2026-0003', estado: 'RECIBIDO' }, metadata: {} },
    { id: 'a4', tipo: 'MANIFIESTO', accion: 'APROBACION', descripcion: 'Manifiesto MAN-2026-0002 aprobado por DGFA', fecha: '2026-01-10T16:00:00Z', usuario: { nombre: 'Admin', apellido: 'DGFA', rol: 'ADMIN' }, manifiesto: { numero: 'MAN-2026-0002', estado: 'APROBADO' }, metadata: {} },
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

// Reglas de alertas
const reglasAlerta = [
    { id: '1', nombre: 'Tiempo Excesivo en Tránsito', evento: 'TIEMPO_EXCESIVO', umbralHoras: 48, activa: true, severidad: 'CRITICAL' },
    { id: '2', nombre: 'Vencimiento de Habilitación', evento: 'VENCIMIENTO', diasAnticipacion: 30, activa: true, severidad: 'WARNING' },
    { id: '3', nombre: 'Desvío de Ruta', evento: 'DESVIO_RUTA', distanciaMaxKm: 50, activa: true, severidad: 'WARNING' },
    { id: '4', nombre: 'Parada Prolongada', evento: 'PARADA_PROLONGADA', minutosMaximo: 120, activa: true, severidad: 'INFO' }
];

// ===== HEALTH =====
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.1-fixed', service: 'SITREP', timestamp: new Date().toISOString() }));

// ===== AUTH =====
app.post('/api/auth/login', (req, res) => res.json({ success: true, data: { user: usuarios[0], tokens: { accessToken: 'demo-token', refreshToken: 'refresh' } } }));
app.get('/api/auth/me', (req, res) => res.json(usuarios[0]));
app.get('/api/auth/profile', (req, res) => res.json({ success: true, data: { user: usuarios[0] } }));
app.post('/api/auth/logout', (req, res) => res.json({ success: true }));

// ===== CATALOGOS (para formularios) =====
app.get('/api/catalogos/transportistas', (req, res) => res.json({ success: true, data: transportistas }));
app.get('/api/catalogos/operadores', (req, res) => res.json({ success: true, data: operadores }));
app.get('/api/catalogos/generadores', (req, res) => res.json({ success: true, data: generadores }));
app.get('/api/catalogos/tipos-residuos', (req, res) => res.json({ success: true, data: tiposResiduo }));
app.get('/api/tipos-residuo', (req, res) => res.json({ success: true, data: tiposResiduo }));

// ===== MANIFIESTOS =====
app.get('/api/manifiestos', (req, res) => {
    const { estado, page = 1, limit = 20 } = req.query;
    let filtered = [...manifiestos];
    if (estado) filtered = filtered.filter(m => m.estado === estado);
    res.json({ success: true, data: { manifiestos: filtered, pagination: { page: +page, limit: +limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) } } });
});

app.get('/api/manifiestos/dashboard', (req, res) => {
    res.json({ success: true, data: {
        total: manifiestos.length,
        porEstado: { BORRADOR: 2, APROBADO: 1, EN_TRANSITO: 3, RECIBIDO: 1, TRATADO: 1 },
        recientes: manifiestos.slice(0, 5)
    }});
});

app.get('/api/manifiestos/:id', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (m) res.json({ success: true, data: { manifiesto: m } });
    else res.status(404).json({ success: false, error: 'No encontrado' });
});

app.post('/api/manifiestos', (req, res) => {
    const { transportistaId, operadorId, residuos, observaciones } = req.body;
    const trans = transportistas.find(t => t.id === transportistaId);
    const oper = operadores.find(o => o.id === operadorId);
    const nuevoId = String(manifiestos.length + 1);
    const nuevoNumero = 'MAN-2026-' + String(manifiestos.length + 1).padStart(4, '0');
    const nuevo = {
        id: nuevoId, numero: nuevoNumero, estado: 'BORRADOR',
        generadorId: 'g1', generador: { razonSocial: 'Generador Demo' },
        transportistaId, transportista: trans ? { razonSocial: trans.razonSocial } : null,
        operadorId, operador: oper ? { razonSocial: oper.razonSocial } : null,
        residuos, observaciones,
        tipoResiduo: residuos?.[0]?.descripcion || 'Residuo',
        pesoKg: residuos?.reduce((sum, r) => sum + (r.cantidad || 0), 0) || 0,
        origen: 'Generador Demo', destino: oper?.razonSocial || 'Destino',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    manifiestos.push(nuevo);
    actividades.unshift({ id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'CREACION', descripcion: 'Nuevo manifiesto ' + nuevoNumero + ' creado', fecha: new Date().toISOString(), usuario: { nombre: 'Usuario', apellido: 'Demo', rol: 'GENERADOR' }, manifiesto: { numero: nuevoNumero, estado: 'BORRADOR' }, metadata: {} });
    res.json({ success: true, data: { manifiesto: nuevo }, message: 'Manifiesto creado exitosamente' });
});

app.post('/api/manifiestos/:id/firmar', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (m) {
        m.estado = 'PENDIENTE_APROBACION';
        m.updatedAt = new Date().toISOString();
        actividades.unshift({ id: 'a' + Date.now(), tipo: 'MANIFIESTO', accion: 'FIRMA', descripcion: `Manifiesto ${m.numero} firmado por generador`, fecha: new Date().toISOString(), usuario: { nombre: 'Generador', apellido: 'Demo', rol: 'GENERADOR' }, manifiesto: { numero: m.numero, estado: m.estado }, metadata: {} });
        res.json({ success: true, data: { manifiesto: m } });
    } else {
        res.status(404).json({ success: false, error: 'No encontrado' });
    }
});

// ===== WORKFLOW: CONFIRMAR RETIRO (Transportista inicia viaje) =====
app.post('/api/manifiestos/:id/confirmar-retiro', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (m) {
        m.estado = 'EN_TRANSITO';
        m.updatedAt = new Date().toISOString();
        m.inicioTransporte = new Date().toISOString();
        actividades.unshift({
            id: 'a' + Date.now(),
            tipo: 'MANIFIESTO',
            accion: 'TRANSITO',
            descripcion: `Manifiesto ${m.numero} - Retiro confirmado, inicio de transporte`,
            fecha: new Date().toISOString(),
            usuario: { nombre: 'Transportista', apellido: 'Demo', rol: 'TRANSPORTISTA' },
            manifiesto: { numero: m.numero, estado: m.estado },
            metadata: { ubicacion: req.body.ubicacion }
        });
        res.json({ success: true, data: { manifiesto: m }, message: 'Retiro confirmado, viaje iniciado' });
    } else {
        res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });
    }
});

// ===== WORKFLOW: ACTUALIZAR UBICACIÓN GPS =====
app.post('/api/manifiestos/:id/ubicacion', (req, res) => {
    const { lat, lng, timestamp } = req.body;
    const m = manifiestos.find(x => x.id === req.params.id);
    if (m) {
        m.ubicacionActual = { lat, lng, timestamp: timestamp || new Date().toISOString() };
        res.json({ success: true, message: 'Ubicación actualizada' });
    } else {
        res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });
    }
});

// ===== WORKFLOW: CONFIRMAR ENTREGA (Transportista finaliza viaje) =====
app.post('/api/manifiestos/:id/confirmar-entrega', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (m) {
        m.estado = 'ENTREGADO';
        m.updatedAt = new Date().toISOString();
        m.finTransporte = new Date().toISOString();
        actividades.unshift({
            id: 'a' + Date.now(),
            tipo: 'MANIFIESTO',
            accion: 'ENTREGA',
            descripcion: `Manifiesto ${m.numero} - Entrega confirmada en destino`,
            fecha: new Date().toISOString(),
            usuario: { nombre: 'Transportista', apellido: 'Demo', rol: 'TRANSPORTISTA' },
            manifiesto: { numero: m.numero, estado: m.estado },
            metadata: { ubicacion: req.body.ubicacion }
        });
        res.json({ success: true, data: { manifiesto: m }, message: 'Entrega confirmada' });
    } else {
        res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });
    }
});

// ===== WORKFLOW: CONFIRMAR RECEPCIÓN (Operador recibe) =====
app.post('/api/manifiestos/:id/confirmar-recepcion', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (m) {
        m.estado = 'RECIBIDO';
        m.updatedAt = new Date().toISOString();
        m.pesoRecibido = req.body.pesoRecibido || m.pesoKg;
        m.observacionesRecepcion = req.body.observaciones;
        actividades.unshift({
            id: 'a' + Date.now(),
            tipo: 'MANIFIESTO',
            accion: 'RECEPCION',
            descripcion: `Manifiesto ${m.numero} - Recepción confirmada en planta`,
            fecha: new Date().toISOString(),
            usuario: { nombre: 'Operador', apellido: 'Demo', rol: 'OPERADOR' },
            manifiesto: { numero: m.numero, estado: m.estado },
            metadata: { pesoRecibido: m.pesoRecibido }
        });
        res.json({ success: true, data: { manifiesto: m }, message: 'Recepción confirmada' });
    } else {
        res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });
    }
});

// ===== WORKFLOW: REGISTRAR TRATAMIENTO (Operador cierra) =====
app.post('/api/manifiestos/:id/tratamiento', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (m) {
        m.estado = 'TRATADO';
        m.updatedAt = new Date().toISOString();
        m.tipoTratamiento = req.body.tipoTratamiento || 'Tratamiento estándar';
        m.fechaTratamiento = new Date().toISOString();
        actividades.unshift({
            id: 'a' + Date.now(),
            tipo: 'MANIFIESTO',
            accion: 'TRATAMIENTO',
            descripcion: `Manifiesto ${m.numero} - Tratamiento completado`,
            fecha: new Date().toISOString(),
            usuario: { nombre: 'Operador', apellido: 'Demo', rol: 'OPERADOR' },
            manifiesto: { numero: m.numero, estado: m.estado },
            metadata: { tipoTratamiento: m.tipoTratamiento }
        });
        res.json({ success: true, data: { manifiesto: m }, message: 'Tratamiento registrado, manifiesto cerrado' });
    } else {
        res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });
    }
});

// ===== WORKFLOW: APROBAR MANIFIESTO (Admin) =====
app.post('/api/manifiestos/:id/aprobar', (req, res) => {
    const m = manifiestos.find(x => x.id === req.params.id);
    if (m) {
        m.estado = 'APROBADO';
        m.updatedAt = new Date().toISOString();
        actividades.unshift({
            id: 'a' + Date.now(),
            tipo: 'MANIFIESTO',
            accion: 'APROBACION',
            descripcion: `Manifiesto ${m.numero} aprobado por DGFA`,
            fecha: new Date().toISOString(),
            usuario: { nombre: 'Admin', apellido: 'DGFA', rol: 'ADMIN' },
            manifiesto: { numero: m.numero, estado: m.estado },
            metadata: {}
        });
        res.json({ success: true, data: { manifiesto: m }, message: 'Manifiesto aprobado' });
    } else {
        res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });
    }
});

// ===== WORKFLOW: SYNC VIAJES OFFLINE =====
app.post('/api/viajes/sync', (req, res) => {
    const { eventos } = req.body;
    // En demo solo confirmamos recepción
    console.log('Sync offline recibido:', eventos?.length || 0, 'eventos');
    res.json({ success: true, message: 'Viaje sincronizado correctamente', sincronizados: eventos?.length || 0 });
});

// ===== NOTIFICACIONES (CORREGIDO - estructura correcta) =====
app.get('/api/notificaciones', (req, res) => {
    // Frontend espera: { notificaciones: [...], noLeidas: N }
    res.json({
        notificaciones: [
            { id: '1', tipo: 'ALERTA', titulo: 'Tiempo excesivo en tránsito', mensaje: 'MAN-2026-0007 lleva 96h en tránsito', prioridad: 'URGENTE', leida: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
            { id: '2', tipo: 'ALERTA', titulo: 'Tiempo excesivo en tránsito', mensaje: 'MAN-2026-0001 lleva 52h en tránsito', prioridad: 'ALTA', leida: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
            { id: '3', tipo: 'INFO', titulo: 'Nuevo manifiesto creado', mensaje: 'Se ha creado el manifiesto MAN-2026-0008', prioridad: 'NORMAL', leida: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
            { id: '4', tipo: 'WARNING', titulo: 'Habilitación por vencer', mensaje: 'La habilitación de Transportes López vence en 5 días', prioridad: 'MEDIA', leida: false, createdAt: new Date(Date.now() - 172800000).toISOString() }
        ],
        noLeidas: 3
    });
});

app.post('/api/notificaciones/:id/leer', (req, res) => {
    res.json({ success: true, message: 'Notificación marcada como leída' });
});

// ===== USUARIOS =====
app.get('/api/usuarios', (req, res) => res.json({ success: true, data: usuarios, total: usuarios.length }));

// ===== KPIs =====
app.get('/api/kpis', (req, res) => res.json({ success: true, data: {
    manifiestos: { total: manifiestos.length, borrador: 2, aprobado: 1, enTransito: 3, recibido: 1, tratado: 1 },
    alertas: { criticas: 2, warnings: 1, info: 1 },
    usuarios: { total: usuarios.length, activos: usuarios.filter(u => u.activo).length }
}}));

// ===== ALERTAS (CORREGIDO - arrays directos) =====
// Frontend (alerta.service.ts) espera arrays directos, NO objetos wrapped

app.get('/api/alertas/advertencias', (req, res) => {
    // Retornar array directo de ResultadoEvaluacion[]
    res.json([
        { reglaId: '1', reglaNombre: 'Tiempo Excesivo en Tránsito', evento: 'TIEMPO_EXCESIVO', descripcion: 'MAN-2026-0007 lleva 96h en tránsito (máximo: 48h)', severidad: 'CRITICAL', detalles: { manifiestoId: '7', horasTranscurridas: 96 }, accionRequerida: 'URGENTE: Verificar estado del transporte' },
        { reglaId: '1', reglaNombre: 'Tiempo Excesivo en Tránsito', evento: 'TIEMPO_EXCESIVO', descripcion: 'MAN-2026-0001 lleva 52h en tránsito (máximo: 48h)', severidad: 'CRITICAL', detalles: { manifiestoId: '1', horasTranscurridas: 52 }, accionRequerida: 'Verificar ubicación y estado' },
        { reglaId: '2', reglaNombre: 'Vencimiento de Habilitación', evento: 'VENCIMIENTO', descripcion: 'Habilitación de Transportes López vence en 5 días', severidad: 'WARNING', detalles: { transportistaId: 't1', diasRestantes: 5 }, accionRequerida: 'Renovar habilitación' }
    ]);
});

app.get('/api/alertas/evaluar-tiempos', (req, res) => {
    // Retornar array directo
    res.json([
        { reglaId: '1', reglaNombre: 'Tiempo Excesivo', evento: 'TIEMPO_EXCESIVO', descripcion: 'MAN-2026-0007 excede tiempo máximo', severidad: 'CRITICAL', detalles: { manifiestoId: '7', horasTranscurridas: 96, umbralHoras: 48 }, accionRequerida: 'Contactar transportista' },
        { reglaId: '1', reglaNombre: 'Tiempo Excesivo', evento: 'TIEMPO_EXCESIVO', descripcion: 'MAN-2026-0001 excede tiempo máximo', severidad: 'CRITICAL', detalles: { manifiestoId: '1', horasTranscurridas: 52, umbralHoras: 48 }, accionRequerida: 'Verificar estado' }
    ]);
});

app.get('/api/alertas/evaluar-vencimientos', (req, res) => {
    // Retornar array directo
    res.json([
        { reglaId: '2', reglaNombre: 'Vencimiento Próximo', evento: 'VENCIMIENTO', descripcion: 'Habilitación TRP-2024-001 vence pronto', severidad: 'WARNING', detalles: { transportistaId: 't1', diasRestantes: 5, tipo: 'habilitacion' }, accionRequerida: 'Iniciar trámite de renovación' }
    ]);
});

app.get('/api/alertas/evaluar/:id', (req, res) => {
    // Evaluar alertas para un manifiesto específico - retornar array
    const m = manifiestos.find(x => x.id === req.params.id);
    if (m && m.estado === 'EN_TRANSITO') {
        res.json([
            { reglaId: '1', reglaNombre: 'Evaluación Individual', evento: 'TIEMPO_EXCESIVO', descripcion: `Evaluando ${m.numero}`, severidad: 'INFO', detalles: { manifiestoId: m.id }, accionRequerida: 'Ninguna' }
        ]);
    } else {
        res.json([]);
    }
});

// REGLAS DE ALERTAS (array directo)
app.get('/api/alertas/reglas', (req, res) => {
    // Retornar array directo de reglas
    res.json(reglasAlerta);
});

app.post('/api/alertas/reglas', (req, res) => {
    const nuevaRegla = { id: String(reglasAlerta.length + 1), ...req.body, activa: true };
    reglasAlerta.push(nuevaRegla);
    res.json({ success: true, data: nuevaRegla });
});

app.put('/api/alertas/reglas/:id', (req, res) => {
    const regla = reglasAlerta.find(r => r.id === req.params.id);
    if (regla) {
        Object.assign(regla, req.body);
        res.json({ success: true, data: regla });
    } else {
        res.status(404).json({ success: false, error: 'Regla no encontrada' });
    }
});

// ===== ADMIN =====
app.get('/api/admin/actividad', (req, res) => {
    const { tipo, limit = 100 } = req.query;
    let filtered = [...actividades];
    if (tipo && tipo !== 'TODOS') filtered = filtered.filter(a => a.tipo === tipo);
    res.json({ success: true, data: {
        actividades: filtered.slice(0, +limit),
        stats: { eventosHoy: 5, manifestosActivos: 4, usuariosActivos: 7 },
        pagination: { page: 1, limit: +limit }
    }});
});

app.get('/api/admin/usuarios', (req, res) => {
    const { rol, activo, busqueda } = req.query;
    let filtered = [...usuarios];
    if (rol && rol !== 'TODOS') filtered = filtered.filter(u => u.rol === rol);
    if (busqueda) filtered = filtered.filter(u => u.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    res.json({ success: true, data: {
        usuarios: filtered,
        stats: { total: usuarios.length, activos: usuarios.filter(u => u.activo).length, inactivos: 0, porRol: { ADMIN: 1, GENERADOR: 2, TRANSPORTISTA: 2, OPERADOR: 2 } },
        pagination: { page: 1, limit: 20, total: filtered.length, pages: 1 }
    }});
});

app.get('/api/admin/usuarios/pendientes', (req, res) => res.json({ success: true, data: { usuarios: [], total: 0 } }));

app.get('/api/admin/usuarios/:id', (req, res) => {
    const u = usuarios.find(x => x.id === req.params.id);
    if (u) res.json({ success: true, data: { usuario: u, actividadReciente: actividades.filter(a => a.usuario?.nombre === u.nombre).slice(0, 5) } });
    else res.status(404).json({ success: false, error: 'No encontrado' });
});

app.put('/api/admin/usuarios/:id', (req, res) => {
    const u = usuarios.find(x => x.id === req.params.id);
    if (u) {
        Object.assign(u, req.body);
        res.json({ success: true, data: { usuario: u } });
    } else {
        res.status(404).json({ success: false, error: 'No encontrado' });
    }
});

app.post('/api/admin/usuarios/:id/aprobar', (req, res) => {
    const u = usuarios.find(x => x.id === req.params.id);
    if (u) {
        u.activo = true;
        res.json({ success: true, data: { usuario: u } });
    } else {
        res.status(404).json({ success: false, error: 'No encontrado' });
    }
});

app.post('/api/admin/usuarios/:id/rechazar', (req, res) => res.json({ success: true }));

// ESTADÍSTICAS ADMIN (CORREGIDO - con porRol y porEstado completos)
app.get('/api/admin/estadisticas', (req, res) => {
    const porEstado = manifiestos.reduce((acc, m) => {
        acc[m.estado] = (acc[m.estado] || 0) + 1;
        return acc;
    }, {});

    const porRol = usuarios.reduce((acc, u) => {
        acc[u.rol] = (acc[u.rol] || 0) + 1;
        return acc;
    }, {});

    res.json({ success: true, data: {
        usuarios: {
            total: usuarios.length,
            activos: usuarios.filter(u => u.activo).length,
            pendientes: 0,
            porRol
        },
        manifiestos: {
            total: manifiestos.length,
            porEstado
        }
    }});
});

app.get('/api/admin/stats', (req, res) => res.json({ success: true, data: {
    usuarios: { total: 7, activos: 7, pendientes: 0 },
    manifiestos: { total: 8, hoy: 2, semana: 5 },
    alertas: { activas: 3, resueltas: 10 }
}}));

// ===== ACTORES =====
app.get('/api/actores/generadores', (req, res) => res.json({ success: true, data: { generadores, pagination: { page: 1, limit: 20, total: generadores.length, pages: 1 } } }));
app.post('/api/actores/generadores', (req, res) => {
    const nuevo = { id: 'g' + (generadores.length + 1), ...req.body, activo: true };
    generadores.push(nuevo);
    res.json({ success: true, data: { generador: nuevo } });
});

app.get('/api/actores/transportistas', (req, res) => res.json({ success: true, data: { transportistas, pagination: { page: 1, limit: 20, total: transportistas.length, pages: 1 } } }));
app.post('/api/actores/transportistas', (req, res) => {
    const nuevo = { id: 't' + (transportistas.length + 1), ...req.body, activo: true };
    transportistas.push(nuevo);
    res.json({ success: true, data: { transportista: nuevo } });
});

app.get('/api/actores/operadores', (req, res) => res.json({ success: true, data: { operadores, pagination: { page: 1, limit: 20, total: operadores.length, pages: 1 } } }));
app.post('/api/actores/operadores', (req, res) => {
    const nuevo = { id: 'o' + (operadores.length + 1), ...req.body, activo: true };
    operadores.push(nuevo);
    res.json({ success: true, data: { operador: nuevo } });
});

// ===== REPORTES =====
app.get('/api/reportes/manifiestos', (req, res) => {
    const porEstado = manifiestos.reduce((acc, m) => { acc[m.estado] = (acc[m.estado] || 0) + 1; return acc; }, {});
    res.json({ success: true, data: { total: manifiestos.length, porEstado, porMes: [], pesoTotal: manifiestos.reduce((s, m) => s + m.pesoKg, 0) } });
});
app.get('/api/reportes/tratados', (req, res) => {
    const tratados = manifiestos.filter(m => m.estado === 'TRATADO');
    res.json({ success: true, data: { total: tratados.length, porTipoResiduo: {}, pesoTratado: tratados.reduce((s, m) => s + m.pesoKg, 0) } });
});
app.get('/api/reportes/transporte', (req, res) => {
    const enTransito = manifiestos.filter(m => m.estado === 'EN_TRANSITO');
    const completados = manifiestos.filter(m => ['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(m.estado));
    res.json({ success: true, data: { viajesCompletados: completados.length, viajesEnCurso: enTransito.length, promedioHorasTransito: 36 } });
});
app.get('/api/reportes/auditoria', (req, res) => res.json({ success: true, data: { eventos: actividades, pagination: { page: 1, limit: 50, total: actividades.length } } }));

// ===== TRACKING =====
app.get('/api/tracking/manifiestos', (req, res) => {
    const enTransito = manifiestos.filter(m => m.estado === 'EN_TRANSITO');
    res.json({ success: true, data: enTransito.map(m => ({
        ...m,
        ubicacionActual: m.ubicacionActual || { lat: -32.889 + Math.random() * 0.1, lng: -68.844 + Math.random() * 0.1 }
    })) });
});

// ===== PDF (endpoints de demo) =====
app.get('/api/pdf/manifiesto/:id', (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=manifiesto_${req.params.id}.pdf`);
    res.send(Buffer.from('%PDF-1.4 Demo PDF for SITREP'));
});

app.get('/api/pdf/certificado/:id', (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=certificado_${req.params.id}.pdf`);
    res.send(Buffer.from('%PDF-1.4 Demo Certificado for SITREP'));
});

// 404 handler
app.use((req, res) => {
    console.log('404:', req.method, req.path);
    res.status(404).json({ success: false, error: 'Not found', path: req.path });
});

app.listen(PORT, () => console.log('✅ SITREP Backend v1.1-fixed on port ' + PORT));
