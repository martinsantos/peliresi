/**
 * Datos de catálogos demo para el sistema de trazabilidad RRPP
 * Usados cuando no hay backend disponible
 */

import type { TipoResiduo, Transportista, Operador, Generador } from '../types';

export const tiposResiduosDemo: TipoResiduo[] = [
    { id: '1', codigo: 'Y1', nombre: 'Desechos clínicos', descripcion: 'Residuos de hospitales y centros de salud', categoria: 'A', peligrosidad: 'Alta', activo: true },
    { id: '2', codigo: 'Y2', nombre: 'Desechos farmacéuticos', descripcion: 'Medicamentos vencidos o fuera de especificación', categoria: 'A', peligrosidad: 'Alta', activo: true },
    { id: '3', codigo: 'Y3', nombre: 'Desechos de medicamentos', descripcion: 'Residuos de producción de productos farmacéuticos', categoria: 'A', peligrosidad: 'Alta', activo: true },
    { id: '4', codigo: 'Y6', nombre: 'Aceites minerales usados', descripcion: 'Aceites lubricantes, hidráulicos y térmicos usados', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '5', codigo: 'Y8', nombre: 'Desechos con PCB', descripcion: 'Aceites y equipos contaminados con PCB', categoria: 'A', peligrosidad: 'Alta', activo: true },
    { id: '6', codigo: 'Y9', nombre: 'Mezclas de aceites', descripcion: 'Mezclas y emulsiones de aceites y agua', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '7', codigo: 'Y12', nombre: 'Tintas y colorantes', descripcion: 'Residuos de tintas, colorantes y pigmentos', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '8', codigo: 'Y13', nombre: 'Resinas y látex', descripcion: 'Residuos de producción de resinas y adhesivos', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '9', codigo: 'Y16', nombre: 'Productos fotoquímicos', descripcion: 'Líquidos de revelado y fijación', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '10', codigo: 'Y17', nombre: 'Tratamiento de metales', descripcion: 'Residuos de decapado y galvanizado', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '11', codigo: 'Y18', nombre: 'Residuos industriales', descripcion: 'Residuos varios de procesos industriales', categoria: 'C', peligrosidad: 'Baja', activo: true },
    { id: '12', codigo: 'Y21', nombre: 'Compuestos de cromo', descripcion: 'Residuos con cromo hexavalente', categoria: 'A', peligrosidad: 'Alta', activo: true },
    { id: '13', codigo: 'Y23', nombre: 'Compuestos de zinc', descripcion: 'Residuos con compuestos de zinc', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '14', codigo: 'Y26', nombre: 'Cadmio y compuestos', descripcion: 'Residuos con cadmio', categoria: 'A', peligrosidad: 'Alta', activo: true },
    { id: '15', codigo: 'Y29', nombre: 'Mercurio y compuestos', descripcion: 'Residuos con mercurio', categoria: 'A', peligrosidad: 'Alta', activo: true },
    { id: '16', codigo: 'Y31', nombre: 'Plomo y compuestos', descripcion: 'Baterías y residuos con plomo', categoria: 'A', peligrosidad: 'Alta', activo: true },
    { id: '17', codigo: 'Y34', nombre: 'Ácidos en solución', descripcion: 'Ácidos inorgánicos diversos', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '18', codigo: 'Y35', nombre: 'Bases en solución', descripcion: 'Soluciones alcalinas', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '19', codigo: 'Y42', nombre: 'Solventes orgánicos', descripcion: 'Solventes halogenados y no halogenados', categoria: 'B', peligrosidad: 'Media', activo: true },
    { id: '20', codigo: 'Y45', nombre: 'Compuestos organohalogenados', descripcion: 'Residuos con compuestos organohalogenados', categoria: 'A', peligrosidad: 'Alta', activo: true },
];

export const transportistasDemo: Transportista[] = [
    {
        id: '1',
        usuarioId: 't1',
        razonSocial: 'Transportes Ecológicos S.A.',
        cuit: '30-71234567-8',
        numeroHabilitacion: 'TRP-2024-001',
        domicilio: 'Av. Industrial 1234, Godoy Cruz',
        telefono: '261-4567890',
        email: 'contacto@transpeco.com.ar',
        activo: true
    },
    {
        id: '2',
        usuarioId: 't2',
        razonSocial: 'Logística Verde Cuyo SRL',
        cuit: '30-72345678-9',
        numeroHabilitacion: 'TRP-2024-002',
        domicilio: 'Ruta 40 Km 1050, Luján de Cuyo',
        telefono: '261-4890123',
        email: 'operaciones@logisticaverde.com.ar',
        activo: true
    },
    {
        id: '3',
        usuarioId: 't3',
        razonSocial: 'Transporte Los Andes S.A.',
        cuit: '30-73456789-0',
        numeroHabilitacion: 'TRP-2024-003',
        domicilio: 'Calle San Martín 500, Ciudad de Mendoza',
        telefono: '261-4234567',
        email: 'info@transportelosandes.com.ar',
        activo: true
    },
    {
        id: '4',
        usuarioId: 't4',
        razonSocial: 'EcoTransporte Mendoza',
        cuit: '30-74567890-1',
        numeroHabilitacion: 'TRP-2024-004',
        domicilio: 'Parque Industrial, San Rafael',
        telefono: '260-4456789',
        email: 'contacto@ecotransporte.com.ar',
        activo: true
    },
];

