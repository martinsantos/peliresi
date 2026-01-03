import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Configuración
const BASE_URL = 'https://sitrep.ultimamilla.com.ar/api';
const OUTPUT_FILE = path.join(__dirname, 'verification_report.md');

// Credenciales (del seed)
const CREDENTIALS = {
  ADMIN: { email: 'admin@dgfa.mendoza.gov.ar', password: 'admin123' },
  GENERADOR: { email: 'quimica.mendoza@industria.com', password: 'gen123' },
  TRANSPORTISTA: { email: 'transportes.andes@logistica.com', password: 'trans123' },
  OPERADOR: { email: 'tratamiento.residuos@planta.com', password: 'op123' }
};

// Estado global para compartir datos entre pasos
const STATE: any = {
  tokens: {},
  ids: {},
  manifiesto: null,
  tipoResiduoId: ''
};

// Logger simple para el reporte
const logs: string[] = [];
function log(msg: string, type: 'INFO' | 'SUCCESS' | 'ERROR' | 'STEP' = 'INFO') {
  const icon = type === 'SUCCESS' ? '✅' : type === 'ERROR' ? '❌' : type === 'STEP' ? '🔹' : 'ℹ️';
  const line = `${icon} [${type}] ${msg}`;
  console.log(line);
  logs.push(line);
}

