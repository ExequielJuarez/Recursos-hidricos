// Arma pruebasdb/instalacion_limpia.sql: la base LISTA PARA USAR y VACÍA de datos de ejemplo.
//   npm run db:instalacion
// Incluye las tablas, los roles, los dos usuarios base (admin y empleado) y los tipos de vehículo. Nada más:
// vehículos, choferes, mantenimientos, etc. los carga cada uno.
//   Importar:  mysql -u root -p < pruebasdb/instalacion_limpia.sql
// (La aplicación hace lo mismo sola al arrancar; este archivo sirve para crear la base a mano, por ejemplo desde phpMyAdmin.)
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { CLAVE_ADMIN, CLAVE_EMPLEADO, ROL_EMPLEADO, PERMISOS_EMPLEADO, TIPOS_BASE } = require("../src/model/database/datosBase");

const carpeta = path.join(__dirname, "../pruebasdb");
const esquema = fs.readFileSync(path.join(carpeta, "esquema.sql"), "utf8");
const q = (t) => "'" + String(t).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";

const sql = `-- ============================================================================
--  Ficha Técnica de Vehículos · INSTALACIÓN LIMPIA (sin datos de ejemplo)
--  Archivo generado a partir de esquema.sql (npm run db:instalacion).
--
--  Trae: tablas, roles, los usuarios base y los tipos de vehículo. Nada más.
--    admin     contraseña: ${CLAVE_ADMIN}    → ve TODO
--    empleado  contraseña: ${CLAVE_EMPLEADO}      → sin Reportes y Análisis, Control de Acceso ni Log de Auditoría
--
--  Uso:   mysql -u root -p < pruebasdb/instalacion_limpia.sql
--  ATENCIÓN: BORRA y vuelve a crear la base \`vehiculos_db\`.
-- ============================================================================

DROP DATABASE IF EXISTS \`vehiculos_db\`;
CREATE DATABASE \`vehiculos_db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE \`vehiculos_db\`;

${esquema}

-- ---------------------------------------------------------------------------
--  Datos base
-- ---------------------------------------------------------------------------
INSERT INTO \`rol\` (\`nombre\`, \`descripcion\`, \`permisos\`) VALUES
 (${q(ROL_EMPLEADO)}, ${q("Uso diario: vehículos, choferes, mantenimientos, herramientas, alertas y siniestros (sin reportes, control de acceso ni auditoría)")}, ${q(PERMISOS_EMPLEADO.join(","))});

INSERT INTO \`usuario\` (\`nombre_usuario\`, \`contrasena\`, \`nombre\`, \`apellido\`, \`activo\`, \`id_rol\`, \`permisos\`) VALUES
 ('admin', ${q(bcrypt.hashSync(CLAVE_ADMIN, 10))}, 'Administrador', 'Sistema', 1, (SELECT \`id_rol\` FROM \`rol\` WHERE \`nombre\` = 'Administrador'), (SELECT \`permisos\` FROM \`rol\` WHERE \`nombre\` = 'Administrador')),
 ('empleado', ${q(bcrypt.hashSync(CLAVE_EMPLEADO, 10))}, 'Empleado', 'Operativo', 1, (SELECT \`id_rol\` FROM \`rol\` WHERE \`nombre\` = ${q(ROL_EMPLEADO)}), NULL);

INSERT INTO \`tipo_vehiculo\` (\`descripcion\`, \`unidad\`) VALUES
${TIPOS_BASE.map(([d, u]) => ` (${q(d)}, ${q(u)})`).join(",\n")};
`;

fs.writeFileSync(path.join(carpeta, "instalacion_limpia.sql"), sql);
console.log("pruebasdb/instalacion_limpia.sql actualizado");
