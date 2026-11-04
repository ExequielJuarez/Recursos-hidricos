// Datos BASE que siempre deben existir en la base (nuevas instalaciones y producción), sin ningún dato de ejemplo:
//   · usuario "admin"    → rol Administrador: ve TODO (Reportes y Análisis, Control de Acceso, Log de Auditoría, etc.).
//   · usuario "empleado" → rol "Empleado": solo lo operativo. NO ve Reportes y Análisis, Control de Acceso (Usuarios y Roles)
//                          ni Log de Auditoría.
//   · tipos de vehículo  → los necesita el alta de vehículos (la tabla se llena solo si está vacía).
// Todo es idempotente: no pisa contraseñas ni datos existentes (salvo que se pida `resetear`).
const bcrypt = require("bcryptjs");

// Contraseñas iniciales (se pueden cambiar con ADMIN_PASSWORD / EMPLEADO_PASSWORD o desde Control de Acceso > Usuarios)
const CLAVE_ADMIN = "administrador154";
const CLAVE_EMPLEADO = "empleado123";

const ROL_EMPLEADO = "Empleado";
const PERMISOS_EMPLEADO = ["Vehicles", "Choferes", "Mantenimientos", "Tools", "Alertas", "Siniestros"];

const TIPOS_BASE = [
  ["Camioneta", "km"],
  ["Camión", "km"],
  ["Maquinaria Pesada", "hs"],
  ["Utilitario", "km"],
  ["Auto", "km"],
  ["Motocicleta", "km"],
];

// `conexion`: conexión mysql2 (promesas) ya apuntando a la base.
// `resetear`: true → restablece la contraseña de ambos; o { admin: bool, empleado: bool } para elegir.
async function asegurarDatosBase(conexion, { adminPassword = CLAVE_ADMIN, empleadoPassword = CLAVE_EMPLEADO, resetear = false } = {}) {
  const resultado = { admin: "sin cambios", empleado: "sin cambios", tipos: 0 };
  const quiere = (cual) => (typeof resetear === "object" ? Boolean(resetear[cual]) : Boolean(resetear));

  const [[rolAdmin]] = await conexion.query("SELECT id_rol, permisos FROM rol WHERE nombre = 'Administrador' LIMIT 1");
  if (!rolAdmin) throw new Error("Falta el rol Administrador en la base de datos (cargá pruebasdb/esquema.sql).");

  // Rol "Empleado"
  let [[rolEmpleado]] = await conexion.query("SELECT id_rol FROM rol WHERE nombre = ? LIMIT 1", [ROL_EMPLEADO]);
  if (!rolEmpleado) {
    const [r] = await conexion.query("INSERT INTO rol (nombre, descripcion, permisos) VALUES (?, ?, ?)", [
      ROL_EMPLEADO,
      "Uso diario: vehículos, choferes, mantenimientos, herramientas, alertas y siniestros (sin reportes, control de acceso ni auditoría)",
      PERMISOS_EMPLEADO.join(","),
    ]);
    rolEmpleado = { id_rol: r.insertId };
  }

  const asegurar = async (nombreUsuario, nombre, apellido, idRol, permisos, clave, etiqueta) => {
    const [[existente]] = await conexion.query("SELECT id_usuario FROM usuario WHERE nombre_usuario = ?", [nombreUsuario]);
    if (!existente) {
      await conexion.query(
        "INSERT INTO usuario (nombre_usuario, contrasena, nombre, apellido, activo, id_rol, permisos) VALUES (?, ?, ?, ?, 1, ?, ?)",
        [nombreUsuario, bcrypt.hashSync(clave, 10), nombre, apellido, idRol, permisos],
      );
      resultado[etiqueta] = "creado";
    } else if (quiere(etiqueta)) {
      await conexion.query("UPDATE usuario SET contrasena = ?, activo = 1, id_rol = ?, permisos = ? WHERE id_usuario = ?", [bcrypt.hashSync(clave, 10), idRol, permisos, existente.id_usuario]);
      resultado[etiqueta] = "restablecido";
    }
  };

  // admin: permisos del rol Administrador (siempre ve todo). empleado: permisos NULL = hereda los del rol "Empleado"
  await asegurar("admin", "Administrador", "Sistema", rolAdmin.id_rol, rolAdmin.permisos, adminPassword, "admin");
  await asegurar("empleado", "Empleado", "Operativo", rolEmpleado.id_rol, null, empleadoPassword, "empleado");

  // Tipos de vehículo base (solo si no hay ninguno)
  const [[{ n }]] = await conexion.query("SELECT COUNT(*) n FROM tipo_vehiculo");
  if (n === 0) {
    for (const [descripcion, unidad] of TIPOS_BASE) await conexion.query("INSERT INTO tipo_vehiculo (descripcion, unidad) VALUES (?, ?)", [descripcion, unidad]);
    resultado.tipos = TIPOS_BASE.length;
  }
  return resultado;
}

module.exports = { asegurarDatosBase, CLAVE_ADMIN, CLAVE_EMPLEADO, ROL_EMPLEADO, PERMISOS_EMPLEADO, TIPOS_BASE };
