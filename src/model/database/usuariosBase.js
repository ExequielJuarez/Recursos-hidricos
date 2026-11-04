// Acceso por scripts (npm run usuarios, npm run compartir, pruebas) a los datos base: abre su propia conexión.
// La lógica vive en datosBase.js, que también usa el arranque de la aplicación (preparar.js).
const mysql = require("mysql2/promise");
const { credenciales } = require("./preparar");
const datosBase = require("./datosBase");

async function conConexion(fn) {
  const conexion = await mysql.createConnection(credenciales());
  try {
    return await fn(conexion);
  } finally {
    await conexion.end();
  }
}

// Crea lo que falte (admin, empleado, rol y tipos de vehículo). No pisa contraseñas salvo `resetear`.
const asegurarUsuarios = (opciones = {}) => conConexion((c) => datosBase.asegurarDatosBase(c, opciones));

// Solo los tipos de vehículo base (devuelve cuántos cargó)
const asegurarTiposBase = () => conConexion(async (c) => (await datosBase.asegurarDatosBase(c)).tipos);

module.exports = {
  asegurarUsuarios,
  asegurarTiposBase,
  ROL_EMPLEADO: datosBase.ROL_EMPLEADO,
  PERMISOS_EMPLEADO: datosBase.PERMISOS_EMPLEADO,
  TIPOS_BASE: datosBase.TIPOS_BASE,
};