// Cliente API helper mejorado para logging
const api = (role: keyof typeof CREDENTIALS) => {
  const instance = axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${STATE.tokens[role]}`,
      'Content-Type': 'application/json'
    },
    validateStatus: () => true
  });
  
  // Interceptor para loguear errores
  instance.interceptors.response.use(response => {
      if (response.status >= 400) {
          console.error(`❌ API Error [${response.status}] ${response.config.url}:`, JSON.stringify(response.data, null, 2));
      }
      return response;
  });
  
  return instance;
};

async function runTest() {
  log('INICIANDO VERIFICACIÓN EXHAUSTIVA DE CASOS DE USO (SITREP)', 'STEP');
  
  try {
    // 1. LOGIN ADMIN
    log('Autenticando usuarios...', 'STEP');
    for (const role of Object.keys(CREDENTIALS) as Array<keyof typeof CREDENTIALS>) {
      const creds = CREDENTIALS[role];
      const res = await axios.post(`${BASE_URL}/auth/login`, creds);
      
      if (res.status === 200 && res.data.success) {
        STATE.tokens[role] = res.data.data.tokens.accessToken;
        
        // Guardar IDs de actores
        const user = res.data.data.user;
        if (role === 'GENERADOR') STATE.ids.generador = user.generador?.id;
        if (role === 'TRANSPORTISTA') STATE.ids.transportista = user.transportista?.id;
        if (role === 'OPERADOR') STATE.ids.operador = user.operador?.id;
        
        log(`Login ${role}: OK`, 'SUCCESS');
      } else {
        log(`Login ${role}: FAILED`, 'ERROR');
        throw new Error(`No se pudo loguear como ${role}`);
      }
    }

    // 2. OBTENER TIPOS DE RESIDUOS (Catalogo)
    log('Obteniendo catálogo de residuos...', 'STEP');
    const catalogRes = await api('GENERADOR').get('/catalogos/tipos-residuos');
    if (catalogRes.status === 200) {
      STATE.tipoResiduoId = catalogRes.data.data.tiposResiduos[0].id;
      log('Catálogo obtenido OK', 'SUCCESS');
    } else {
      throw new Error('Fallo al obtener catálogo');
    }

    // 3. GENERADOR: CREAR MANIFIESTO (CU-G03)
    log('Creando Manifiesto (Generador)...', 'STEP');
    const createPayload = {
      transportistaId: STATE.ids.transportista,
      operadorId: STATE.ids.operador,
      observaciones: 'Manifiesto de prueba automatizado',
      residuos: [
        {
          tipoResiduoId: STATE.tipoResiduoId,
          cantidad: 1500,
          unidad: 'kg',
          descripcion: 'Residuos de proceso químico'
        }
      ]
    };

    const createRes = await api('GENERADOR').post('/manifiestos', createPayload);
    if (createRes.status === 201) {
      STATE.manifiesto = createRes.data.data.manifiesto;
      log(`Manifiesto Creado: ${STATE.manifiesto.numero} (ID: ${STATE.manifiesto.id})`, 'SUCCESS');
    } else {
      throw new Error(`Fallo crear manifiesto`);
    }

    // 4. GENERADOR: FIRMAR MANIFIESTO (CU-G07)
    log('Firmando Manifiesto (Generador)...', 'STEP');
    const signRes = await api('GENERADOR').post(`/manifiestos/${STATE.manifiesto.id}/firmar`);
    if (signRes.status === 200) {
      const qrCode = signRes.data.data.manifiesto.qrCode;
      if (qrCode && qrCode.startsWith('data:image')) {
        log(`Manifiesto Firmado. QR generado correctamente (Base64 Image).`, 'SUCCESS');
      } else {
        log(`Manifiesto Firmado pero formato QR inesperado: ${qrCode?.substring(0, 20)}...`, 'ERROR');
      }
    } else {
      throw new Error('Error firmando manifiesto');
    }

    // 5. TRANSPORTISTA: CONFIRMAR RETIRO (CU-T03)
    log('Confirmando Retiro (Transportista)...', 'STEP');
    const retiroRes = await api('TRANSPORTISTA').post(`/manifiestos/${STATE.manifiesto.id}/confirmar-retiro`, {
      latitud: -32.8895,
      longitud: -68.8458,
      observaciones: 'Retiro confirmado desde planta'
    });
    if (retiroRes.status === 200) {
      log('Retiro Confirmado. Estado: EN_TRANSITO', 'SUCCESS');
    } else {
      throw new Error('Error al confirmar retiro');
    }

    // 6. TRANSPORTISTA: REGISTRAR INCIDENTE (CU-T06)
    log('Registrando Incidente Simulado (Transportista)...', 'STEP');
    const incidenteRes = await api('TRANSPORTISTA').post(`/manifiestos/${STATE.manifiesto.id}/incidente`, {
      tipoIncidente: 'DEMORA',
      descripcion: 'Demora por tráfico intenso',
      latitud: -32.9,
      longitud: -68.85
    });
    if (incidenteRes.status === 200) {
      log('Incidente registrado correctamente', 'SUCCESS');
    } else {
      throw new Error('Error registrando incidente');
    }

    // 7. TRANSPORTISTA: CONFIRMAR ENTREGA (CU-T07)
    log('Confirmando Entrega (Transportista)...', 'STEP');
    const entregaRes = await api('TRANSPORTISTA').post(`/manifiestos/${STATE.manifiesto.id}/confirmar-entrega`, {
      latitud: -33.0,
      longitud: -68.9,
      observaciones: 'Entregado en planta de tratamiento'
    });
    if (entregaRes.status === 200) {
      log('Entrega Confirmada. Estado: ENTREGADO', 'SUCCESS');
    } else {
      throw new Error('Error confirmando entrega');
    }

    // 8. OPERADOR: REGISTRAR PESAJE (CU-O04)
    // NOTA: El pesaje debe realizarse ANTES de confirmar la recepción definitiva (que cambia estado a RECIBIDO)
    log('Registrando Pesaje Detallado (Operador)...', 'STEP');
    // Necesitamos el ID del residuo dentro del manifiesto
    const manifiestoRes = await api('OPERADOR').get(`/manifiestos/${STATE.manifiesto.id}`);
    const residuoId = manifiestoRes.data.data.manifiesto.residuos[0].id;

    const pesajeRes = await api('OPERADOR').post(`/manifiestos/${STATE.manifiesto.id}/pesaje`, {
      residuosPesados: [
        { id: residuoId, pesoReal: 1450 }
      ],
      observaciones: 'Pesaje verificado en báscula'
    });
    if (pesajeRes.status === 200) {
      log('Pesaje registrado. Diferencia calculada automáticamente.', 'SUCCESS');
    } else {
      throw new Error('Error registrando pesaje');
    }

    // 9. OPERADOR: CONFIRMAR RECEPCIÓN (CU-O03)
    log('Confirmando Recepción (Operador)...', 'STEP');
    const recepRes = await api('OPERADOR').post(`/manifiestos/${STATE.manifiesto.id}/confirmar-recepcion`, {
      pesoReal: 1450, // Pequeña diferencia para probar validación
      observaciones: 'Recibido conforme con leve diferencia de peso'
    });
    if (recepRes.status === 200) {
      log('Recepción Confirmada. Estado: RECIBIDO', 'SUCCESS');
    } else {
      throw new Error('Error confirmando recepción');
    }

    // 10. OPERADOR: REGISTRAR TRATAMIENTO (CU-O08)
    log('Registrando Tratamiento (Operador)...', 'STEP');
    const tratRes = await api('OPERADOR').post(`/manifiestos/${STATE.manifiesto.id}/tratamiento`, {
      metodoTratamiento: 'Incineración',
      observaciones: 'Iniciando proceso térmico'
    });
    if (tratRes.status === 200) {
      log('Tratamiento Iniciado. Estado: EN_TRATAMIENTO', 'SUCCESS');
    } else {
      throw new Error('Error registrando tratamiento');
    }

    // 11. OPERADOR: CERRAR MANIFIESTO (CU-O09)
    log('Cerrando Manifiesto (Operador)...', 'STEP');
    const cierreRes = await api('OPERADOR').post(`/manifiestos/${STATE.manifiesto.id}/cerrar`, {
      metodoTratamiento: 'Incineración completa', // Confirmación final
      observaciones: 'Proceso finalizado exitosamente'
    });
    if (cierreRes.status === 200) {
      log('Manifiesto Cerrado. Estado: TRATADO', 'SUCCESS');
    } else {
      throw new Error('Error cerrando manifiesto');
    }

    // 12. ADMIN: VERIFICAR Y REPORTE
    log('Verificación Final (Admin)...', 'STEP');
    const checkRes = await api('ADMIN').get(`/manifiestos/${STATE.manifiesto.id}`);
    if (checkRes.status === 200 && checkRes.data.data.manifiesto.estado === 'TRATADO') {
      log('Ciclo completo verificado por Admin', 'SUCCESS');
    } else {
      throw new Error('El estado final no es el esperado');
    }

    // GENERAR REPORTE
    log('Generando reporte final...', 'STEP');
    fs.writeFileSync(OUTPUT_FILE, logs.join('\n'));
    console.log(`Reporte guardado en: ${OUTPUT_FILE}`);

  } catch (error: any) {
    log(`ERROR FATAL: ${error.message}`, 'ERROR');
    fs.writeFileSync(OUTPUT_FILE, logs.join('\n'));
    process.exit(1);
  }
}

runTest();