export const operadoresDemo: Operador[] = [
    {
        id: '1',
        usuarioId: 'o1',
        razonSocial: 'Planta de Tratamiento Norte S.A.',
        cuit: '30-81234567-8',
        categoria: 'A',
        numeroHabilitacion: 'OPE-2024-001',
        domicilio: 'Parque Industrial Norte, Las Heras',
        telefono: '261-4111222',
        email: 'operaciones@ptanorte.com.ar',
        activo: true
    },
    {
        id: '2',
        usuarioId: 'o2',
        razonSocial: 'Reciclados Cuyo SRL',
        cuit: '30-82345678-9',
        categoria: 'B',
        numeroHabilitacion: 'OPE-2024-002',
        domicilio: 'Zona Industrial, Maipú',
        telefono: '261-4333444',
        email: 'info@recicladoscuyo.com.ar',
        activo: true
    },
    {
        id: '3',
        usuarioId: 'o3',
        razonSocial: 'Tratamiento Ambiental de Mendoza',
        cuit: '30-83456789-0',
        categoria: 'A',
        numeroHabilitacion: 'OPE-2024-003',
        domicilio: 'Ruta 7 Km 1100, Lavalle',
        telefono: '261-4555666',
        email: 'contacto@tam-mza.com.ar',
        activo: true
    },
    {
        id: '4',
        usuarioId: 'o4',
        razonSocial: 'EcoReciclaje San Rafael',
        cuit: '30-84567890-1',
        categoria: 'C',
        numeroHabilitacion: 'OPE-2024-004',
        domicilio: 'Parque Industrial Sur, San Rafael',
        telefono: '260-4777888',
        email: 'operaciones@ecoreciclaje.com.ar',
        activo: true
    },
];

export const generadoresDemo: Generador[] = [
    {
        id: '1',
        usuarioId: 'g1',
        razonSocial: 'Hospital Central de Mendoza',
        cuit: '30-91234567-8',
        numeroInscripcion: 'GEN-2024-001',
        categoria: 'Grande',
        domicilio: 'Av. Alem 450, Ciudad de Mendoza',
        telefono: '261-4201234',
        email: 'residuos@hospitalcentral.mza.gov.ar',
        activo: true
    },
    {
        id: '2',
        usuarioId: 'g2',
        razonSocial: 'Industrias Metalúrgicas del Oeste',
        cuit: '30-92345678-9',
        numeroInscripcion: 'GEN-2024-002',
        categoria: 'Grande',
        domicilio: 'Parque Industrial, Godoy Cruz',
        telefono: '261-4304567',
        email: 'ambiente@metalurgicasoeste.com.ar',
        activo: true
    },
    {
        id: '3',
        usuarioId: 'g3',
        razonSocial: 'Bodega Valle del Sol S.A.',
        cuit: '30-93456789-0',
        numeroInscripcion: 'GEN-2024-003',
        categoria: 'Mediano',
        domicilio: 'Ruta 40 Km 980, Luján de Cuyo',
        telefono: '261-4987654',
        email: 'sustentabilidad@valledelsol.com.ar',
        activo: true
    },
    {
        id: '4',
        usuarioId: 'g4',
        razonSocial: 'Laboratorios Farmacéuticos Cuyo',
        cuit: '30-94567890-1',
        numeroInscripcion: 'GEN-2024-004',
        categoria: 'Mediano',
        domicilio: 'Zona Industrial, Maipú',
        telefono: '261-4112233',
        email: 'calidad@labcuyo.com.ar',
        activo: true
    },
    {
        id: '5',
        usuarioId: 'g5',
        razonSocial: 'Minera Los Cerros S.A.',
        cuit: '30-95678901-2',
        numeroInscripcion: 'GEN-2024-005',
        categoria: 'Grande',
        domicilio: 'Ruta Provincial 52, Malargüe',
        telefono: '260-4998877',
        email: 'ambiental@mineraloscerros.com.ar',
        activo: true
    },
];
