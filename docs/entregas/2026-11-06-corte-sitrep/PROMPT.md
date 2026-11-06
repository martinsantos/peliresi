# Prompt para la próxima IA

Revisá SITREP de manera independiente. El repositorio es martinsantos/peliresi. Traé la rama codex/entrega-revision-sitrep-20261106 y leé docs/entregas/2026-11-06-corte-sitrep/README.md y sus evidencias. Creá tu propia rama para cualquier cambio. La versión funcional que debés comparar es 1e87f12bf73923e88c7e6a9dd96e6c230b4ac079, ya publicada. El merge de main 8b2c54a9735acd451ad5a264c6e1ed3d54e060b5 tiene el mismo árbol. La revisión que te pido es previa al próximo despliegue.

Empezá por reproducir en preview el recorrido Eventual → antecedente → agenda del jefe → visita del inspector → acta → eventual de origen → regreso. Usá los seis casos artificiales identificados en el JSON si siguen disponibles. Contrastá interfaz, respuesta HTTP y base de QA. Reemplazá observaciones, probá un identificador ajeno, un inspector no asignado y más de una parte externa. Contrastá web, /app, PDF y copia firmada. No confundas la vista móvil probada en Chromium con Android físico.

Después revisá los otros recorridos de la matriz por rol. Prestá especial atención a permisos, borradores, reintentos sin duplicados, GPS, OCR incompleto y enlaces de avisos. Separá reglas de manifiestos ordinarios y eventuales. Priorizá pérdidas de datos, accesos indebidos y bloqueos por encima de ajustes cosméticos.

Trabajá exclusivamente en preview con datos artificiales. Comprobá el aislamiento, CAP cerrado y correos/push apagados antes de ejecutar pruebas. No envíes correos ni push, no uses credenciales o expedientes reales, no toques producción, no fusiones en main ni dispares el publicador. Para correo, inspeccioná las plantillas o un sumidero local. Si falta dispositivo o participantes, dejá explícitamente esa cobertura pendiente.

Entregá primero hallazgos reproducidos por gravedad, con rol, superficie, pasos, resultado esperado/obtenido, evidencia y prueba de regresión propuesta. Distinguí defecto confirmado, hipótesis y caso no probado. Cerrá con el SHA revisado, las pruebas ejecutadas y qué impediría recomendar un siguiente corte. Si no encontrás fallas, precisá qué límites tuvo la revisión.
