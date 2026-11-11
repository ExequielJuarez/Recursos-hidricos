// Instalación con DATOS DE EJEMPLO para mostrar el programa cargado.
//   npm run db:instalar
//
// 1. Crea la base si no existe (y las tablas), con los usuarios base:
//      admin    · contraseña: administrador154
//      empleado · contraseña: empleado123
// 2. VACÍA los datos que haya (vehículos, choferes, mantenimientos, etc.) y carga los de ejemplo:
//      15 vehículos (cada uno con una situación distinta de alertas, estados y documentación),
//      12 choferes con licencias, asignaciones, ~80 mantenimientos con repuestos, siniestros,
//      herramientas y préstamos, documentos adjuntos (PDF/fotos), historial de km y auditoría.
// 3. Genera las alertas automáticas (las mismas que calcula el programa todos los días).
// Las fechas se calculan a partir de HOY, así que las alertas siempre se ven "frescas".
process.env.TZ = process.env.TZ || "America/Argentina/Buenos_Aires";
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { prepararBaseDeDatos, credenciales } = require("../src/model/database/preparar");
const { limpiarDatos } = require("../src/model/database/limpieza");
const { CLAVE_ADMIN, CLAVE_EMPLEADO } = require("../src/model/database/datosBase");
const { DIR_DOCUMENTOS } = require("../src/utils/documentos");
const { crearPdf } = require("./documentos-demo");

// ───────────────────────── utilidades ─────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const fecha = (dias) => {
  if (dias === null || dias === undefined) return null;
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fechaHora = (dias, hora = "08:30:00") => (dias === null || dias === undefined ? null : `${fecha(dias)} ${hora}`);
const ahora = () => fechaHora(0, new Date().toTimeString().slice(0, 8));

const IMG = path.join(__dirname, "../public/img");
const DIR_VEH = path.join(IMG, "vehiculos");
const DIR_LIC = path.join(IMG, "licencias");
const DIR_SIN = path.join(IMG, "siniestros");
[DIR_VEH, DIR_LIC, DIR_SIN, DIR_DOCUMENTOS].forEach((d) => fs.mkdirSync(d, { recursive: true }));

let contadorArchivo = 0;
// Nombres con el mismo formato que los subidos por el programa (así `npm run db:limpiar` también los borra)
const copiarImagen = (origen, dir, prefijo) => {
  const ext = path.extname(origen);
  const nombre = `${prefijo}-${Date.now()}${++contadorArchivo}${ext}`;
  fs.copyFileSync(origen, path.join(dir, nombre));
  return nombre;
};
const pdfPublico = (dir, prefijo, titulo, detalle) => {
  const nombre = `${prefijo}-${Date.now()}${++contadorArchivo}.pdf`;
  fs.writeFileSync(path.join(dir, nombre), crearPdf(titulo, detalle));
  return nombre;
};

// ───────────────────────── catálogos ─────────────────────────
const DISTRITOS = ["Capital", "Rawson", "Pocito", "Chimbas", "Rivadavia", "Caucete", "Albardón", "Santa Lucía"];
const SECTORES = ["Taller Central", "Riego", "Obras Hidráulicas", "Canales y Desagües", "Hidrometría", "Administración"];
const OPERARIOS = [
  ["Héctor Quiroga", "Activo"],
  ["Ramón Videla", "Activo"],
  ["Nicolás Castro", "Activo"],
  ["Sergio Olivera", "Activo"],
  ["Mariano Godoy", "Activo"],
  ["Fabián Peralta", "Activo"],
  ["Julio Aguilera", "Inactivo"],
  ["Esteban Navarro", "Activo"],
];

// [nombre, stock, stock_minimo, costo]
const REPUESTOS = [
  ["Aceite 15W40 x 4 L", 24, 6, 18500],
  ["Filtro de aceite", 12, 5, 9800],
  ["Filtro de aire", 3, 4, 14200], // stock bajo
  ["Filtro de combustible", 8, 4, 12600],
  ["Pastillas de freno delanteras (juego)", 0, 2, 38500], // sin stock
  ["Disco de freno", 4, 2, 52000],
  ["Kit de correa de distribución", 2, 2, 125000], // en el mínimo
  ["Batería 12V 75Ah", 5, 2, 145000],
  ["Neumático 245/70 R16", 10, 4, 189000],
  ["Lámpara H4", 20, 6, 4500],
  ["Líquido de frenos DOT4 x 1 L", 6, 3, 8900],
  ["Refrigerante x 5 L", 9, 3, 15600],
  ["Filtro hidráulico (maquinaria)", 1, 2, 67000], // stock bajo
  ["Kit de embrague", 1, 1, 310000], // en el mínimo
  ["Escobillas limpiaparabrisas (par)", 14, 4, 7800],
  ["Aceite hidráulico x 20 L", 7, 2, 96000],
];
const R = Object.fromEntries(REPUESTOS.map((r, i) => [r[0], i + 1]));

const PROVEEDORES = [
  "Lubricentro El Sauce",
  "Taller Mecánico Ruta 40",
  "Repuestos San Martín SRL",
  "Concesionario Oficial (servicio técnico)",
  "Neumáticos del Oeste",
  "Taller Central (propio)",
];

