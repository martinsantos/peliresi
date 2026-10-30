-- Sólo lectura, resultados agregados: no devuelve identificadores ni datos personales.
-- Ejecutar únicamente contra la base elegida y autorizada para el análisis del corte.
-- Los grupos se superponen: no deben sumarse. Son candidatos para revisión;
-- no se infiere consentimiento ni se valida aquí el contenido del marcador.
BEGIN TRANSACTION READ ONLY;

SELECT 'SIN_PROPUESTA_REGISTRADA' AS motivo,
       m.estado::text AS estado,
       COALESCE(m.modalidad, 'FIJO') AS modalidad,
       COUNT(*) AS registros
FROM manifiestos AS m
WHERE m."isDemoData" = false
  AND m.estado::text IN ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO')
  AND NOT EXISTS (
    SELECT 1 FROM eventos_manifiesto AS e
    WHERE e."manifiestoId" = m.id AND e.tipo = 'PROPUESTA_PARTES_V1'
  )
GROUP BY m.estado, COALESCE(m.modalidad, 'FIJO')

UNION ALL

SELECT 'MARCADORES_MULTIPLES' AS motivo,
       m.estado::text AS estado,
       COALESCE(m.modalidad, 'FIJO') AS modalidad,
       COUNT(*) AS registros
FROM manifiestos AS m
WHERE m."isDemoData" = false
  AND m.estado::text IN ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO')
  AND (SELECT COUNT(*) FROM eventos_manifiesto AS e
       WHERE e."manifiestoId" = m.id AND e.tipo = 'PROPUESTA_PARTES_V1') > 1
GROUP BY m.estado, COALESCE(m.modalidad, 'FIJO')

UNION ALL

SELECT 'APROBADO_SIN_TRES_DECISIONES' AS motivo,
       m.estado::text AS estado,
       COALESCE(m.modalidad, 'FIJO') AS modalidad,
       COUNT(*) AS registros
FROM manifiestos AS m
WHERE m."isDemoData" = false
  AND m.estado::text = 'APROBADO'
  AND EXISTS (SELECT 1 FROM eventos_manifiesto AS e WHERE e."manifiestoId" = m.id AND e.tipo = 'PROPUESTA_PARTES_V1')
  AND (NOT EXISTS (SELECT 1 FROM eventos_manifiesto AS e WHERE e."manifiestoId" = m.id AND e.tipo = 'FIRMA')
    OR NOT EXISTS (SELECT 1 FROM eventos_manifiesto AS e WHERE e."manifiestoId" = m.id AND e.tipo = 'APROBACION_TRANSPORTISTA')
    OR NOT EXISTS (SELECT 1 FROM eventos_manifiesto AS e WHERE e."manifiestoId" = m.id AND e.tipo = 'APROBACION_OPERADOR'))
GROUP BY m.estado, COALESCE(m.modalidad, 'FIJO')

UNION ALL

SELECT 'APROBADO_O_PENDIENTE_CON_RECHAZO' AS motivo,
       m.estado::text AS estado,
       COALESCE(m.modalidad, 'FIJO') AS modalidad,
       COUNT(*) AS registros
FROM manifiestos AS m
WHERE m."isDemoData" = false
  AND m.estado::text IN ('PENDIENTE_APROBACION', 'APROBADO')
  AND EXISTS (SELECT 1 FROM eventos_manifiesto AS e WHERE e."manifiestoId" = m.id AND e.tipo = 'RECHAZO_PARTE')
GROUP BY m.estado, COALESCE(m.modalidad, 'FIJO')

UNION ALL

SELECT 'ORIGEN_SIN_TRANSPORTE' AS motivo,
       m.estado::text AS estado,
       COALESCE(m.modalidad, 'FIJO') AS modalidad,
       COUNT(*) AS registros
FROM manifiestos AS m
WHERE m."isDemoData" = false
  AND m.estado::text IN ('PENDIENTE_APROBACION', 'APROBADO')
  AND m.modalidad = 'IN_SITU'
  AND m."transportistaId" IS NULL
  AND EXISTS (
    SELECT 1 FROM eventos_manifiesto AS e
    WHERE e."manifiestoId" = m.id AND e.tipo = 'PROPUESTA_PARTES_V1'
  )
GROUP BY m.estado, COALESCE(m.modalidad, 'FIJO')
ORDER BY motivo, estado, modalidad;

COMMIT;
