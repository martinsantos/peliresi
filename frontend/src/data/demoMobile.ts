// Demo data for mobile app - Extracted from MobileApp.tsx
// Centralizes demo/mock data for cleaner component code

import type { Manifiesto, Actor, Alerta } from '../types/mobile.types';

export const DEMO_MANIFIESTOS: Manifiesto[] = [
    { id: 'm1', numero: '2025-000005', estado: 'APROBADO', generador: 'Química Industrial Mendoza', operador: 'Centro Tratamiento Cuyo', residuo: 'Y1 - Ácido Clorhídrico', cantidad: '150 kg', fecha: '07/12' },
    { id: 'm2', numero: '2025-000006', estado: 'EN_TRANSITO', generador: 'Hospital Central', operador: 'Planta Este', residuo: 'Y3 - Medicamentos', cantidad: '80 kg', fecha: '07/12', eta: '14:30' },
    { id: 'm3', numero: '2025-000004', estado: 'RECIBIDO', generador: 'Petroandina S.A.', operador: 'Centro Tratamiento Cuyo', residuo: 'Y8 - Aceites', cantidad: '1200 L', fecha: '06/12' },
    { id: 'm4', numero: '2025-000001', estado: 'TRATADO', generador: 'Química Industrial', operador: 'Centro Tratamiento', residuo: 'Y1 - Desechos', cantidad: '250 kg', fecha: '01/12' },
    { id: 'm5', numero: '2025-000007', estado: 'APROBADO', generador: 'Metalúrgica del Oeste', operador: 'Centro Tratamiento Cuyo', residuo: 'Y12 - Pinturas y barnices', cantidad: '95 kg', fecha: '08/12' },
    { id: 'm6', numero: '2025-000008', estado: 'EN_TRANSITO', generador: 'Farmacéutica Los Andes', operador: 'Planta Este', residuo: 'Y4 - Reactivos químicos', cantidad: '120 L', fecha: '08/12', eta: '16:45' },
    { id: 'm7', numero: '2025-000009', estado: 'APROBADO', generador: 'Laboratorio Análisis SA', operador: 'Centro Tratamiento Cuyo', residuo: 'Y6 - Solventes halogenados', cantidad: '65 L', fecha: '08/12' },
    { id: 'm8', numero: '2025-000003', estado: 'RECIBIDO', generador: 'Automotriz Cuyo', operador: 'Planta Este', residuo: 'Y9 - Aceites hidráulicos', cantidad: '450 L', fecha: '05/12' },
];

export const DEMO_ACTORES: Actor[] = [
    { id: 'g1', tipo: 'GENERADOR', nombre: 'Química Industrial Mendoza', cuit: '30-12345678-9', estado: 'ACTIVO' },
    { id: 'g2', tipo: 'GENERADOR', nombre: 'Hospital Central Mendoza', cuit: '30-87654321-0', estado: 'ACTIVO' },
    { id: 't1', tipo: 'TRANSPORTISTA', nombre: 'Transportes Los Andes', cuit: '30-11111111-1', estado: 'ACTIVO', vehiculos: 5 },
    { id: 't2', tipo: 'TRANSPORTISTA', nombre: 'Logística Cuyo S.A.', cuit: '30-22222222-2', estado: 'ACTIVO', vehiculos: 8 },
    { id: 'o1', tipo: 'OPERADOR', nombre: 'Centro Tratamiento Cuyo', cuit: '30-33333333-3', estado: 'ACTIVO' },
    { id: 'o2', tipo: 'OPERADOR', nombre: 'Planta Este Residuos', cuit: '30-44444444-4', estado: 'ACTIVO' },
];

export const DEMO_ALERTAS: Alerta[] = [
    { id: 'a1', tipo: 'warning', mensaje: 'Manifiesto #000006 demora en ruta', tiempo: '15 min' },
    { id: 'a2', tipo: 'info', mensaje: 'Nuevo manifiesto asignado', tiempo: '1h' },
    { id: 'a3', tipo: 'success', mensaje: 'Recepción confirmada', tiempo: '3h' },
    { id: 'a4', tipo: 'warning', mensaje: 'Vehículo ABC-123 requiere mantenimiento', tiempo: '4h' },
    { id: 'a5', tipo: 'info', mensaje: 'Actualización de sistema disponible', tiempo: '1d' },
];

// Helper to get manifiestos by estado
export const getManifiestosByEstado = (estado: string) => 
    DEMO_MANIFIESTOS.filter(m => m.estado === estado);

// Stats calculation
export const getManifiestoStats = () => ({
    pendientes: DEMO_MANIFIESTOS.filter(m => m.estado === 'APROBADO').length,
    enCurso: DEMO_MANIFIESTOS.filter(m => m.estado === 'EN_TRANSITO').length,
    recibidos: DEMO_MANIFIESTOS.filter(m => m.estado === 'RECIBIDO').length,
    tratados: DEMO_MANIFIESTOS.filter(m => m.estado === 'TRATADO').length,
});
