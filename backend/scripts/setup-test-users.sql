-- ============================================================
-- SCRIPT: CREAR USUARIOS Y DATOS DE PRUEBA PARA TESTING
-- Sistema de Trazabilidad de Residuos Peligrosos
-- Fecha: 2026-01-10
-- ============================================================

-- IMPORTANTE: Este script crea datos de prueba marcados con prefijo [TEST]
-- para facilitar su identificación y limpieza posterior.

-- ============================================================
-- 1. CREAR USUARIOS DE PRUEBA (si no existen)
-- ============================================================

-- Usuario Transportista de Prueba
INSERT INTO usuarios (id, email, nombre, password, rol, activo, "createdAt", "updatedAt")
VALUES (
  'test-transportista-001',
  'transportista@test.com',
  '[TEST] Transportista Demo',
  '$2a$10$N9qo8uLOickgx2ZqPYYjQ.r7LMQnZpGV7YPL0vbTNqXqLz1gMpvK6', -- Password: 123456
  'TRANSPORTISTA',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Usuario Operador de Prueba
INSERT INTO usuarios (id, email, nombre, password, rol, activo, "createdAt", "updatedAt")
VALUES (
  'test-operador-001',
  'operador@test.com',
  '[TEST] Operador Demo',
  '$2a$10$N9qo8uLOickgx2ZqPYYjQ.r7LMQnZpGV7YPL0vbTNqXqLz1gMpvK6', -- Password: 123456
  'OPERADOR',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Usuario Generador de Prueba
INSERT INTO usuarios (id, email, nombre, password, rol, activo, "createdAt", "updatedAt")
VALUES (
  'test-generador-001',
  'generador@test.com',
  '[TEST] Generador Demo',
  '$2a$10$N9qo8uLOickgx2ZqPYYjQ.r7LMQnZpGV7YPL0vbTNqXqLz1gMpvK6', -- Password: 123456
  'GENERADOR',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 2. CREAR GENERADOR DE PRUEBA
-- ============================================================

INSERT INTO generadores (id, "usuarioId", "razonSocial", cuit, domicilio, telefono, email, "numeroInscripcion", categoria, activo, "createdAt", "updatedAt")
VALUES (
  'gen-test-001',
  'test-generador-001',
  '[TEST] Industria Demo S.A.',
  '20-12345678-9',
  'Av. Test 1234, Mendoza',
  '261-4567890',
  'generador@test.com',
  'GEN-TEST-001',
  'GRANDE',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. CREAR TRANSPORTISTA DE PRUEBA
-- ============================================================

INSERT INTO transportistas (id, "usuarioId", "razonSocial", cuit, domicilio, telefono, email, "numeroHabilitacion", activo, "createdAt", "updatedAt")
VALUES (
  'trans-test-001',
  'test-transportista-001',
  '[TEST] Transporte Demo S.R.L.',
  '20-98765432-1',
  'Av. Transporte 5678, Mendoza',
  '261-9876543',
  'transportista@test.com',
  'TRANS-TEST-001',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Crear vehículo de prueba para el transportista
INSERT INTO vehiculos (id, "transportistaId", patente, marca, modelo, anio, capacidad, "numeroHabilitacion", vencimiento, activo, "createdAt", "updatedAt")
VALUES (
  'veh-test-001',
  'trans-test-001',
  'TEST123',
  'Mercedes-Benz',
  'Atego 1726',
  2020,
  5000,
  'VEH-TEST-001',
  NOW() + INTERVAL '2 years',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Crear chofer de prueba
INSERT INTO choferes (id, "transportistaId", nombre, apellido, dni, licencia, vencimiento, telefono, activo, "createdAt", "updatedAt")
VALUES (
  'chofer-test-001',
  'trans-test-001',
  'Juan',
  'Perez [TEST]',
  '12345678',
  'LIC-TEST-001',
  NOW() + INTERVAL '3 years',
  '261-4444444',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. CREAR OPERADOR DE PRUEBA
-- ============================================================

INSERT INTO operadores (id, "usuarioId", "razonSocial", cuit, domicilio, telefono, email, "numeroHabilitacion", categoria, activo, "createdAt", "updatedAt")
VALUES (
  'oper-test-001',
  'test-operador-001',
  '[TEST] Operador Tratamiento Demo S.A.',
  '20-11223344-5',
  'Parque Industrial Test, Mendoza',
  '261-1122334',
  'operador@test.com',
  'OPER-TEST-001',
  'TRATAMIENTO',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. CREAR TIPOS DE RESIDUOS DE PRUEBA (si no existen)
-- ============================================================

-- Usar tipo de residuo Y8 existente
DO $$
DECLARE
  residuo_y8_id TEXT;
BEGIN
  -- Obtener el ID del tipo de residuo Y8 existente
  SELECT id INTO residuo_y8_id FROM tipos_residuos WHERE codigo = 'Y8' LIMIT 1;

  -- Si no existe, crear uno nuevo
  IF residuo_y8_id IS NULL THEN
    INSERT INTO tipos_residuos (id, codigo, nombre, categoria, caracteristicas, peligrosidad, activo, "createdAt", "updatedAt")
    VALUES (
      'residuo-test-001',
      'Y8-TEST',
      '[TEST] Aceites usados',
      'Y',
      'Inflamable, Tóxico',
      'ALTA',
      true,
      NOW(),
      NOW()
    );
    residuo_y8_id := 'residuo-test-001';
  END IF;

  -- Guardar el ID en una tabla temporal para usarlo después
  CREATE TEMP TABLE IF NOT EXISTS temp_test_residuo (id TEXT);
  DELETE FROM temp_test_residuo;
  INSERT INTO temp_test_residuo (id) VALUES (residuo_y8_id);
END $$;

-- ============================================================
-- 6. AUTORIZAR OPERADOR PARA TRATAR RESIDUOS DE PRUEBA
-- ============================================================

INSERT INTO tratamientos_autorizados (id, "operadorId", "tipoResiduoId", metodo, descripcion, capacidad, activo, "createdAt", "updatedAt")
SELECT
  'trat-test-001',
  'oper-test-001',
  (SELECT id FROM temp_test_residuo),
  'INCINERACION',
  '[TEST] Tratamiento autorizado para residuo Y8',
  10000.0,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM tratamientos_autorizados WHERE id = 'trat-test-001'
);

-- ============================================================
-- 7. CREAR MANIFIESTOS DE PRUEBA EN ESTADO APROBADO
-- ============================================================

-- Manifiesto de prueba 1 (APROBADO - listo para retiro)
INSERT INTO manifiestos (
  id, numero, "generadorId", "transportistaId", "operadorId",
  estado, observaciones, "qrCode", "creadoPorId",
  "createdAt", "updatedAt"
)
VALUES (
  'man-test-001',
  '2026-TEST001',
  'gen-test-001',
  'trans-test-001',
  'oper-test-001',
  'APROBADO',
  '[TEST] Manifiesto de prueba 1 - Listo para retiro',
  '{"url": "https://sitrep.ultimamilla.com.ar/verify/man-test-001"}',
  'test-generador-001',
  NOW(),
  NOW()
)
ON CONFLICT (numero) DO NOTHING;

-- Agregar residuo al manifiesto
INSERT INTO manifiestos_residuos (id, "manifiestoId", "tipoResiduoId", cantidad, unidad, "cantidadRecibida", "tipoDiferencia", estado, "createdAt")
SELECT
  'mr-test-001',
  'man-test-001',
  (SELECT id FROM temp_test_residuo),
  100,
  'kg',
  NULL,
  'NINGUNA',
  'PENDIENTE',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM manifiestos_residuos WHERE id = 'mr-test-001'
);

-- Evento de creación
INSERT INTO eventos_manifiesto (id, "manifiestoId", tipo, "usuarioId", descripcion, "createdAt")
VALUES (
  'ev-test-001',
  'man-test-001',
  'CREACION',
  'test-generador-001',
  '[TEST] Manifiesto creado',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Evento de firma (cambio a APROBADO)
INSERT INTO eventos_manifiesto (id, "manifiestoId", tipo, "usuarioId", descripcion, "createdAt")
VALUES (
  'ev-test-002',
  'man-test-001',
  'FIRMA',
  'test-generador-001',
  '[TEST] Manifiesto firmado y aprobado',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Manifiesto de prueba 2 (APROBADO - listo para retiro)
INSERT INTO manifiestos (
  id, numero, "generadorId", "transportistaId", "operadorId",
  estado, observaciones, "qrCode", "creadoPorId",
  "createdAt", "updatedAt"
)
VALUES (
  'man-test-002',
  '2026-TEST002',
  'gen-test-001',
  'trans-test-001',
  'oper-test-001',
  'APROBADO',
  '[TEST] Manifiesto de prueba 2 - Para probar restricción de 1 viaje simultáneo',
  '{"url": "https://sitrep.ultimamilla.com.ar/verify/man-test-002"}',
  'test-generador-001',
  NOW(),
  NOW()
)
ON CONFLICT (numero) DO NOTHING;

-- Agregar residuo al manifiesto 2
INSERT INTO manifiestos_residuos (id, "manifiestoId", "tipoResiduoId", cantidad, unidad, "cantidadRecibida", "tipoDiferencia", estado, "createdAt")
SELECT
  'mr-test-002',
  'man-test-002',
  (SELECT id FROM temp_test_residuo),
  150,
  'kg',
  NULL,
  'NINGUNA',
  'PENDIENTE',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM manifiestos_residuos WHERE id = 'mr-test-002'
);

-- Evento de creación manifiesto 2
INSERT INTO eventos_manifiesto (id, "manifiestoId", tipo, "usuarioId", descripcion, "createdAt")
VALUES (
  'ev-test-003',
  'man-test-002',
  'CREACION',
  'test-generador-001',
  '[TEST] Manifiesto 2 creado',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Evento de firma manifiesto 2
INSERT INTO eventos_manifiesto (id, "manifiestoId", tipo, "usuarioId", descripcion, "createdAt")
VALUES (
  'ev-test-004',
  'man-test-002',
  'FIRMA',
  'test-generador-001',
  '[TEST] Manifiesto 2 firmado',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Manifiesto de prueba 3 (APROBADO)
INSERT INTO manifiestos (
  id, numero, "generadorId", "transportistaId", "operadorId",
  estado, observaciones, "qrCode", "creadoPorId",
  "createdAt", "updatedAt"
)
VALUES (
  'man-test-003',
  '2026-TEST003',
  'gen-test-001',
  'trans-test-001',
  'oper-test-001',
  'APROBADO',
  '[TEST] Manifiesto de prueba 3',
  '{"url": "https://sitrep.ultimamilla.com.ar/verify/man-test-003"}',
  'test-generador-001',
  NOW(),
  NOW()
)
ON CONFLICT (numero) DO NOTHING;

-- Agregar residuo al manifiesto 3
INSERT INTO manifiestos_residuos (id, "manifiestoId", "tipoResiduoId", cantidad, unidad, "cantidadRecibida", "tipoDiferencia", estado, "createdAt")
SELECT
  'mr-test-003',
  'man-test-003',
  (SELECT id FROM temp_test_residuo),
  200,
  'kg',
  NULL,
  'NINGUNA',
  'PENDIENTE',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM manifiestos_residuos WHERE id = 'mr-test-003'
);

-- Eventos manifiesto 3
INSERT INTO eventos_manifiesto (id, "manifiestoId", tipo, "usuarioId", descripcion, "createdAt")
VALUES (
  'ev-test-005',
  'man-test-003',
  'CREACION',
  'test-generador-001',
  '[TEST] Manifiesto 3 creado',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO eventos_manifiesto (id, "manifiestoId", tipo, "usuarioId", descripcion, "createdAt")
VALUES (
  'ev-test-006',
  'man-test-003',
  'FIRMA',
  'test-generador-001',
  '[TEST] Manifiesto 3 firmado',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. VERIFICACIÓN
-- ============================================================

-- Mostrar usuarios de prueba creados
SELECT 'USUARIOS DE PRUEBA CREADOS:' AS info;
SELECT id, email, rol, activo FROM usuarios WHERE email LIKE '%@test.com';

-- Mostrar manifiestos de prueba
SELECT 'MANIFIESTOS DE PRUEBA CREADOS:' AS info;
SELECT numero, estado, observaciones FROM manifiestos WHERE numero LIKE '2026-TEST%';

-- Contar manifiestos APROBADOS del transportista de prueba
SELECT 'MANIFIESTOS APROBADOS PARA TRANSPORTISTA TEST:' AS info;
SELECT COUNT(*) as total FROM manifiestos
WHERE "transportistaId" = 'trans-test-001'
AND estado = 'APROBADO';

-- ============================================================
-- 9. SCRIPT DE LIMPIEZA (EJECUTAR DESPUÉS DE TESTS)
-- ============================================================

-- COMENTADO - Descomentar para limpiar datos de prueba:
/*
-- Eliminar en orden inverso por foreign keys
DELETE FROM eventos_manifiesto WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE numero LIKE '2026-TEST%');
DELETE FROM manifiestos_residuos WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE numero LIKE '2026-TEST%');
DELETE FROM manifiestos WHERE numero LIKE '2026-TEST%';
DELETE FROM tratamientos_autorizados WHERE id LIKE 'trat-test-%';
DELETE FROM tipos_residuos WHERE codigo LIKE '%TEST%';
DELETE FROM choferes WHERE id LIKE 'chofer-test-%';
DELETE FROM vehiculos WHERE id LIKE 'veh-test-%';
DELETE FROM operadores WHERE id LIKE 'oper-test-%';
DELETE FROM transportistas WHERE id LIKE 'trans-test-%';
DELETE FROM generadores WHERE id LIKE 'gen-test-%';
DELETE FROM usuarios WHERE email LIKE '%@test.com';

SELECT 'DATOS DE PRUEBA ELIMINADOS' AS info;
*/

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================

SELECT '✅ SCRIPT DE SETUP COMPLETADO EXITOSAMENTE' AS resultado;