// ───────────────────────── vehículos ─────────────────────────
// svc: último service realizado (km/hs), intervalo y cantidad de services anteriores → define la alerta de mantenimiento.
// rto / seguro: días hasta el vencimiento (negativo = vencido). docs: documentación adjunta. fotos: cédula / título / seguro.
const VEHICULOS = [
  { patente: "AB123CD", marca: "Toyota", modelo: "Hilux 2.8 SRV 4x4", anio: 2021, tipo: "Camioneta", comb: "Diésel", trans: "Manual", km: 87650, svc: [80000, 10000, 5], rto: -15, seguro: 210, estado: "Disponible", distrito: "Capital", area: "Obras Hidráulicas", cia: "La Segunda", docs: ["comodato", "acta_afectacion", "acta_entrega"], fotos: [1, 1, 1], obs: "Unidad asignada a inspección de obras. RTO vencida: turno solicitado." },
  { patente: "AC456EF", marca: "Ford", modelo: "Ranger XLT 3.2", anio: 2020, tipo: "Camioneta", comb: "Diésel", trans: "Manual", km: 101200, svc: [92000, 10000, 6], rto: 140, seguro: 10, estado: "En uso", distrito: "Rawson", area: "Riego", cia: "Federación Patronal", docs: ["comodato", "acta_entrega"], fotos: [1, 1, 1], obs: "Seguro próximo a vencer, renovación en trámite." },
  { patente: "AD789GH", marca: "Mercedes-Benz", modelo: "Atego 1726", anio: 2018, tipo: "Camión", comb: "Diésel", trans: "Manual", km: 214300, svc: [200000, 10000, 6], rto: 120, seguro: 95, estado: "Disponible", distrito: "Pocito", area: "Canales y Desagües", cia: "Sancor Seguros", docs: ["acta_afectacion"], fotos: [1, 0, 1], obs: "Service de 210.000 km SUPERADO: programar ingreso al taller." },
  { patente: "AE012IJ", marca: "Volkswagen", modelo: "Amarok V6 Highline", anio: 2022, tipo: "Camioneta", comb: "Diésel", trans: "Automática", km: 45800, svc: [40000, 10000, 3], rto: 0, seguro: 25, estado: "En mantenimiento", enProceso: ["Reparación de frenos traseros", "Ruido en frenos traseros, se cambian pastillas y se rectifican discos."], distrito: "Chimbas", area: "Hidrometría", cia: "La Segunda", docs: ["comodato", "acta_afectacion", "acta_entrega", "otro"], fotos: [1, 1, 1], obs: "En taller por frenos. RTO vence hoy." },
  { patente: "AF345KL", marca: "Iveco", modelo: "Tector 170E28", anio: 2019, tipo: "Camión", comb: "Diésel", trans: "Manual", km: 178900, svc: [170000, 10000, 6], rto: 60, seguro: -5, estado: "En siniestro", distrito: "Pocito", area: "Canales y Desagües", cia: "Sancor Seguros", docs: ["acta_afectacion", "acta_entrega"], fotos: [1, 1, 0], obs: "Inmovilizado por siniestro en Ruta 40. Póliza vencida." },
  { patente: "MQ001RH", marca: "Caterpillar", modelo: "Retroexcavadora 416F", anio: 2017, tipo: "Maquinaria Pesada", comb: "Diésel", trans: "Hidrostática", km: 6380, svc: [6000, 250, 6], rto: null, seguro: 150, estado: "Disponible", distrito: "Caucete", area: "Canales y Desagües", cia: "Provincia Seguros", docs: ["acta_afectacion", "otro"], fotos: [1, 0, 1], obs: "Mide horas de uso. Service de 6.250 hs superado." },
  { patente: "GHI789", marca: "Renault", modelo: "Kangoo Authentique 1.6", anio: 2012, tipo: "Utilitario", comb: "Nafta", trans: "Manual", km: 256000, svc: [250000, 10000, 4], rto: -200, seguro: -180, estado: "Baja", baja: -150, distrito: "Capital", area: "Administración", cia: "Provincia Seguros", docs: ["acta_desafectacion", "acta_entrega"], fotos: [1, 1, 0], obs: "Dada de baja por fin de vida útil (motor fundido). Pendiente de remate." },
  { patente: "AG678MN", marca: "Fiat", modelo: "Strada Volcano 1.3", anio: 2023, tipo: "Utilitario", comb: "Nafta", trans: "Manual", km: 18500, svc: [10000, 10000, 1], programado: 20000, rto: 300, seguro: 280, estado: "En uso", distrito: "Rivadavia", area: "Riego", cia: "Federación Patronal", docs: ["comodato", "acta_entrega"], fotos: [1, 1, 1], obs: "Service de 20.000 km ya programado." },
  { patente: "AH901OP", marca: "Toyota", modelo: "Corolla XEI 2.0 CVT", anio: 2022, tipo: "Auto", comb: "Nafta", trans: "Automática", km: 62300, svc: [60000, 10000, 5], rto: 240, seguro: 200, estado: "Disponible", distrito: "Capital", area: "Administración", cia: "La Segunda", docs: ["comodato", "acta_afectacion", "acta_entrega", "otro"], fotos: [1, 1, 1], obs: "Unidad con toda la documentación al día (sin alertas).", finalizado: true },
  { patente: "PQR234", marca: "Chevrolet", modelo: "S10 LT 2.8 4x2", anio: 2019, tipo: "Camioneta", comb: "Diésel", trans: "Manual", km: 133400, svc: [130000, 10000, 6], rto: -40, seguro: -10, estado: "Disponible", distrito: "Santa Lucía", area: "Riego", cia: "Sancor Seguros", docs: [], fotos: [1, 0, 0], obs: "RTO y seguro vencidos: NO debe circular." },
  { patente: "A123BCD", marca: "Honda", modelo: "XR 150L", anio: 2021, tipo: "Motocicleta", comb: "Nafta", trans: "Manual", km: 21300, svc: [18000, 3000, 5], rto: 15, seguro: 180, estado: "En uso", distrito: "Albardón", area: "Hidrometría", cia: "Rivadavia Seguros", docs: ["acta_entrega"], fotos: [1, 1, 1], obs: "Moto para lectura de escalas hidrométricas." },
  { patente: "MQ002JD", marca: "John Deere", modelo: "Tractor 5075E", anio: 2020, tipo: "Maquinaria Pesada", comb: "Diésel", trans: "Manual", km: 3120, svc: [3000, 250, 6], programado: 3250, rto: null, seguro: 20, estado: "Disponible", distrito: "Caucete", area: "Canales y Desagües", cia: "Provincia Seguros", docs: ["acta_afectacion"], fotos: [0, 0, 1], obs: "Desmalezado de canales. Faltan pocas horas para el service." },
  { patente: "AI234QR", marca: "Ford", modelo: "Transit 2.2 TDCi Furgón", anio: 2020, tipo: "Utilitario", comb: "Diésel", trans: "Manual", km: 97800, svc: [90000, 10000, 6], rto: 45, seguro: 7, estado: "En mantenimiento", enProceso: ["Cambio de embrague", "Patina el embrague en pendiente. Se reemplaza kit completo."], distrito: "Rawson", area: "Taller Central", cia: "Federación Patronal", docs: ["comodato", "acta_afectacion"], fotos: [1, 1, 1], obs: "En taller (embrague). Seguro vence en una semana." },
  { patente: "AJ567ST", marca: "Peugeot", modelo: "208 Allure 1.6", anio: 2024, tipo: "Auto", comb: "Nafta", trans: "Manual", km: 12400, svc: [10000, 10000, 1], rto: 700, seguro: 340, estado: "Disponible", distrito: "Capital", area: "Administración", cia: "La Segunda", docs: [], fotos: [0, 0, 0], obs: "Alta reciente: falta cargar la documentación." },
  { patente: "AK890UV", marca: "Mercedes-Benz", modelo: "Sprinter 415 CDI", anio: 2021, tipo: "Utilitario", comb: "Diésel", trans: "Manual", km: 76500, svc: [70000, 10000, 6], rto: 5, seguro: 12, estado: "En uso", distrito: "Chimbas", area: "Obras Hidráulicas", cia: "Sancor Seguros", docs: ["comodato", "acta_afectacion", "acta_entrega"], fotos: [1, 1, 1], obs: "Traslado de cuadrillas. RTO por vencer: sacar turno." },
];

