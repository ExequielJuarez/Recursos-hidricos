// Módulos del sistema que se pueden habilitar por usuario
const PERMISOS_DISPONIBLES = [
  "Vehicles",
  "Choferes",
  "Mantenimientos",
  "Tools",
  "Alertas",
  "Reportes",
  "Usuarios",
  "Roles",
  "Auditoria",
  "Siniestros",
];

const ROL_ADMIN = "Administrador";

const listaDesdeTexto = (texto) =>
  String(texto || "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => PERMISOS_DISPONIBLES.includes(p));

// Devuelve los permisos efectivos de un usuario (con su rol incluido como `rol`)
const resolverPermisos = (usuarioDB) => {
  const nombreRol = usuarioDB.rol ? usuarioDB.rol.nombre : null;
  if (nombreRol === ROL_ADMIN) return [...PERMISOS_DISPONIBLES];
  if (usuarioDB.permisos) return listaDesdeTexto(usuarioDB.permisos);
  return listaDesdeTexto(usuarioDB.rol && usuarioDB.rol.permisos);
};

// Normaliza lo que llega de un formulario (string | array | undefined) a una lista válida
const normalizarVistas = (vistas) => {
  const lista = Array.isArray(vistas) ? vistas : vistas ? [vistas] : [];
  return [...new Set(lista.map((v) => String(v).trim()).filter((v) => PERMISOS_DISPONIBLES.includes(v)))];
};

module.exports = { PERMISOS_DISPONIBLES, ROL_ADMIN, listaDesdeTexto, resolverPermisos, normalizarVistas };
