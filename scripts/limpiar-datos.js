// Deja el sistema limpio: borra vehículos, choferes y todo lo que depende de ellos (asignaciones, mantenimientos,
// repuestos, herramientas, siniestros, documentos, alertas y auditoría). Conserva usuarios, roles y tipos de vehículo.
//   node scripts/limpiar-datos.js --confirmar               → vacía los datos
//   node scripts/limpiar-datos.js --confirmar --catalogos   → además vacía distritos, sectores y operarios
require("dotenv").config({ quiet: true });
const { limpiarDatos } = require("../src/model/database/limpieza");

(async () => {
  const base = process.env.DB_NAME || "(la configurada en .env)";
  if (!process.argv.includes("--confirmar")) {
    console.log(`Esto BORRA todos los vehiculos, choferes y datos asociados de la base ${base}.`);
    console.log("Para continuar ejecuta:  node scripts/limpiar-datos.js --confirmar");
    process.exit(1);
  }
  const r = await limpiarDatos({ catalogos: process.argv.includes("--catalogos") });
  console.log("");
  console.log(`  Listo: sistema limpio (${r.tablas.length} tablas vaciadas, ${r.archivos} archivos subidos borrados).`);
  console.log("  Se conservaron los usuarios, los roles y los tipos de vehiculo.");
  console.log("");
})().catch((e) => {
  console.error("");
  console.error("  [ERROR] No se pudo limpiar: " + e.message);
  console.error("");
  process.exit(1);
});
