// Deja el sistema SIN datos cargados (vehículos, choferes y todo lo que depende de ellos) para empezar de cero.
// Conserva: usuarios, roles y los tipos de vehículo. Con `catalogos` también vacía distritos, sectores y operarios.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { credenciales } = require("./preparar");
const { DIR_DOCUMENTOS } = require("../../utils/documentos");

const TABLAS = [
  "documento_adjunto",
  "detalle_mantenimiento",
  "mantenimiento",
  "historial_km",
  "asignacion_vehiculo",
  "siniestro",
  "prestamo",
  "herramienta",
  "licencia_chofer",
  "chofer",
  "vehiculo",
  "repuestos",
  "alerta",
  "auditoria",
];
const TABLAS_CATALOGO = ["distritos", "sectores", "operarios"];

// Archivos subidos (con marca de tiempo) de choferes, vehículos y siniestros + documentos adjuntos
const borrarArchivosSubidos = () => {
  let borrados = 0;
  const quitar = (dir, patron) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (patron.test(f)) {
        fs.unlinkSync(path.join(dir, f));
        borrados++;
      }
    }
  };
  const img = path.join(__dirname, "../../../public/img");
  quitar(path.join(img, "licencias"), /^chofer-\d+\./);
  quitar(path.join(img, "vehiculos"), /^vehiculo-\d+\./);
  quitar(path.join(img, "siniestros"), /^siniestro-\d+\./);
  quitar(DIR_DOCUMENTOS, /^doc-|^demo-/);
  return borrados;
};

async function limpiarDatos({ catalogos = false } = {}) {
  const conexion = await mysql.createConnection(credenciales());
  try {
    const existentes = (await conexion.query("SHOW TABLES"))[0].map((r) => Object.values(r)[0]);
    await conexion.query("SET FOREIGN_KEY_CHECKS = 0");
    const vaciadas = [];
    for (const t of [...TABLAS, ...(catalogos ? TABLAS_CATALOGO : [])]) {
      if (!existentes.includes(t)) continue;
      await conexion.query(`TRUNCATE TABLE \`${t}\``);
      vaciadas.push(t);
    }
    await conexion.query("SET FOREIGN_KEY_CHECKS = 1");
    return { tablas: vaciadas, archivos: borrarArchivosSubidos() };
  } finally {
    await conexion.end();
  }
}

module.exports = { limpiarDatos, TABLAS };
