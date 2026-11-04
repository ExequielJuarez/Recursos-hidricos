// Error de negocio (validaciones): su mensaje es apto para mostrárselo al usuario
class ErrorNegocio extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "ErrorNegocio";
  }
}

module.exports = { ErrorNegocio };
