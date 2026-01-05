export const datosDemoReportes = {
    manifiestos: {
        resumen: {
            totalManifiestos: 156,
            totalResiduos: 45230.5,
            periodo: { desde: '2025-11-01', hasta: '2025-12-04' }
        },
        porEstado: {
            BORRADOR: 12,
            APROBADO: 23,
            EN_TRANSITO: 18,
            ENTREGADO: 28,
            RECIBIDO: 35,
            TRATADO: 40
        },
        porTipoResiduo: {
            'Y1 - Desechos Clínicos': { cantidad: 12450.5, unidad: 'kg' },
            'Y2 - Desechos de Medicamentos': { cantidad: 8320.0, unidad: 'kg' },
            'Y3 - Desechos de Biocidas': { cantidad: 5680.0, unidad: 'kg' },
            'Y8 - Desechos de Aceites Minerales': { cantidad: 9540.0, unidad: 'L' },
            'Y12 - Pinturas y Lacas': { cantidad: 4120.0, unidad: 'kg' },
            'Y16 - Desechos Fotográficos': { cantidad: 2340.0, unidad: 'kg' },
            'Y18 - Residuos de Operaciones Industriales': { cantidad: 2780.0, unidad: 'kg' }
        },
        manifiestos: []
    },
    tratados: {
        resumen: {
            totalManifiestosTratados: 40,
            totalResiduosTratados: 18450.5
        },
        porGenerador: {
            'Industrias Químicas Mendoza S.A.': 12,
            'Laboratorios ACME S.R.L.': 8,
            'Minera Los Andes S.A.': 7,
            'Hospital Central': 6,
            'Petroquímica Cuyo S.A.': 4,
            'Otros Generadores': 3
        }
    },
    transporte: {
        resumen: {
            totalTransportistas: 8,
            totalViajes: 156,
            viajesActivos: 18,
            viajesCompletados: 138
        },
        transportistas: [
            { transportista: 'Transporte RRPP Cuyo', cuit: '30-71234567-8', totalViajes: 45, completados: 42, enTransito: 3, pendientes: 0, vehiculos: 5, choferes: 8, tasaCompletitud: '93.3%' },
            { transportista: 'Logística Ambiental S.A.', cuit: '30-71234568-9', totalViajes: 38, completados: 35, enTransito: 2, pendientes: 1, vehiculos: 4, choferes: 6, tasaCompletitud: '92.1%' },
            { transportista: 'Eco-Transporte Mendoza', cuit: '30-71234569-0', totalViajes: 32, completados: 30, enTransito: 2, pendientes: 0, vehiculos: 3, choferes: 5, tasaCompletitud: '93.8%' },
            { transportista: 'Residuos Express S.R.L.', cuit: '30-71234570-1', totalViajes: 25, completados: 22, enTransito: 3, pendientes: 0, vehiculos: 3, choferes: 4, tasaCompletitud: '88.0%' },
            { transportista: 'AT Servicios Ambientales', cuit: '30-71234571-2', totalViajes: 16, completados: 9, enTransito: 8, pendientes: 0, vehiculos: 2, choferes: 3, tasaCompletitud: '56.3%' }
        ]
    }
};
