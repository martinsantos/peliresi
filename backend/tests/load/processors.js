/**
 * Artillery Processors para SITREP Load Tests
 * Funciones personalizadas para procesamiento de requests/responses
 */

module.exports = {
  /**
   * Genera un timestamp ISO actual
   */
  generateTimestamp: function(userContext, events, done) {
    userContext.vars.timestamp = new Date().toISOString();
    return done();
  },

  /**
   * Genera coordenadas GPS aleatorias en Mendoza, Argentina
   */
  generateGPSCoordinates: function(userContext, events, done) {
    // Coordenadas base de Mendoza
    const baseLat = -32.8908;
    const baseLng = -68.8272;

    // Variación aleatoria (+/- 0.1 grados)
    userContext.vars.latitud = baseLat + (Math.random() - 0.5) * 0.2;
    userContext.vars.longitud = baseLng + (Math.random() - 0.5) * 0.2;
    userContext.vars.velocidad = Math.floor(Math.random() * 80) + 20; // 20-100 km/h

    return done();
  },

  /**
   * Genera un ID de manifiesto para pruebas
   */
  generateManifiestoId: function(userContext, events, done) {
    const year = new Date().getFullYear();
    const num = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    userContext.vars.manifiestoNumero = `${year}-${num}`;
    return done();
  },

  /**
   * Log de respuesta para debugging
   */
  logResponse: function(requestParams, response, context, ee, next) {
    if (response.statusCode !== 200) {
      console.log(`[${response.statusCode}] ${requestParams.url}`);
    }
    return next();
  },

  /**
   * Valida que la respuesta tenga estructura esperada
   */
  validateResponse: function(requestParams, response, context, ee, next) {
    try {
      const body = JSON.parse(response.body);
      if (!body.success && response.statusCode === 200) {
        console.warn(`Response sin success=true: ${requestParams.url}`);
      }
    } catch (e) {
      // Respuesta no es JSON válido
    }
    return next();
  }
};
