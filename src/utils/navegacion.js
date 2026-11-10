// Menú de navegación del sistema (una sola definición para la barra superior de escritorio,
// las pestañas de cada sección y el menú lateral de celular/tablet).
//   perm: permiso necesario (el Administrador ve todo).
//   items: pestañas de la sección. extras: otras páginas de la sección (solo para la ruta "Sección > Página").
//   cta: botón de acción principal que aparece a la derecha de las pestañas.
//   grupo "mas": se agrupa en el desplegable "Más" de la barra superior.
const ICONOS = {
  vehiculos: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  choferes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  mantenimientos: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  herramientas: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/><path d="M10 13v2h4v-2"/>',
  siniestros: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  reportes: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  alertas: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  acceso: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  auditoria: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h6"/>',
};

const SECCIONES = [
  {
    id: "vehiculos",
    label: "Vehículos",
    perm: "Vehicles",
    items: [
      { label: "Inventario de vehículos", corto: "Inventario", href: "/Vehicles" },
      { label: "Alta de vehículo", href: "/CargaVehiculo" },
      { label: "Asignar a chofer", href: "/asignaciones" },
      { label: "Carga de kilometraje", href: "/ActualizarKm" },
    ],
    extras: [
      { label: "Ajustes", href: "/Vehicles/Ajustes" },
      { label: "Editar vehículo", href: "/Vehicles/Editar" },
    ],
    cta: { label: "Nuevo vehículo", href: "/CargaVehiculo" },
  },
  {
    id: "choferes",
    label: "Choferes",
    perm: "Choferes",
    items: [
      { label: "Nómina activa", href: "/Choferes" },
      { label: "Nuevo ingreso", href: "/Choferes/Carga" },
    ],
    cta: { label: "Nuevo chofer", href: "/Choferes/Carga" },
  },
  {
    id: "mantenimientos",
    label: "Mantenimientos",
    perm: "Mantenimientos",
    items: [
      { label: "Historial técnico", href: "/Mantenimientos" },
      { label: "Registrar orden", href: "/Mantenimientos/carga" },
      { label: "Historial administrativo", href: "/Mantenimientos/Historial" },
      { label: "Repuestos", href: "/Repuestos/Gestionar" },
    ],
    cta: { label: "Nueva orden", href: "/Mantenimientos/carga" },
  },
  {
    id: "herramientas",
    label: "Herramientas",
    perm: "Tools",
    items: [
      { label: "Inventario físico", corto: "Inventario", href: "/Tools" },
      { label: "Carga nueva", href: "/Tools/Carga" },
      { label: "Control de préstamos", href: "/Tools/Prestamos" },
      { label: "Ajustes base", href: "/Tools/Ajustes" },
    ],
    extras: [
      { label: "Registrar préstamo", href: "/Tools/Prestamo" },
      { label: "Editar herramienta", href: "/Tools/Editar" },
    ],
    cta: { label: "Nueva herramienta", href: "/Tools/Carga" },
  },
  {
    id: "siniestros",
    label: "Siniestros",
    perm: "Siniestros",
    items: [
      { label: "Listado de siniestros", corto: "Listado", href: "/Siniestros" },
      { label: "Registrar siniestro", href: "/Siniestros/Carga" },
    ],
    cta: { label: "Nuevo siniestro", href: "/Siniestros/Carga" },
  },
  {
    id: "reportes",
    label: "Reportes",
    perm: "Reportes",
    items: [{ label: "Reportes y análisis", href: "/Reportes" }],
  },
  {
    id: "alertas",
    label: "Alertas",
    perm: "Alertas",
    grupo: "mas",
    items: [{ label: "Panel de alertas", href: "/Alertas" }],
  },
  {
    id: "acceso",
    label: "Control de acceso",
    perm: ["Usuarios", "Roles"],
    grupo: "mas",
    items: [
      { label: "Usuarios", href: "/Usuarios", perm: "Usuarios" },
      { label: "Nuevo usuario", href: "/Usuarios/Carga", perm: "Usuarios" },
      { label: "Roles y permisos", href: "/Usuarios/Roles", perm: "Roles" },
    ],
    extras: [{ label: "Editar usuario", href: "/Usuarios/Editar" }],
    cta: { label: "Nuevo usuario", href: "/Usuarios/Carga", perm: "Usuarios" },
  },
  {
    id: "auditoria",
    label: "Auditoría",
    perm: "Auditoria",
    grupo: "mas",
    items: [{ label: "Log de auditoría", href: "/Auditoria" }],
  },
];

const puede = (usuario, perm) => {
  if (!perm) return true;
  if (!usuario) return true;
  if (usuario.rol === "Administrador") return true;
  const propios = Array.isArray(usuario.permisos) ? usuario.permisos : String(usuario.permisos || "").split(",");
  return (Array.isArray(perm) ? perm : [perm]).some((p) => propios.includes(p));
};

// Secciones (y pestañas) que puede ver el usuario
const seccionesVisibles = (usuario) =>
  SECCIONES.filter((s) => puede(usuario, s.perm))
    .map((s) => ({
      ...s,
      icono: ICONOS[s.id],
      items: s.items.filter((i) => puede(usuario, i.perm)),
      cta: s.cta && puede(usuario, s.cta.perm) ? s.cta : null,
    }))
    .filter((s) => s.items.length);

// Sección y página activas según la ruta (gana la coincidencia más larga)
const ubicar = (ruta, secciones) => {
  const p = String(ruta || "").toLowerCase();
  let mejor = { seccion: null, item: null, etiqueta: null, largo: 0 };
  for (const s of secciones) {
    for (const [i, esExtra] of [...s.items.map((x) => [x, false]), ...(s.extras || []).map((x) => [x, true])]) {
      const h = i.href.toLowerCase();
      const coincide = p === h || p.startsWith(h + "/");
      if (coincide && h.length > mejor.largo) {
        mejor = { seccion: s, item: esExtra ? null : i, etiqueta: i.corto || i.label, largo: h.length };
      }
    }
  }
  return mejor;
};

const iniciales = (u) => {
  if (!u) return "AS";
  const a = String(u.nombre || "").trim()[0] || "";
  const b = String(u.apellido || "").trim()[0] || "";
  return (a + b).toUpperCase() || "US";
};

module.exports = { SECCIONES, ICONOS, seccionesVisibles, ubicar, iniciales };
