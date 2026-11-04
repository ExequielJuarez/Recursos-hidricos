// Arma pruebasdb/copiaseguridad.sql (recrea la base + esquema + datos de ejemplo)
//   npm run db:armar
const fs = require("fs");
const path = require("path");

const carpeta = path.join(__dirname, "../pruebasdb");
const leer = (n) => fs.readFileSync(path.join(carpeta, n), "utf8");

const cabecera = `-- ============================================================================
--  Ficha Técnica de Vehículos · Base de datos COMPLETA (esquema + datos de ejemplo)
--  Archivo generado a partir de esquema.sql y datos_demo.sql (npm run db:armar).
--
--  Uso:   mysql -u root -p < pruebasdb/copiaseguridad.sql
--
--  ATENCIÓN: BORRA y vuelve a crear la base \`vehiculos_db\`.
--  Usuarios de ejemplo (contraseña temporal  Ficha2026! ): admin, carlos_oficina,
--  walter, ExeJuarez, taller_jefe y ex_empleado (bloqueado).
-- ============================================================================

DROP DATABASE IF EXISTS \`vehiculos_db\`;
CREATE DATABASE \`vehiculos_db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE \`vehiculos_db\`;

`;

// esquema.sql ya trae los roles base; el demo no los repite
fs.writeFileSync(path.join(carpeta, "copiaseguridad.sql"), cabecera + leer("esquema.sql") + "\n" + leer("datos_demo.sql"));
console.log("pruebasdb/copiaseguridad.sql actualizado");
