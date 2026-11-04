// Prepara la base (la crea si no existe) y deja listos los datos base. Es lo mismo que hace la aplicación al arrancar:
//   admin    (ve todo)                                                  · contraseña inicial: administrador154
//   empleado (sin Reportes y Análisis, Control de Acceso ni Auditoría)  · contraseña inicial: empleado123
//   + los tipos de vehículo base. Vehículos, choferes y demás quedan VACÍOS: los carga cada uno.
//   node scripts/crear-usuarios.js            → crea lo que falte (no toca contraseñas existentes)
//   node scripts/crear-usuarios.js --resetear → vuelve a dejar las contraseñas iniciales (o las de ADMIN_PASSWORD / EMPLEADO_PASSWORD)
require("dotenv").config({ quiet: true });
const { prepararBaseDeDatos } = require("../src/model/database/preparar");
const { asegurarUsuarios } = require("../src/model/database/usuariosBase");
const { CLAVE_ADMIN, CLAVE_EMPLEADO } = require("../src/model/database/datosBase");

const adminPassword = process.env.ADMIN_PASSWORD || CLAVE_ADMIN;
const empleadoPassword = process.env.EMPLEADO_PASSWORD || CLAVE_EMPLEADO;

(async () => {
  await prepararBaseDeDatos();
  await asegurarUsuarios({ adminPassword, empleadoPassword, resetear: process.argv.includes("--resetear") });
})().catch((e) => {
  console.error("");
  console.error("  [ERROR] No se pudo preparar la base de datos: " + e.message);
  console.error("  Verifica que MySQL este encendido y que los datos DB_* del archivo .env sean correctos.");
  console.error("");
  process.exit(1);
});