// ───────────────────────── choferes ─────────────────────────
// lic: días hasta el vencimiento de la licencia vigente. previa: tuvo una licencia anterior (historial).
const CHOFERES = [
  { nombre: "Carlos", apellido: "Rodríguez", dni: "28456123", lic: 400, cat: "D", estado: "Activo", turno: "Mañana", carnet: true, previa: true },
  { nombre: "María", apellido: "González", dni: "31789456", lic: -20, cat: "B1", estado: "Activo", turno: "Mañana", carnet: false },
  { nombre: "Jorge", apellido: "Fernández", dni: "25123789", lic: 12, cat: "E", estado: "Activo", turno: "Tarde", carnet: true },
  { nombre: "Laura", apellido: "Martínez", dni: "33456789", lic: 0, cat: "B1", estado: "Activo", turno: "Mañana", carnet: false },
  { nombre: "Diego", apellido: "López", dni: "29876543", lic: 700, cat: "C", estado: "Activo", turno: "Rotativo", carnet: true },
  { nombre: "Ana", apellido: "Pérez", dni: "35234567", lic: 25, cat: "B1", estado: "Licencia Vacaciones/Medica", turno: "Tarde", carnet: false },
  { nombre: "Ricardo", apellido: "Sánchez", dni: "22345678", lic: -3, cat: "E", estado: "Activo", turno: "Mañana", carnet: true, previa: true },
  { nombre: "Sofía", apellido: "Romero", dni: "36789012", lic: 300, cat: "D", estado: "Activo", turno: "Tarde", carnet: true },
  { nombre: "Martín", apellido: "Díaz", dni: "27654321", lic: -100, cat: "B1", estado: "Inactivo", turno: "Mañana", carnet: false, motivo: "Renuncia voluntaria" },
  { nombre: "Lucía", apellido: "Torres", dni: "34567123", lic: 180, cat: "A", estado: "Activo", turno: "Mañana", carnet: true },
  { nombre: "Pablo", apellido: "Álvarez", dni: "30123456", lic: 5, cat: "G", estado: "Activo", turno: "Rotativo", carnet: true },
  { nombre: "Gabriela", apellido: "Ruiz", dni: "32987654", lic: 900, cat: "B1", estado: "Activo", turno: "Tarde", carnet: false },
];

// ───────────────────────── herramientas ─────────────────────────
const HERRAMIENTAS = [
  ["HR-001", "Motoguadaña Stihl FS 280", "Canales y Desagües", "Nafta"],
  ["HR-002", "Motosierra Husqvarna 445", "Canales y Desagües", "Nafta"],
  ["HR-003", "Generador Honda 5 kVA", "Obras Hidráulicas", "Nafta"],
  ["HR-004", "Motobomba 3\" Honda WB30", "Riego", "Nafta"],
  ["HR-005", "Amoladora Bosch 9\"", "Taller Central", "Eléctrica"],
  ["HR-006", "Taladro percutor Makita", "Taller Central", "Eléctrica"],
  ["HR-007", "Soldadora inverter 200A", "Taller Central", "Eléctrica"],
  ["HR-008", "Hidrolavadora Kärcher HD 6/15", "Taller Central", "Eléctrica"],
  ["HR-009", "Molinete hidrométrico OTT C31", "Hidrometría", "Manual"],
  ["HR-010", "Compactador vibratorio (pisón)", "Obras Hidráulicas", "Nafta"],
  ["HR-011", "Juego de llaves tubo 1/2\"", "Taller Central", "Manual"],
  ["HR-012", "Nivel óptico automático", "Obras Hidráulicas", "Manual"],
];

const SERVICIOS_CORRECTIVOS = [
  ["Cambio de pastillas de freno", [["Pastillas de freno delanteras (juego)", 1], ["Líquido de frenos DOT4 x 1 L", 1]], 45000],
  ["Alineación y balanceo", [], 28000],
  ["Cambio de neumáticos", [["Neumático 245/70 R16", 2]], 35000],
  ["Reemplazo de batería", [["Batería 12V 75Ah", 1]], 12000],
  ["Reparación de sistema eléctrico", [["Lámpara H4", 2]], 55000],
  ["Cambio de discos y pastillas", [["Disco de freno", 2], ["Pastillas de freno delanteras (juego)", 1]], 68000],
  ["Cambio de escobillas y lámparas", [["Escobillas limpiaparabrisas (par)", 1], ["Lámpara H4", 2]], 9000],
  ["Cambio de refrigerante", [["Refrigerante x 5 L", 2]], 22000],
];

