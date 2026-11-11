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

// Pestañas de cada módulo (las mismas del menú). Se guardan en los permisos como "Modulo:pestaña".
//   · Si un rol/usuario tiene el módulo y NINGUNA pestaña de ese módulo → ve todas las pestañas.
//   · Si tiene algunas pestañas del módulo → sólo ve esas.
// `rutas`: prefijos (en minúsculas) de las direcciones que pertenecen a cada pestaña.
const PESTANAS = {
  Vehicles: [
    { clave: "inventario", label: "Inventario de vehículos", rutas: ["/vehicles"] },
    { clave: "alta", label: "Alta de vehículo", rutas: ["/cargavehiculo"] },
    { clave: "asignar", label: "Asignar a chofer", rutas: ["/asignaciones"] },
    { clave: "km", label: "Carga de kilometraje", rutas: ["/actualizarkm"] },
    { clave: "ajustes", label: "Ajustes", rutas: ["/vehicles/ajustes"] },
  ],
  Choferes: [
    { clave: "nomina", label: "Nómina activa", rutas: ["/choferes"] },
    { clave: "alta", label: "Nuevo ingreso", rutas: ["/choferes/carga"] },
  ],
  Mantenimientos: [
    { clave: "historial", label: "Historial técnico", rutas: ["/mantenimientos"] },
    { clave: "carga", label: "Registrar orden", rutas: ["/mantenimientos/carga", "/cargamantenimiento"] },
    { clave: "administrativo", label: "Historial administrativo", rutas: ["/mantenimientos/historial"] },
    { clave: "repuestos", label: "Repuestos / Servicios", rutas: ["/repuestos"] },
  ],
  Tools: [
    { clave: "inventario", label: "Inventario físico", rutas: ["/tools"] },
    { clave: "carga", label: "Carga nueva", rutas: ["/tools/carga", "/tools/processcarga"] },
    { clave: "prestamos", label: "Control de préstamos", rutas: ["/tools/prestamos", "/tools/prestamo", "/tools/devolucion"] },
    { clave: "ajustes", label: "Ajustes base", rutas: ["/tools/ajustes"] },
  ],
  Siniestros: [
    { clave: "listado", label: "Listado de siniestros", rutas: ["/siniestros"] },
    { clave: "carga", label: "Registrar siniestro", rutas: ["/siniestros/carga"] },
  ],
  Usuarios: [
    { clave: "lista", label: "Usuarios", rutas: ["/usuarios"] },
    { clave: "alta", label: "Nuevo usuario", rutas: ["/usuarios/carga"] },
  ],
};

const esTokenPestana = (p) => {
  const [modulo, clave] = String(p).split(":");
  return !!(clave && PESTANAS[modulo] && PESTANAS[modulo].some((t) => t.clave === clave));
};
const esPermisoValido = (p) => PERMISOS_DISPONIBLES.includes(p) || esTokenPestana(p);

// Quita pestañas de módulos no habilitados y, si están todas las pestañas de un módulo, no guarda ninguna (= todas)
const compactar = (lista) => {
  const modulos = lista.filter((p) => PERMISOS_DISPONIBLES.includes(p));
  const pestanas = lista.filter((p) => esTokenPestana(p) && modulos.includes(p.split(":")[0]));
  const resultado = [...modulos];
  for (const modulo of modulos) {
    const delModulo = pestanas.filter((p) => p.startsWith(modulo + ":"));
    if (delModulo.length && delModulo.length < (PESTANAS[modulo] || []).length) resultado.push(...delModulo);
  }
  return [...new Set(resultado)];
};

const listaDesdeTexto = (texto) =>
  String(texto || "")
    .split(",")
    .map((p) => p.trim())
    .filter(esPermisoValido);

// Devuelve los permisos efectivos de un usuario (con su rol incluido como `rol`)
const resolverPermisos = (usuarioDB) => {
  const nombreRol = usuarioDB.rol ? usuarioDB.rol.nombre : null;
  if (nombreRol === ROL_ADMIN) return [...PERMISOS_DISPONIBLES];
  if (usuarioDB.permisos) return listaDesdeTexto(usuarioDB.permisos);
  return listaDesdeTexto(usuarioDB.rol && usuarioDB.rol.permisos);
};

// Normaliza lo que llega de un formulario (string | array | undefined) a una lista válida (módulos + pestañas)
const normalizarVistas = (vistas) => {
  const lista = Array.isArray(vistas) ? vistas : vistas ? [vistas] : [];
  return compactar([...new Set(lista.map((v) => String(v).trim()).filter(esPermisoValido))]);
};

// ¿Puede ver esta pestaña del módulo? (sin pestañas cargadas para el módulo = todas)
const puedePestana = (permisos, modulo, clave) => {
  if (!permisos.includes(modulo)) return false;
  const delModulo = permisos.filter((p) => p.startsWith(modulo + ":"));
  return !delModulo.length || delModulo.includes(`${modulo}:${clave}`);
};

// Pestaña a la que pertenece una dirección (la coincidencia más larga), o null
const pestanaParaRuta = (ruta) => {
  const r = String(ruta || "/").toLowerCase().split("?")[0];
  let mejor = null;
  for (const [modulo, pestanas] of Object.entries(PESTANAS)) {
    for (const p of pestanas) {
      for (const prefijo of p.rutas) {
        if ((r === prefijo || r.startsWith(prefijo + "/")) && (!mejor || prefijo.length > mejor.largo)) {
          mejor = { modulo, clave: p.clave, largo: prefijo.length };
        }
      }
    }
  }
  // "/usuarios/roles" es del módulo Roles (no tiene pestañas)
  if (mejor && mejor.modulo === "Usuarios" && (r === "/usuarios/roles" || r.startsWith("/usuarios/roles/"))) return null;
  return mejor;
};

// ¿Un permiso dado (módulo o "Modulo:pestaña") está incluido en una lista de permisos?
const incluyePermiso = (permisos, p) => {
  if (PERMISOS_DISPONIBLES.includes(p)) return permisos.includes(p);
  const [modulo, clave] = p.split(":");
  return puedePestana(permisos, modulo, clave);
};

module.exports = {
  PERMISOS_DISPONIBLES,
  ROL_ADMIN,
  PESTANAS,
  listaDesdeTexto,
  resolverPermisos,
  normalizarVistas,
  puedePestana,
  pestanaParaRuta,
  incluyePermiso,
};
