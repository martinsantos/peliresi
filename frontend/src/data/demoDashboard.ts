import type { DashboardStats } from '../types';

export const demoStats: DashboardStats = {
    estadisticas: {
        total: 8,
        borradores: 2,
        aprobados: 1,
        enTransito: 2,
        entregados: 1,
        recibidos: 1,
        tratados: 1
    },
    recientes: [
        { id: '1', numero: 'MAN-2025-000005', estado: 'APROBADO', createdAt: new Date().toISOString(), generador: { razonSocial: 'Química Industrial' } } as any,
        { id: '2', numero: 'MAN-2025-000006', estado: 'EN_TRANSITO', createdAt: new Date().toISOString(), generador: { razonSocial: 'Hospital Central' } } as any,
        { id: '3', numero: 'MAN-2025-000007', estado: 'RECIBIDO', createdAt: new Date().toISOString(), generador: { razonSocial: 'Metalúrgica Oeste' } } as any,
    ],
    enTransitoList: [
        { id: '2', numero: 'MAN-2025-000006', transportista: { razonSocial: 'Logística Cuyo' }, generador: { domicilio: 'Godoy Cruz' }, operador: { domicilio: 'Luján de Cuyo' } } as any,
        { id: '4', numero: 'MAN-2025-000010', transportista: { razonSocial: 'Transportes Los Andes' }, generador: { domicilio: 'Mendoza Capital' }, operador: { domicilio: 'Maipú' } } as any,
    ]
};