(async () => {
  console.log("");
  console.log("  Instalando Ficha Técnica con DATOS DE EJEMPLO...");
  await prepararBaseDeDatos();
  await limpiarDatos({ catalogos: true });

  const c = await mysql.createConnection({ ...credenciales(), multipleStatements: true });
  const ins = async (tabla, datos) => {
    const cols = Object.keys(datos);
    const [r] = await c.query(`INSERT INTO \`${tabla}\` (${cols.map((k) => "`" + k + "`").join(",")}) VALUES (${cols.map(() => "?").join(",")})`, cols.map((k) => datos[k]));
    return r.insertId;
  };

  try {
    // ── Usuarios: admin y empleado (contraseñas iniciales) + dos de ejemplo
    await c.query("UPDATE usuario SET contrasena=?, activo=1 WHERE nombre_usuario='admin'", [bcrypt.hashSync(process.env.ADMIN_PASSWORD || CLAVE_ADMIN, 10)]);
    await c.query("UPDATE usuario SET contrasena=?, activo=1 WHERE nombre_usuario='empleado'", [bcrypt.hashSync(process.env.EMPLEADO_PASSWORD || CLAVE_EMPLEADO, 10)]);
    const hashEj = bcrypt.hashSync(CLAVE_EMPLEADO, 10);
    for (const [u, n, a, rol] of [
      ["taller_jefe", "Roberto", "Ocampo", "Jefe de Taller"],
      ["supervisor", "Silvia", "Montaño", "Supervisor"],
    ]) {
      const [[r]] = await c.query("SELECT id_rol FROM rol WHERE nombre=?", [rol]);
      if (!r) continue;
      await c.query("INSERT IGNORE INTO usuario (nombre_usuario, contrasena, nombre, apellido, activo, id_rol, permisos) VALUES (?,?,?,?,1,?,NULL)", [u, hashEj, n, a, r.id_rol]);
    }
    const [usuarios] = await c.query("SELECT id_usuario, nombre_usuario FROM usuario");
    const U = Object.fromEntries(usuarios.map((u) => [u.nombre_usuario, u.id_usuario]));
    const idAdmin = U.admin;
    const idTaller = U.taller_jefe || idAdmin;

    // ── Catálogos
    for (const d of DISTRITOS) await ins("distritos", { nombre: d });
    for (const s of SECTORES) await ins("sectores", { nombre: s });
    for (const [nombre, estado] of OPERARIOS) await ins("operarios", { nombre, estado });
    const [tipos] = await c.query("SELECT id_tipo, descripcion FROM tipo_vehiculo");
    const T = Object.fromEntries(tipos.map((t) => [t.descripcion, t.id_tipo]));
    for (const [nombre, stock, stock_minimo, costo_unitario] of REPUESTOS) await ins("repuestos", { nombre, stock, stock_minimo, costo_unitario });

    // ── Documentos adjuntos
    let docs = 0;
    const adjuntar = async (entidad, id, categoria, titulo, detalle, imagenOrigen = null) => {
      let archivo;
      if (imagenOrigen) {
        archivo = `demo-${entidad}-${id}-${categoria}-${++contadorArchivo}${path.extname(imagenOrigen)}`;
        fs.copyFileSync(imagenOrigen, path.join(DIR_DOCUMENTOS, archivo));
      } else {
        archivo = `demo-${entidad}-${id}-${categoria}-${++contadorArchivo}.pdf`;
        fs.writeFileSync(path.join(DIR_DOCUMENTOS, archivo), crearPdf(titulo, detalle));
      }
      await ins("documento_adjunto", { entidad, id_entidad: id, categoria, archivo, nombre_original: `${titulo}${path.extname(archivo)}`, id_usuario: idAdmin, createdAt: ahora(), updatedAt: ahora() });
      docs++;
    };
    const NOMBRE_CAT = { comodato: "Comodato", acta_afectacion: "Acta de afectación", acta_entrega: "Acta de entrega", acta_desafectacion: "Acta de desafectación temporal", otro: "Informe técnico" };

    // ── Choferes y licencias
    const idsChofer = [];
    for (const [i, ch] of CHOFERES.entries()) {
      const id = await ins("chofer", {
        nombre: ch.nombre,
        apellido: ch.apellido,
        dni: ch.dni,
        telefono: `264${5100000 + i * 13791}`,
        direccion: `${["Av. Libertador", "Calle Mendoza", "Av. Rioja", "Calle Tucumán", "Av. Ignacio de la Roza", "Calle Entre Ríos"][i % 6]} ${200 + i * 137} (O), ${DISTRITOS[i % DISTRITOS.length]}`,
        estado: ch.estado,
        fechaNacimiento: fecha(-365 * (28 + (i * 3) % 25) - i * 40),
        fechaIngreso: fecha(-365 * (1 + (i % 9)) - i * 20),
        email: `${ch.nombre}.${ch.apellido}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() + "@hidricos.gob.ar",
        turno: ch.turno,
        createdAt: ahora(),
        updatedAt: ahora(),
        imagen: i % 4 === 3 ? null : copiarImagen(path.join(DIR_LIC, "chofer.jpg"), DIR_LIC, "chofer"),
        motivoBaja: ch.motivo || null,
        tiene_carnet_oficial: ch.carnet ? 1 : 0,
      });
      idsChofer.push(id);
      if (ch.previa) {
        await ins("licencia_chofer", { id_chofer: id, numero: `L-${ch.dni}-A`, categoria: ch.cat, fecha_emision: fecha(ch.lic - 365 * 10), fecha_vencimiento: fecha(ch.lic - 365 * 5), imagen: null });
      }
      await ins("licencia_chofer", {
        id_chofer: id,
        numero: `L-${ch.dni}`,
        categoria: ch.cat,
        fecha_emision: fecha(ch.lic - 365 * 5),
        fecha_vencimiento: fecha(ch.lic),
        imagen: i % 3 === 2 ? null : copiarImagen(path.join(DIR_LIC, "licencia.jpg"), DIR_LIC, "chofer"),
      });
      const nombre = `${ch.nombre} ${ch.apellido}`;
      if (i % 5 !== 4) {
        await adjuntar("chofer", id, "dni", `DNI ${nombre} (frente)`, `DNI ${ch.dni}`, path.join(DIR_LIC, "dni.jpg"));
        if (i % 2 === 0) await adjuntar("chofer", id, "dni", `DNI ${nombre} (dorso)`, `DNI ${ch.dni}`);
      }
      if (ch.carnet) await adjuntar("chofer", id, "carnet_provincia", `Carnet oficial ${nombre}`, `Carnet de conductor oficial de la provincia - DNI ${ch.dni}`);
    }

    // ── Vehículos, historial de km y mantenimientos
    let nMant = 0;
    let nroComprobante = 1520;
    const idsVehiculo = [];
    for (const [i, v] of VEHICULOS.entries()) {
      const unidad = v.tipo === "Maquinaria Pesada" ? "hs" : "km";
      const [ultimo, intervalo, cantidad] = v.svc;
      const diasAlta = -365 * Math.max(1, Math.min(6, 2026 - v.anio)) - 30;
      const id = await ins("vehiculo", {
        patente: v.patente,
        legajo: `RH-${String(101 + i).padStart(4, "0")}`,
        marca: v.marca,
        modelo: v.modelo,
        anio: v.anio,
        id_tipo: T[v.tipo],
        num_chasis: `8A${v.marca.slice(0, 2).toUpperCase()}${v.anio}${String(483920 + i * 7351)}`,
        num_motor: `MT${String(9100000 + i * 48271)}`,
        combustible: v.comb,
        transmision: v.trans,
        km_actual: v.km,
        cedula_numero: `CED-${String(30456700 + i * 1117)}`,
        cedula_titular: "Departamento de Hidráulica - Gobierno de San Juan",
        seguro_compania: v.cia,
        seguro_vencimiento: fecha(v.seguro),
        rto_vencimiento: fecha(v.rto),
        estado_actual: v.estado,
        distrito: v.distrito,
        area: v.area,
        observaciones: v.obs,
        imagen_url: null,
        fecha_alta: fecha(diasAlta),
        fecha_baja: v.baja ? fecha(v.baja) : null,
        foto_cedula: v.fotos[0] ? copiarImagen(path.join(DIR_VEH, "cedula.jpg"), DIR_VEH, "vehiculo") : null,
        foto_titulo: v.fotos[1] ? copiarImagen(path.join(DIR_VEH, "cedula.jpg"), DIR_VEH, "vehiculo") : null,
        foto_rto: v.fotos[2] ? copiarImagen(path.join(DIR_VEH, "seguro.png"), DIR_VEH, "vehiculo") : null,
      });
      idsVehiculo.push(id);
      for (const cat of v.docs) await adjuntar("vehiculo", id, cat, `${NOMBRE_CAT[cat]} ${v.patente}`, `${v.marca} ${v.modelo} - Legajo RH-${String(101 + i).padStart(4, "0")}`);

      // Services periódicos (el último realizado define el "próximo service") con correctivos intercalados
      const diasUltimo = v.baja ? v.baja - 60 : -(20 + ((i * 17) % 90));
      // días entre services según el uso promedio del vehículo (km u horas por día desde el alta)
      const espacio = Math.max(45, Math.min(240, Math.round((intervalo * -diasAlta) / v.km)));
      const hitos = [];
      for (let k = cantidad - 1; k >= 0; k--) {
        const kmServ = ultimo - k * intervalo;
        if (kmServ <= 0) continue;
        hitos.push({ km: kmServ, dias: diasUltimo - k * espacio });
      }
      let kmPrevio = 0;
      let diasPrevio = diasAlta;
      for (const [h, hito] of hitos.entries()) {
        const prov = PROVEEDORES[(i + h) % PROVEEDORES.length];
        // correctivo a mitad de camino (no en todos los tramos)
        if (h > 0 && (i + h) % 2 === 0) {
          const [tipoSrv, lineas, mo] = SERVICIOS_CORRECTIVOS[(i + h) % SERVICIOS_CORRECTIVOS.length];
          const kmC = Math.round((kmPrevio + hito.km) / 2);
          const diasC = Math.round((diasPrevio + hito.dias) / 2);
          await cargarMantenimiento({ id, tipo: tipoSrv, dias: diasC, km: kmC, lineas, mo, prov, estado: "Realizado", desc: `${tipoSrv} solicitado por el chofer.`, proximo: null });
        }
        const lineas =
          unidad === "hs"
            ? [["Aceite hidráulico x 20 L", 1], ["Filtro hidráulico (maquinaria)", 1], ["Filtro de combustible", 1], ["Filtro de aire", 1]]
            : [["Aceite 15W40 x 4 L", v.tipo === "Camión" ? 4 : v.tipo === "Motocicleta" ? 1 : 2], ["Filtro de aceite", 1], ...(h % 2 ? [["Filtro de aire", 1]] : []), ...(h % 3 === 2 ? [["Filtro de combustible", 1]] : [])];
        const esDistribucion = unidad === "km" && hito.km % 60000 === 0 && v.tipo !== "Motocicleta";
        if (esDistribucion) lineas.push(["Kit de correa de distribución", 1]);
        await cargarMantenimiento({
          id,
          tipo: esDistribucion ? `Service ${hito.km.toLocaleString("es-AR")} ${unidad} + correa de distribución` : `Service ${hito.km.toLocaleString("es-AR")} ${unidad}`,
          dias: hito.dias,
          km: hito.km,
          lineas,
          mo: unidad === "hs" ? 85000 : v.tipo === "Camión" ? 70000 : v.tipo === "Motocicleta" ? 15000 : 38000,
          prov,
          estado: "Realizado",
          desc: unidad === "hs" ? "Service preventivo: aceite hidráulico, filtros y engrase general." : "Service preventivo: cambio de aceite y filtros, control de niveles y frenos.",
          proximo: hito.km + intervalo,
          proximaFecha: hito.dias + 180,
        });
        await ins("historial_km", { id_vehiculo: id, km_anterior: kmPrevio, km_nuevo: hito.km, fecha: fecha(hito.dias), observaciones: `Actualización en service de ${hito.km} ${unidad}` });
        kmPrevio = hito.km;
        diasPrevio = hito.dias;
      }
      // lecturas posteriores hasta el km actual
      const fin = v.baja || -1;
      const pasos = 3;
      for (let p = 1; p <= pasos; p++) {
        const kmN = Math.round(kmPrevio + ((v.km - kmPrevio) * p) / pasos);
        const diasN = Math.round(diasPrevio + ((fin - diasPrevio) * p) / pasos);
        if (kmN <= kmPrevio && p < pasos) continue;
        await ins("historial_km", { id_vehiculo: id, km_anterior: Math.round(kmPrevio + ((v.km - kmPrevio) * (p - 1)) / pasos), km_nuevo: kmN, fecha: fecha(diasN), observaciones: p === pasos ? "Lectura de tablero" : "Control semanal" });
      }

      if (v.programado) {
        await cargarMantenimiento({ id, tipo: `Service ${v.programado.toLocaleString("es-AR")} ${unidad} (programado)`, dias: 10, km: v.km, lineas: [], mo: 0, prov: PROVEEDORES[0], estado: "Programado", desc: "Turno reservado en el taller.", proximo: v.programado, proximaFecha: 20 });
      }
      if (v.enProceso) {
        const [tipoSrv, desc] = v.enProceso;
        const lineas = tipoSrv.includes("embrague") ? [["Kit de embrague", 1]] : [["Pastillas de freno delanteras (juego)", 1], ["Disco de freno", 2], ["Líquido de frenos DOT4 x 1 L", 1]];
        await cargarMantenimiento({ id, tipo: tipoSrv, dias: -3, km: v.km, lineas, mo: 95000, prov: "Taller Central (propio)", estado: "En proceso", desc, proximo: null });
      }
      if (i % 5 === 1) {
        await cargarMantenimiento({ id, tipo: "Revisión de tren delantero", dias: -(diasUltimo * -1 + 15), km: ultimo - 500, lineas: [], mo: 0, prov: PROVEEDORES[1], estado: "Cancelado", desc: "Cancelado: el vehículo se derivó a otra repartición ese día.", proximo: null });
      }
    }

    async function cargarMantenimiento({ id, tipo, dias, km, lineas, mo, prov, estado, desc, proximo, proximaFecha = null }) {
      const costoRep = lineas.reduce((s, [nombre, cant]) => s + REPUESTOS[R[nombre] - 1][3] * cant, 0);
      const realizado = estado === "Realizado";
      const nro = ++nroComprobante;
      const idM = await ins("mantenimiento", {
        id_vehiculo: id,
        id_usuario: nMant % 3 === 0 ? idAdmin : idTaller,
        tipo_servicio: tipo,
        fecha_inicio: fecha(dias),
        fecha_fin: realizado ? fecha(dias + (nMant % 3)) : null,
        km_servicio: km,
        costo_total: estado === "Programado" || estado === "Cancelado" ? 0 : costoRep + mo,
        descripcion: desc,
        observaciones: realizado && nMant % 4 === 0 ? "Se recomienda revisar tren delantero en el próximo ingreso." : null,
        proximo_km: proximo,
        proxima_fecha: proximaFecha !== null ? fecha(proximaFecha) : null,
        estado,
        mano_obra: estado === "Programado" || estado === "Cancelado" ? 0 : mo,
        costo_repuestos: estado === "Programado" || estado === "Cancelado" ? 0 : costoRep,
        nro_remito: realizado ? `R-0002-${String(nro).padStart(8, "0")}` : null,
        nro_factura: realizado && prov !== "Taller Central (propio)" ? `A-0005-${String(nro * 3).padStart(8, "0")}` : null,
        proveedor: prov,
        nro_pedido: realizado || estado === "En proceso" ? `PED-${2025 + (dias > -300 ? 1 : 0)}-${String(nro).slice(-3)}` : null,
        nro_expediente: realizado && costoRep + mo > 150000 ? `EXP-${1200 + nro}/2026` : null,
      });
      if (estado !== "Programado" && estado !== "Cancelado") {
        for (const [nombre, cant] of lineas) await ins("detalle_mantenimiento", { id_mantenimiento: idM, id_repuesto: R[nombre], cantidad: cant, costo_unitario: REPUESTOS[R[nombre] - 1][3] });
      }
      nMant++;
      return idM;
    }

    const V = (patente) => idsVehiculo[VEHICULOS.findIndex((v) => v.patente === patente)];
    const CH = (n) => idsChofer[n - 1];

    // ── Asignaciones: activas (vehículos "En uso") + historial de devoluciones
    const activas = [
      ["AC456EF", 1, -4, "Riego - Canal del Norte", "Recorrida de compuertas"],
      ["AG678MN", 5, -1, "Riego - Rivadavia", "Inspección de turnos de riego"],
      ["A123BCD", 10, -2, "Hidrometría - Río San Juan", "Lectura de escalas"],
      ["AK890UV", 8, 0, "Obras Hidráulicas - Dique Punta Negra", "Traslado de cuadrilla"],
    ];
    for (const [pat, ch, dias, destino, obs] of activas) {
      await ins("asignacion_vehiculo", { id_vehiculo: V(pat), id_chofer: CH(ch), fecha_salida: fechaHora(dias, "07:30:00"), fecha_estimada_devolucion: null, fecha_devolucion: null, destino_area: destino, observaciones: obs, estado: "Activo" });
    }
    const historicas = [
      ["AB123CD", 2, -40, 3], ["AB123CD", 1, -25, 1], ["AD789GH", 3, -60, 5], ["AD789GH", 11, -18, 2],
      ["AH901OP", 12, -12, 1], ["AH901OP", 4, -70, 2], ["PQR234", 7, -90, 4], ["MQ001RH", 11, -33, 6],
      ["MQ002JD", 11, -15, 3], ["AF345KL", 3, -20, 13], ["AE012IJ", 6, -45, 2], ["AI234QR", 5, -28, 7],
      ["AJ567ST", 12, -8, 1], ["GHI789", 9, -220, 10], ["AK890UV", 8, -14, 3], ["AC456EF", 1, -30, 2],
    ];
    for (const [pat, ch, dias, duracion] of historicas) {
      await ins("asignacion_vehiculo", { id_vehiculo: V(pat), id_chofer: CH(ch), fecha_salida: fechaHora(dias, "07:00:00"), fecha_estimada_devolucion: null, fecha_devolucion: fechaHora(dias + duracion, "17:30:00"), destino_area: SECTORES[(dias * -1) % SECTORES.length], observaciones: "Devuelto sin novedades", estado: "Finalizado" });
    }

    // ── Siniestros
    const denuncia = (titulo) => pdfPublico(DIR_SIN, "siniestro", titulo, "Copia de denuncia / informe del siniestro");
    const foto = () => copiarImagen(path.join(DIR_VEH, "seguro.png"), DIR_SIN, "siniestro");
    const SINIESTROS = [
      { pat: "AF345KL", ch: 3, dias: -6, ubic: "Ruta Nacional 40 km 3210, Pocito", estado: "EN PROCESO", relato: "Al ingresar a la colectora, un automóvil se cruzó de carril e impactó el lateral derecho del camión.", danos: "Puerta derecha, guardabarros y espejo destruidos. Eje delantero a revisar.", tercero: ["Renault Sandero AB987CD", "Mercantil Andina", "Luis Herrera", "264-4123456"], archivos: [denuncia("Denuncia policial AF345KL"), foto(), foto()] },
      { pat: "AD789GH", ch: 11, dias: -2, ubic: "Av. Circunvalación y Av. España, Capital", estado: "RESUELTO", relato: "Roce con un poste de alumbrado al maniobrar en la colectora.", danos: "Paragolpes trasero abollado, faro trasero izquierdo roto.", tercero: [null, null, null, null], archivos: [foto()] },
      { pat: "AB123CD", ch: 2, dias: -120, ubic: "Calle 5 y Mendoza, Pocito", estado: "RESUELTO", relato: "Choque leve en intersección, el tercero no respetó la prioridad de paso.", danos: "Paragolpes delantero y óptica izquierda.", tercero: ["VW Gol Trend AA321BC", "La Caja", "Marcela Ortiz", "264-5987412"], archivos: [denuncia("Denuncia AB123CD"), foto()] },
      { pat: "PQR234", ch: 7, dias: -260, ubic: "Ruta Provincial 20, Santa Lucía", estado: "CERRADO", relato: "Despiste por ripio suelto en curva, sin lesionados.", danos: "Llanta y neumático delantero derecho, tren delantero desalineado.", tercero: [null, null, null, null], archivos: [] },
      { pat: "GHI789", ch: 9, dias: -400, ubic: "Av. Rawson 1200, Capital", estado: "CERRADO", relato: "Fue chocado estando estacionado frente a la repartición.", danos: "Puerta trasera izquierda.", tercero: ["Fiat Cronos AE111FF", "Sancor Seguros", "Desconocido", null], archivos: [denuncia("Denuncia GHI789")] },
    ];
    for (const s of SINIESTROS) {
      const chofer = CHOFERES[s.ch - 1];
      await ins("siniestro", {
        id_vehiculo: V(s.pat),
        id_chofer: CH(s.ch),
        chofer_involucrado: `${chofer.nombre} ${chofer.apellido}`,
        fecha_siniestro: fecha(s.dias),
        ubicacion: s.ubic,
        relato: s.relato,
        danos_vehiculo: s.danos,
        tercero_vehiculo: s.tercero[0],
        tercero_seguro: s.tercero[1],
        tercero_conductor: s.tercero[2],
        tercero_contacto: s.tercero[3],
        estado: s.estado,
        archivos_adjuntos: s.archivos.join(",") || null,
        createdAt: fechaHora(s.dias, "15:20:00"),
        updatedAt: fechaHora(Math.min(0, s.dias + 30), "10:00:00"),
      });
    }

    // ── Herramientas y préstamos
    const idsHerr = [];
    for (const [i, [codigo, nombre, sector, energia]] of HERRAMIENTAS.entries()) {
      const estado = i === 7 ? "En Reparación" : i === 11 ? "Baja" : [0, 2, 3, 8].includes(i) ? "En uso" : "Disponible";
      idsHerr.push(await ins("herramienta", { codigo_activo: codigo, nombre, sector, estado, stock: i === 10 ? 3 : 1, combustible_energia: energia, observaciones: i === 7 ? "Pierde presión, enviada a service." : i === 11 ? "Lente dañado, dado de baja." : null, imagen_url: null, fecha_alta: fechaHora(-300 - i * 25) }));
    }
    const PRESTAMOS = [
      [0, "Héctor Quiroga", -12, -5, null, "Canales y Desagües", "Activo"], // vencido
      [2, "Ramón Videla", -20, -3, null, "Obras Hidráulicas", "Activo"], // vencido
      [3, "Nicolás Castro", -2, 5, null, "Riego", "Activo"],
      [8, "Sergio Olivera", -1, 6, null, "Hidrometría", "Activo"],
      [1, "Mariano Godoy", -30, -25, -26, "Canales y Desagües", "Finalizado"],
      [4, "Fabián Peralta", -15, -14, -14, "Taller Central", "Finalizado"],
      [5, "Esteban Navarro", -9, -8, -7, "Taller Central", "Finalizado"],
      [6, "Héctor Quiroga", -45, -40, -38, "Taller Central", "Finalizado"],
      [9, "Ramón Videla", -60, -50, -52, "Obras Hidráulicas", "Finalizado"],
      [0, "Mariano Godoy", -70, -65, -66, "Canales y Desagües", "Finalizado"],
    ];
    for (const [h, op, salida, estim, real, sector, est] of PRESTAMOS) {
      await ins("prestamo", { id_herramienta: idsHerr[h], nombre_operario: op, fecha_salida: fechaHora(salida), fecha_devolucion_estimada: fechaHora(estim, "18:00:00"), fecha_devolucion_real: real === null ? null : fechaHora(real, "16:45:00"), sector_destino: sector, observaciones: est === "Finalizado" ? "Devuelta en buen estado" : null, estado_prestamo: est });
    }

    // ── Auditoría de ejemplo
    const AUD = [
      [idAdmin, "usuario", null, "LOGIN", "Inicio de sesión", -10],
      [idAdmin, "vehiculo", V("AJ567ST"), "CREAR", "Alta del vehículo AJ567ST", -9],
      [idAdmin, "chofer", CH(12), "EDITAR", "Actualización de datos de contacto", -8],
      [idTaller, "mantenimiento", null, "CREAR", "Orden de service para AE012IJ", -3],
      [idTaller, "mantenimiento", null, "CREAR", "Orden de cambio de embrague AI234QR", -3],
      [idAdmin, "asignacion_vehiculo", null, "CREAR", "Asignación AK890UV a Sofía Romero", 0],
      [idAdmin, "siniestro", null, "CREAR", "Alta de siniestro AF345KL", -6],
      [idAdmin, "siniestro", null, "CREAR", "Alta de siniestro AD789GH", -2],
      [idAdmin, "vehiculo", V("GHI789"), "EDITAR_ESTADO", "Baja del vehículo GHI789", -150],
      [idAdmin, "chofer", CH(9), "EDITAR_ESTADO", "Chofer Martín Díaz pasa a Inactivo", -100],
      [idTaller, "repuestos", R["Kit de embrague"], "EDITAR", "Ajuste de stock", -5],
      [idAdmin, "herramienta", idsHerr[11], "ELIMINAR", "Baja de herramienta HR-012", -30],
      [null, "usuario", null, "LOGIN_FALLIDO", "Intento de ingreso con usuario inexistente: 'administrador'", -1],
      [idAdmin, "usuario", null, "LOGIN", "Inicio de sesión", 0],
    ];
    for (const [usr, tabla, idReg, accion, descripcion, dias] of AUD) {
      await ins("auditoria", { id_usuario: usr, tabla_afectada: tabla, id_registro_afectado: idReg, accion, fecha: fecha(dias), hora: `${pad(8 + (Math.abs(dias) % 9))}:${pad((Math.abs(dias) * 7) % 60)}:00`, valor_anterior: null, valor_nuevo: null, descripcion });
    }

    // ── Alertas manuales (las automáticas las calcula el programa más abajo)
    const alerta = (tipo, prioridad, mensaje, entidad_tipo, entidad_id, entidad_nombre, leida = 0, dias = 0) =>
      ins("alerta", { tipo, prioridad, mensaje, entidad_tipo, entidad_id, entidad_nombre, leida, generada_automaticamente: 0, createdAt: fechaHora(dias, "09:00:00"), updatedAt: fechaHora(dias, "09:00:00") });
    const nombreV = (pat) => {
      const v = VEHICULOS.find((x) => x.patente === pat);
      return `${v.marca} ${v.modelo} (${v.patente})`;
    };
    await alerta("vehiculo_en_mantenimiento", "media", "Vehículo en taller: reparación de frenos traseros", "Vehiculo", V("AE012IJ"), nombreV("AE012IJ"), 0, -3);
    await alerta("vehiculo_en_mantenimiento", "media", "Vehículo en taller: cambio de embrague", "Vehiculo", V("AI234QR"), nombreV("AI234QR"), 0, -3);
    await alerta("vehiculo_fuera_servicio", "alta", "Vehículo fuera de servicio por siniestro", "Vehiculo", V("AF345KL"), nombreV("AF345KL"), 0, -6);
    await alerta("vehiculo_fuera_servicio", "baja", "Vehículo dado de baja definitiva", "Vehiculo", V("GHI789"), nombreV("GHI789"), 1, -150);
    await alerta("mantenimiento_finalizado", "baja", "Service finalizado y vehículo disponible", "Vehiculo", V("AH901OP"), nombreV("AH901OP"), 0, -1);
    await alerta("mantenimiento_pendiente", "media", "Service de 3.250 hs programado: confirmar turno", "Vehiculo", V("MQ002JD"), nombreV("MQ002JD"), 0, -1);
    await alerta("herramienta_devuelta", "baja", "Herramienta devuelta: Taladro percutor Makita (Esteban Navarro)", "Herramienta", idsHerr[5], "Taladro percutor Makita (HR-006)", 1, -7);
    await alerta("critica", "alta", "RTO y seguro vencidos: el vehículo no puede salir a la calle", "Vehiculo", V("PQR234"), nombreV("PQR234"), 0, 0);
    await alerta("informativa", "baja", "Recordatorio: vence el convenio de comodato de 4 unidades a fin de mes", null, null, null, 0, -2);
    await alerta("informativa", "baja", "Se actualizaron los precios de repuestos del proveedor", null, null, null, 1, -20);
  } finally {
    await c.end();
  }

  // ── Alertas automáticas (licencias, RTO/seguro, services, préstamos, stock, siniestros)
  const db = require("../src/model/database/models");
  const alertaService = require("../src/data/alertaService");
  await alertaService.generarTodas();
  const [[resumen]] = await db.sequelize.query(
    "SELECT (SELECT COUNT(*) FROM vehiculo) vehiculos, (SELECT COUNT(*) FROM chofer) choferes, (SELECT COUNT(*) FROM mantenimiento) mantenimientos, (SELECT COUNT(*) FROM alerta) alertas, (SELECT COUNT(*) FROM documento_adjunto) documentos, (SELECT COUNT(*) FROM siniestro) siniestros, (SELECT COUNT(*) FROM herramienta) herramientas, (SELECT COUNT(*) FROM repuestos) repuestos",
  );
  await db.sequelize.close();

  console.log("");
  console.log("  ✅ Base cargada con datos de ejemplo:");
  for (const [k, n] of Object.entries(resumen)) console.log(`     · ${String(n).padStart(3)} ${k}`);
  console.log("");
  console.log("  Usuarios:  admin / administrador154   ·   empleado / empleado123");
  console.log("             taller_jefe / empleado123  ·   supervisor / empleado123");
  console.log("  Iniciá el programa con:  npm start");
  console.log("");
})().catch((e) => {
  console.error("");
  console.error("  [ERROR] No se pudieron cargar los datos de ejemplo: " + e.message);
  console.error("  Verificá que MySQL esté encendido y que los datos DB_* del archivo .env sean correctos.");
  console.error("");
  process.exit(1);
});
