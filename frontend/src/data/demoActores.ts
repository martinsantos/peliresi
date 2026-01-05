import type { Generador, Transportista, Operador } from '../services/admin.service';

export const demoGeneradores: Generador[] = [
    { id: '1', razonSocial: 'Química Industrial Mendoza', cuit: '30-71234567-8', email: 'contacto@quimica.com', telefono: '+54 261 4231234', activo: true, domicilio: 'Av. Libertador 1234', _count: { manifiestos: 12 } } as Generador,
    { id: '2', razonSocial: 'Hospital Central Mendoza', cuit: '30-71234570-1', email: 'residuos@hospital.gob.ar', telefono: '+54 261 4231235', activo: true, domicilio: 'San Martín 345', _count: { manifiestos: 8 } } as Generador,
    { id: '3', razonSocial: 'Farmacéutica Los Andes', cuit: '30-71234574-5', email: 'admin@farmaceutica.com', telefono: '+54 261 4231236', activo: true, domicilio: 'Ruta 7 Km 10', _count: { manifiestos: 5 } } as Generador,
];

export const demoTransportistas: Transportista[] = [
    { id: '1', razonSocial: 'Transportes Los Andes S.A.', cuit: '30-71234568-9', email: 'logistica@losandes.com', telefono: '+54 261 4231237', activo: true, domicilio: 'Belgrano 1111', numeroHabilitacion: 'HAB-001', vehiculos: [], choferes: [], _count: { manifiestos: 15 } } as Transportista,
    { id: '2', razonSocial: 'Logística Cuyo S.R.L.', cuit: '30-71234571-2', email: 'admin@logisticacuyo.com', telefono: '+54 261 4231238', activo: true, domicilio: 'Acceso Este 2222', numeroHabilitacion: 'HAB-002', vehiculos: [], choferes: [], _count: { manifiestos: 10 } } as Transportista,
];

export const demoOperadores: Operador[] = [
    { id: '1', razonSocial: 'Centro de Tratamiento Cuyo', cuit: '30-71234569-0', email: 'operaciones@ctcuyo.com', telefono: '+54 261 4231239', activo: true, domicilio: 'Ruta 40 Km 12', numeroHabilitacion: 'HAB-OP-001', categoria: 'TRATAMIENTO', _count: { manifiestos: 20 } } as Operador,
    { id: '2', razonSocial: 'Planta Este Residuos', cuit: '30-71234572-3', email: 'contacto@plantaeste.com', telefono: '+54 261 4231240', activo: true, domicilio: 'Ruta 7 Km 18', numeroHabilitacion: 'HAB-OP-002', categoria: 'DISPOSICION_FINAL', _count: { manifiestos: 13 } } as Operador,
];
