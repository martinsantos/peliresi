"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcryptjs_1 = __importDefault(require("bcryptjs"));
var qrcode_1 = __importDefault(require("qrcode"));
var prisma = new client_1.PrismaClient();
// Contraseña unificada para todos los usuarios demo
var DEMO_PASSWORD = 'password';
var BASE_URL = 'https://sitrep.ultimamilla.com.ar';
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var hashedPassword, admin, tiposResiduos, _i, tiposResiduos_1, tipo, generadoresData, generadores, _a, generadoresData_1, gen, usuario, generador, transportistasData, transportistas, _b, transportistasData_1, trans, usuario, transportista, vehiculosExistentes, choferesExistentes, operadoresData, operadores, residuos, residuosMap, _c, operadoresData_1, op, usuario, operador, tratamientos, _d, tratamientos_1, trat, manifiestoConfigs, _e, manifiestoConfigs_1, config, gen, trans, op, tipoResiduoId, fechaCreacion, fechaFirma, fechaRetiro, fechaEntrega, fechaRecepcion, fechaCierre, qrCode, firmaDigital, manifiesto, verificationUrl, err_1, eventos, _f, eventos_1, evento, puntos, trackingTime, _g, puntos_1, punto;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    console.log('Iniciando seed de datos...');
                    return [4 /*yield*/, bcryptjs_1.default.hash(DEMO_PASSWORD, 10)];
                case 1:
                    hashedPassword = _h.sent();
                    return [4 /*yield*/, prisma.usuario.upsert({
                            where: { email: 'admin@dgfa.mendoza.gov.ar' },
                            update: { password: hashedPassword },
                            create: {
                                email: 'admin@dgfa.mendoza.gov.ar',
                                password: hashedPassword,
                                rol: 'ADMIN',
                                nombre: 'Administrador',
                                apellido: 'DGFA',
                                activo: true,
                            },
                        })];
                case 2:
                    admin = _h.sent();
                    console.log('✅ Admin creado:', admin.email);
                    tiposResiduos = [
                        { codigo: 'Y1', nombre: 'Ácido Clorhídrico (HCl)', categoria: 'Ácidos', peligrosidad: 'Corrosivo' },
                        { codigo: 'Y2', nombre: 'Ácido Sulfúrico (H2SO4)', categoria: 'Ácidos', peligrosidad: 'Corrosivo' },
                        { codigo: 'Y3', nombre: 'Ácido Nítrico (HNO3)', categoria: 'Ácidos', peligrosidad: 'Corrosivo, Oxidante' },
                        { codigo: 'Y4', nombre: 'Hidróxido de Sodio (NaOH)', categoria: 'Bases', peligrosidad: 'Corrosivo' },
                        { codigo: 'Y5', nombre: 'Hidróxido de Potasio (KOH)', categoria: 'Bases', peligrosidad: 'Corrosivo' },
                        { codigo: 'Y6', nombre: 'Disolventes Halogenados', categoria: 'Disolventes', peligrosidad: 'Tóxico, Cancerígeno' },
                        { codigo: 'Y7', nombre: 'Disolventes Orgánicos', categoria: 'Disolventes', peligrosidad: 'Tóxico, Inflamable' },
                        { codigo: 'Y8', nombre: 'Aceites Minerales Usados', categoria: 'Aceites', peligrosidad: 'Tóxico' },
                        { codigo: 'Y9', nombre: 'Lodos Galvánicos', categoria: 'Lodos', peligrosidad: 'Tóxico, Corrosivo' },
                        { codigo: 'Y10', nombre: 'Baterías de Plomo-Ácido', categoria: 'Baterías', peligrosidad: 'Tóxico' },
                        { codigo: 'Y11', nombre: 'Residuos de Laboratorio', categoria: 'Químicos', peligrosidad: 'Tóxico, Reactivo' },
                        { codigo: 'Y12', nombre: 'Pinturas y Barnices', categoria: 'Pinturas', peligrosidad: 'Tóxico, Inflamable' },
                        { codigo: 'Y13', nombre: 'Residuos Fotográficos', categoria: 'Químicos', peligrosidad: 'Tóxico' },
                        { codigo: 'Y14', nombre: 'Plásticos Contaminados', categoria: 'Plásticos', peligrosidad: 'Tóxico' },
                        { codigo: 'Y15', nombre: 'Residuos Hospitalarios', categoria: 'Biológicos', peligrosidad: 'Infeccioso, Tóxico' },
                    ];
                    _i = 0, tiposResiduos_1 = tiposResiduos;
                    _h.label = 3;
                case 3:
                    if (!(_i < tiposResiduos_1.length)) return [3 /*break*/, 6];
                    tipo = tiposResiduos_1[_i];
                    return [4 /*yield*/, prisma.tipoResiduo.upsert({
                            where: { codigo: tipo.codigo },
                            update: {},
                            create: tipo,
                        })];
                case 4:
                    _h.sent();
                    _h.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    console.log('✅ Tipos de residuos creados:', tiposResiduos.length);
                    generadoresData = [
                        {
                            usuario: {
                                email: 'quimica.mendoza@industria.com',
                                password: hashedPassword,
                                rol: 'GENERADOR',
                                nombre: 'Roberto',
                                apellido: 'Gómez',
                                empresa: 'Química Mendoza S.A.',
                            },
                            generador: {
                                razonSocial: 'Química Mendoza S.A.',
                                cuit: '30-12345678-9',
                                domicilio: 'Av. San Martín 1200, Mendoza',
                                telefono: '2614251234',
                                email: 'quimica.mendoza@industria.com',
                                numeroInscripcion: 'RG-001-2023',
                                categoria: 'Categoría III',
                            },
                        },
                        {
                            usuario: {
                                email: 'petroquimica.andes@industria.com',
                                password: hashedPassword,
                                rol: 'GENERADOR',
                                nombre: 'María',
                                apellido: 'López',
                                empresa: 'Petroquímica Andes',
                            },
                            generador: {
                                razonSocial: 'Petroquímica Andes S.A.',
                                cuit: '30-87654321-0',
                                domicilio: 'Ruta Nacional 7 km 1050, Guaymallén',
                                telefono: '2614859876',
                                email: 'petroquimica.andes@industria.com',
                                numeroInscripcion: 'RG-002-2023',
                                categoria: 'Categoría II',
                            },
                        },
                        {
                            usuario: {
                                email: 'laboratorio.central@medicina.com',
                                password: hashedPassword,
                                rol: 'GENERADOR',
                                nombre: 'Carlos',
                                apellido: 'Rodríguez',
                                empresa: 'Laboratorio Central',
                            },
                            generador: {
                                razonSocial: 'Laboratorio Central de Análisis',
                                cuit: '30-56789012-3',
                                domicilio: 'Calle España 450, Ciudad',
                                telefono: '2614567890',
                                email: 'laboratorio.central@medicina.com',
                                numeroInscripcion: 'RG-003-2023',
                                categoria: 'Categoría I',
                            },
                        },
                    ];
                    generadores = [];
                    _a = 0, generadoresData_1 = generadoresData;
                    _h.label = 7;
                case 7:
                    if (!(_a < generadoresData_1.length)) return [3 /*break*/, 11];
                    gen = generadoresData_1[_a];
                    return [4 /*yield*/, prisma.usuario.upsert({
                            where: { email: gen.usuario.email },
                            update: { password: hashedPassword },
                            create: gen.usuario,
                        })];
                case 8:
                    usuario = _h.sent();
                    return [4 /*yield*/, prisma.generador.upsert({
                            where: { usuarioId: usuario.id },
                            update: {},
                            create: __assign(__assign({}, gen.generador), { usuarioId: usuario.id }),
                        })];
                case 9:
                    generador = _h.sent();
                    generadores.push({ usuario: usuario, generador: generador });
                    _h.label = 10;
                case 10:
                    _a++;
                    return [3 /*break*/, 7];
                case 11:
                    console.log('✅ Generadores creados:', generadores.length);
                    transportistasData = [
                        {
                            usuario: {
                                email: 'transportes.andes@logistica.com',
                                password: hashedPassword,
                                rol: 'TRANSPORTISTA',
                                nombre: 'Pedro',
                                apellido: 'Martínez',
                                empresa: 'Transportes Andes',
                            },
                            transportista: {
                                razonSocial: 'Transportes Andes S.R.L.',
                                cuit: '30-34567890-1',
                                domicilio: 'Acceso Este 1500, Mendoza',
                                telefono: '2614123456',
                                email: 'transportes.andes@logistica.com',
                                numeroHabilitacion: 'HT-001-2023',
                            },
                        },
                        {
                            usuario: {
                                email: 'logistica.cuyo@transporte.com',
                                password: hashedPassword,
                                rol: 'TRANSPORTISTA',
                                nombre: 'Ana',
                                apellido: 'González',
                                empresa: 'Logística Cuyo',
                            },
                            transportista: {
                                razonSocial: 'Logística Cuyo S.A.',
                                cuit: '30-09876543-2',
                                domicilio: 'Ruta Provincial 60 km 25, Maipú',
                                telefono: '2614789123',
                                email: 'logistica.cuyo@transporte.com',
                                numeroHabilitacion: 'HT-002-2023',
                            },
                        },
                    ];
                    transportistas = [];
                    _b = 0, transportistasData_1 = transportistasData;
                    _h.label = 12;
                case 12:
                    if (!(_b < transportistasData_1.length)) return [3 /*break*/, 21];
                    trans = transportistasData_1[_b];
                    return [4 /*yield*/, prisma.usuario.upsert({
                            where: { email: trans.usuario.email },
                            update: { password: hashedPassword },
                            create: trans.usuario,
                        })];
                case 13:
                    usuario = _h.sent();
                    return [4 /*yield*/, prisma.transportista.upsert({
                            where: { usuarioId: usuario.id },
                            update: {},
                            create: __assign(__assign({}, trans.transportista), { usuarioId: usuario.id }),
                        })];
                case 14:
                    transportista = _h.sent();
                    transportistas.push({ usuario: usuario, transportista: transportista });
                    return [4 /*yield*/, prisma.vehiculo.count({
                            where: { transportistaId: transportista.id }
                        })];
                case 15:
                    vehiculosExistentes = _h.sent();
                    if (!(vehiculosExistentes === 0)) return [3 /*break*/, 17];
                    return [4 /*yield*/, prisma.vehiculo.createMany({
                            data: [
                                {
                                    transportistaId: transportista.id,
                                    patente: "".concat(trans.usuario.nombre.substring(0, 2).toUpperCase(), "123CD"),
                                    marca: 'Mercedes-Benz',
                                    modelo: 'Axor 2036',
                                    anio: 2022,
                                    capacidad: 15000,
                                    numeroHabilitacion: "HV-".concat(transportista.id.substring(0, 4), "-2023"),
                                    vencimiento: new Date('2025-12-31'),
                                },
                                {
                                    transportistaId: transportista.id,
                                    patente: "".concat(trans.usuario.nombre.substring(0, 2).toUpperCase(), "456GH"),
                                    marca: 'Scania',
                                    modelo: 'R450',
                                    anio: 2021,
                                    capacidad: 18000,
                                    numeroHabilitacion: "HV-".concat(transportista.id.substring(0, 4), "-2024"),
                                    vencimiento: new Date('2025-12-31'),
                                },
                            ],
                        })];
                case 16:
                    _h.sent();
                    _h.label = 17;
                case 17: return [4 /*yield*/, prisma.chofer.count({
                        where: { transportistaId: transportista.id }
                    })];
                case 18:
                    choferesExistentes = _h.sent();
                    if (!(choferesExistentes === 0)) return [3 /*break*/, 20];
                    return [4 /*yield*/, prisma.chofer.createMany({
                            data: [
                                {
                                    transportistaId: transportista.id,
                                    nombre: 'Juan',
                                    apellido: 'Pérez',
                                    dni: "".concat(Math.floor(10000000 + Math.random() * 90000000)),
                                    licencia: "A".concat(Math.floor(100000 + Math.random() * 900000)),
                                    vencimiento: new Date('2025-06-30'),
                                    telefono: '2615551234',
                                },
                                {
                                    transportistaId: transportista.id,
                                    nombre: 'Luis',
                                    apellido: 'Sánchez',
                                    dni: "".concat(Math.floor(10000000 + Math.random() * 90000000)),
                                    licencia: "B".concat(Math.floor(100000 + Math.random() * 900000)),
                                    vencimiento: new Date('2025-09-30'),
                                    telefono: '2615559876',
                                },
                            ],
                        })];
                case 19:
                    _h.sent();
                    _h.label = 20;
                case 20:
                    _b++;
                    return [3 /*break*/, 12];
                case 21:
                    console.log('✅ Transportistas creados:', transportistas.length);
                    operadoresData = [
                        {
                            usuario: {
                                email: 'tratamiento.residuos@planta.com',
                                password: hashedPassword,
                                rol: 'OPERADOR',
                                nombre: 'Miguel',
                                apellido: 'Fernández',
                                empresa: 'Tratamiento de Residuos',
                            },
                            operador: {
                                razonSocial: 'Tratamiento de Residuos Mendoza S.A.',
                                cuit: '30-13579246-8',
                                domicilio: 'Parque Industrial Mendoza, Lote 15',
                                telefono: '2614321987',
                                email: 'tratamiento.residuos@planta.com',
                                numeroHabilitacion: 'HO-001-2023',
                                categoria: 'Categoría III',
                            },
                        },
                        {
                            usuario: {
                                email: 'eco.ambiental@reciclado.com',
                                password: hashedPassword,
                                rol: 'OPERADOR',
                                nombre: 'Laura',
                                apellido: 'Díaz',
                                empresa: 'Eco Ambiental',
                            },
                            operador: {
                                razonSocial: 'Eco Ambiental S.R.L.',
                                cuit: '30-24681357-9',
                                domicilio: 'Ruta Nacional 40 km 120, Luján de Cuyo',
                                telefono: '2614765432',
                                email: 'eco.ambiental@reciclado.com',
                                numeroHabilitacion: 'HO-002-2023',
                                categoria: 'Categoría II',
                            },
                        },
                    ];
                    operadores = [];
                    return [4 /*yield*/, prisma.tipoResiduo.findMany()];
                case 22:
                    residuos = _h.sent();
                    residuosMap = new Map(residuos.map(function (r) { return [r.codigo, r.id]; }));
                    _c = 0, operadoresData_1 = operadoresData;
                    _h.label = 23;
                case 23:
                    if (!(_c < operadoresData_1.length)) return [3 /*break*/, 30];
                    op = operadoresData_1[_c];
                    return [4 /*yield*/, prisma.usuario.upsert({
                            where: { email: op.usuario.email },
                            update: { password: hashedPassword },
                            create: op.usuario,
                        })];
                case 24:
                    usuario = _h.sent();
                    return [4 /*yield*/, prisma.operador.upsert({
                            where: { usuarioId: usuario.id },
                            update: {},
                            create: __assign(__assign({}, op.operador), { usuarioId: usuario.id }),
                        })];
                case 25:
                    operador = _h.sent();
                    operadores.push({ usuario: usuario, operador: operador });
                    tratamientos = [
                        { tipoResiduoId: residuosMap.get('Y1'), metodo: 'Neutralización química', descripcion: 'Proceso de neutralización con bases', capacidad: 5000 },
                        { tipoResiduoId: residuosMap.get('Y6'), metodo: 'Incineración', descripcion: 'Incineración a alta temperatura', capacidad: 3000 },
                        { tipoResiduoId: residuosMap.get('Y9'), metodo: 'Estabilización', descripcion: 'Estabilización química de lodos', capacidad: 10000 },
                    ];
                    _d = 0, tratamientos_1 = tratamientos;
                    _h.label = 26;
                case 26:
                    if (!(_d < tratamientos_1.length)) return [3 /*break*/, 29];
                    trat = tratamientos_1[_d];
                    return [4 /*yield*/, prisma.tratamientoAutorizado.upsert({
                            where: {
                                operadorId_tipoResiduoId_metodo: {
                                    operadorId: operador.id,
                                    tipoResiduoId: trat.tipoResiduoId,
                                    metodo: trat.metodo,
                                },
                            },
                            update: {},
                            create: __assign({ operadorId: operador.id }, trat),
                        })];
                case 27:
                    _h.sent();
                    _h.label = 28;
                case 28:
                    _d++;
                    return [3 /*break*/, 26];
                case 29:
                    _c++;
                    return [3 /*break*/, 23];
                case 30:
                    console.log('✅ Operadores creados:', operadores.length);
                    // ========== CREAR MANIFIESTOS ==========
                    console.log('📦 Creando manifiestos de demo...');
                    // Limpiar manifiestos existentes para recrear con datos frescos
                    return [4 /*yield*/, prisma.manifiestoResiduo.deleteMany({})];
                case 31:
                    // Limpiar manifiestos existentes para recrear con datos frescos
                    _h.sent();
                    return [4 /*yield*/, prisma.eventoManifiesto.deleteMany({})];
                case 32:
                    _h.sent();
                    return [4 /*yield*/, prisma.trackingGPS.deleteMany({})];
                case 33:
                    _h.sent();
                    return [4 /*yield*/, prisma.manifiesto.deleteMany({})];
                case 34:
                    _h.sent();
                    manifiestoConfigs = [
                        // Manifiestos en BORRADOR (2)
                        { numero: 'MAN-2025-0001', estado: 'BORRADOR', genIdx: 0, transIdx: 0, opIdx: 0, residuoCodigo: 'Y1' },
                        { numero: 'MAN-2025-0002', estado: 'BORRADOR', genIdx: 1, transIdx: 1, opIdx: 1, residuoCodigo: 'Y6' },
                        // Manifiesto APROBADO (firmado con QR) (1)
                        { numero: 'MAN-2025-0003', estado: 'APROBADO', genIdx: 0, transIdx: 0, opIdx: 0, residuoCodigo: 'Y9', firmado: true },
                        // Manifiestos EN_TRANSITO (2)
                        { numero: 'MAN-2025-0004', estado: 'EN_TRANSITO', genIdx: 1, transIdx: 0, opIdx: 0, residuoCodigo: 'Y8', firmado: true, conTracking: true },
                        { numero: 'MAN-2025-0005', estado: 'EN_TRANSITO', genIdx: 2, transIdx: 1, opIdx: 1, residuoCodigo: 'Y11', firmado: true, conTracking: true },
                        // Manifiesto ENTREGADO (1)
                        { numero: 'MAN-2025-0006', estado: 'ENTREGADO', genIdx: 0, transIdx: 1, opIdx: 0, residuoCodigo: 'Y12', firmado: true },
                        // Manifiesto RECIBIDO (1)
                        { numero: 'MAN-2025-0007', estado: 'RECIBIDO', genIdx: 1, transIdx: 0, opIdx: 1, residuoCodigo: 'Y7', firmado: true },
                        // Manifiesto TRATADO (completado) (1)
                        { numero: 'MAN-2025-0008', estado: 'TRATADO', genIdx: 2, transIdx: 1, opIdx: 0, residuoCodigo: 'Y15', firmado: true },
                    ];
                    _e = 0, manifiestoConfigs_1 = manifiestoConfigs;
                    _h.label = 35;
                case 35:
                    if (!(_e < manifiestoConfigs_1.length)) return [3 /*break*/, 52];
                    config = manifiestoConfigs_1[_e];
                    gen = generadores[config.genIdx];
                    trans = transportistas[config.transIdx];
                    op = operadores[config.opIdx];
                    tipoResiduoId = residuosMap.get(config.residuoCodigo);
                    fechaCreacion = new Date();
                    fechaCreacion.setDate(fechaCreacion.getDate() - Math.floor(Math.random() * 30));
                    fechaFirma = null;
                    fechaRetiro = null;
                    fechaEntrega = null;
                    fechaRecepcion = null;
                    fechaCierre = null;
                    qrCode = null;
                    firmaDigital = null;
                    if (config.firmado) {
                        fechaFirma = new Date(fechaCreacion);
                        fechaFirma.setHours(fechaFirma.getHours() + 2);
                        // Generar firma digital simulada
                        firmaDigital = {
                            algoritmo: 'SHA-256 + RSA',
                            firmante: gen.usuario.email,
                            fechaFirma: fechaFirma.toISOString(),
                            hash: "".concat(Buffer.from(config.numero + fechaFirma.toISOString()).toString('base64').substring(0, 44)),
                            certificado: {
                                emisor: 'DGFA Mendoza CA',
                                validoDesde: '2024-01-01',
                                validoHasta: '2026-01-01',
                            },
                        };
                    }
                    if (['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(config.estado)) {
                        fechaRetiro = new Date(fechaFirma || fechaCreacion);
                        fechaRetiro.setHours(fechaRetiro.getHours() + 4);
                    }
                    if (['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(config.estado)) {
                        fechaEntrega = new Date(fechaRetiro);
                        fechaEntrega.setHours(fechaEntrega.getHours() + 3);
                    }
                    if (['RECIBIDO', 'TRATADO'].includes(config.estado)) {
                        fechaRecepcion = new Date(fechaEntrega);
                        fechaRecepcion.setMinutes(fechaRecepcion.getMinutes() + 30);
                    }
                    if (config.estado === 'TRATADO') {
                        fechaCierre = new Date(fechaRecepcion);
                        fechaCierre.setDate(fechaCierre.getDate() + 1);
                    }
                    return [4 /*yield*/, prisma.manifiesto.create({
                            data: {
                                numero: config.numero,
                                generadorId: gen.generador.id,
                                transportistaId: trans.transportista.id,
                                operadorId: op.operador.id,
                                creadoPorId: gen.usuario.id,
                                estado: config.estado,
                                observaciones: "Manifiesto de demo - Estado: ".concat(config.estado),
                                fechaCreacion: fechaCreacion,
                                fechaFirma: fechaFirma,
                                fechaRetiro: fechaRetiro,
                                fechaEntrega: fechaEntrega,
                                fechaRecepcion: fechaRecepcion,
                                fechaCierre: fechaCierre,
                                firmaDigital: firmaDigital,
                            },
                        })];
                case 36:
                    manifiesto = _h.sent();
                    if (!config.firmado) return [3 /*break*/, 41];
                    verificationUrl = "".concat(BASE_URL, "/verify/").concat(manifiesto.id);
                    _h.label = 37;
                case 37:
                    _h.trys.push([37, 40, , 41]);
                    return [4 /*yield*/, qrcode_1.default.toDataURL(verificationUrl)];
                case 38:
                    qrCode = _h.sent();
                    return [4 /*yield*/, prisma.manifiesto.update({
                            where: { id: manifiesto.id },
                            data: { qrCode: qrCode },
                        })];
                case 39:
                    _h.sent();
                    return [3 /*break*/, 41];
                case 40:
                    err_1 = _h.sent();
                    console.warn("\u26A0\uFE0F No se pudo generar QR para ".concat(config.numero));
                    return [3 /*break*/, 41];
                case 41: 
                // Crear residuos del manifiesto
                return [4 /*yield*/, prisma.manifiestoResiduo.create({
                        data: {
                            manifiestoId: manifiesto.id,
                            tipoResiduoId: tipoResiduoId,
                            cantidad: Math.floor(100 + Math.random() * 900),
                            unidad: 'kg',
                            estado: config.estado === 'TRATADO' ? 'TRATADO' : 'PENDIENTE',
                            cantidadRecibida: config.estado === 'TRATADO' ? Math.floor(100 + Math.random() * 900) : null,
                        },
                    })];
                case 42:
                    // Crear residuos del manifiesto
                    _h.sent();
                    eventos = [
                        { tipo: 'CREACION', descripcion: 'Manifiesto creado', fecha: fechaCreacion },
                    ];
                    if (fechaFirma) {
                        eventos.push({ tipo: 'FIRMA', descripcion: 'Manifiesto firmado digitalmente', fecha: fechaFirma });
                    }
                    if (fechaRetiro) {
                        eventos.push({ tipo: 'RETIRO', descripcion: 'Residuos retirados por transportista', fecha: fechaRetiro });
                    }
                    if (fechaEntrega) {
                        eventos.push({ tipo: 'ENTREGA', descripcion: 'Residuos entregados en planta', fecha: fechaEntrega });
                    }
                    if (fechaRecepcion) {
                        eventos.push({ tipo: 'RECEPCION', descripcion: 'Residuos recibidos y verificados', fecha: fechaRecepcion });
                    }
                    if (fechaCierre) {
                        eventos.push({ tipo: 'CIERRE', descripcion: 'Tratamiento completado', fecha: fechaCierre });
                    }
                    _f = 0, eventos_1 = eventos;
                    _h.label = 43;
                case 43:
                    if (!(_f < eventos_1.length)) return [3 /*break*/, 46];
                    evento = eventos_1[_f];
                    return [4 /*yield*/, prisma.eventoManifiesto.create({
                            data: {
                                manifiestoId: manifiesto.id,
                                tipo: evento.tipo,
                                descripcion: evento.descripcion,
                                usuarioId: gen.usuario.id,
                                createdAt: evento.fecha,
                            },
                        })];
                case 44:
                    _h.sent();
                    _h.label = 45;
                case 45:
                    _f++;
                    return [3 /*break*/, 43];
                case 46:
                    if (!config.conTracking) return [3 /*break*/, 50];
                    puntos = [
                        { lat: -32.8908, lng: -68.8272, desc: 'Inicio - Mendoza Centro' },
                        { lat: -32.8850, lng: -68.8400, desc: 'Acceso Este' },
                        { lat: -32.8700, lng: -68.8600, desc: 'Ruta 7' },
                        { lat: -32.8500, lng: -68.8800, desc: 'Parque Industrial' },
                    ];
                    trackingTime = new Date(fechaRetiro);
                    _g = 0, puntos_1 = puntos;
                    _h.label = 47;
                case 47:
                    if (!(_g < puntos_1.length)) return [3 /*break*/, 50];
                    punto = puntos_1[_g];
                    return [4 /*yield*/, prisma.trackingGPS.create({
                            data: {
                                manifiestoId: manifiesto.id,
                                latitud: punto.lat,
                                longitud: punto.lng,
                                velocidad: 40 + Math.random() * 30,
                                timestamp: trackingTime,
                            },
                        })];
                case 48:
                    _h.sent();
                    trackingTime = new Date(trackingTime.getTime() + 15 * 60 * 1000); // +15 min
                    _h.label = 49;
                case 49:
                    _g++;
                    return [3 /*break*/, 47];
                case 50:
                    console.log("  \u2705 ".concat(config.numero, " - ").concat(config.estado).concat(config.firmado ? ' (firmado)' : ''));
                    _h.label = 51;
                case 51:
                    _e++;
                    return [3 /*break*/, 35];
                case 52:
                    console.log('');
                    console.log('🎉 Seed completado exitosamente!');
                    console.log('');
                    console.log('📋 Resumen de datos creados:');
                    console.log("   - 1 Administrador");
                    console.log("   - ".concat(generadores.length, " Generadores"));
                    console.log("   - ".concat(transportistas.length, " Transportistas (con veh\u00EDculos y choferes)"));
                    console.log("   - ".concat(operadores.length, " Operadores (con tratamientos autorizados)"));
                    console.log("   - ".concat(manifiestoConfigs.length, " Manifiestos en diferentes estados"));
                    console.log("   - ".concat(tiposResiduos.length, " Tipos de residuos"));
                    console.log('');
                    console.log('🔐 Credenciales de acceso (contraseña: "password"):');
                    console.log('   - Admin: admin@dgfa.mendoza.gov.ar');
                    console.log('   - Generador: quimica.mendoza@industria.com');
                    console.log('   - Transportista: transportes.andes@logistica.com');
                    console.log('   - Operador: tratamiento.residuos@planta.com');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
