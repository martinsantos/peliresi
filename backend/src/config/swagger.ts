import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SITREP API — Sistema de Trazabilidad de Residuos Peligrosos',
      version: '1.0.0',
      description: 'API REST del sistema SITREP para la Provincia de Mendoza. Gestiona manifiestos de residuos peligrosos, tracking GPS, actores (generadores, transportistas, operadores), reportes y administracion.',
      contact: {
        name: 'DGFA — Direccion General de Fiscalizacion Ambiental',
        email: 'admin@dgfa.mendoza.gov.ar',
      },
      license: {
        name: 'Gobierno de Mendoza',
      },
    },
    servers: [
      { url: '/api', description: 'API Base' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtenido via POST /api/auth/login',
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Autenticacion, registro, perfil' },
      { name: 'Manifiestos', description: 'CRUD y workflow de manifiestos' },
      { name: 'Catalogos', description: 'Tipos de residuos, tratamientos' },
      { name: 'Actores', description: 'Generadores, transportistas, operadores' },
      { name: 'Reportes', description: 'Reportes por periodo, exportacion CSV' },
      { name: 'PDF', description: 'Generacion de manifiestos y certificados PDF' },
      { name: 'Analytics', description: 'Dashboard analytics y estadisticas' },
      { name: 'Notificaciones', description: 'Notificaciones, alertas, anomalias' },
      { name: 'Carga Masiva', description: 'Importacion masiva de actores via CSV' },
      { name: 'Admin', description: 'Gestion de usuarios (solo ADMIN)' },
      { name: 'Centro de Control', description: 'Sala de operaciones: actividad por capas' },
      { name: 'Search', description: 'Busqueda global' },
      { name: 'Health', description: 'Estado del sistema' },
    ],
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
