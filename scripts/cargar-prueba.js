// Deja el sistema con datos de PRUEBA completos y coherentes: ajustes base, 10 choferes y 10 vehículos con toda su
// historia (asignaciones, kilometraje, mantenimientos, siniestros, renovación de seguro/RTO), herramientas con préstamos
// y las alertas que corresponden.
//   npm run db:prueba -- --confirmar
//
// Cómo se generan (para que no haya inconsistencias):
// · NO se escribe nada "a mano" en la base: cada hecho se registra llamando a los MISMOS controladores del programa
//   (alta de vehículo, asignación, carga de km, orden de mantenimiento, siniestro, préstamo...), con sus validaciones.
//   Si algo no cumple una regla del sistema, el script se detiene y avisa.
// · Un reloj simulado recorre los días desde febrero de 2024 hasta ayer: cada hecho se registra en SU fecha, así la
//   auditoría, los historiales y las fechas de cada registro coinciden.
// · NO toca usuarios, roles, contraseñas ni tipos de vehículo.
process.env.TZ = process.env.TZ || "America/Argentina/Buenos_Aires";
require("dotenv").config({ quiet: true });

const base = process.env.DB_NAME || "vehiculos_db";
if (!process.argv.includes("--confirmar")) {
  console.log("");
  console.log(`  Esto BORRA todos los datos cargados en la base "${base}" (menos usuarios, roles y tipos de vehículo)`);
  console.log("  y carga los datos de prueba (10 choferes, 10 vehículos con su historia, herramientas y ajustes).");
  console.log("  Para continuar ejecutá:  npm run db:prueba -- --confirmar");
  console.log("");
  process.exit(1);
}

const fs = require("fs");
const path = require("path");

// ───────────────────────── Reloj simulado ─────────────────────────
const FechaReal = Date;
let ahoraSimulado = null;
class FechaSimulada extends FechaReal {
  constructor(...args) {
    if (args.length === 0) super(ahoraSimulado ?? FechaReal.now());
    else super(...args);
  }
  static now() {
    return ahoraSimulado ?? FechaReal.now();
  }
}
const fijarReloj = (iso, hora) => (ahoraSimulado = new FechaReal(`${iso}T${hora}:00`).getTime());
const relojReal = () => (ahoraSimulado = null);

// ───────────────────────── Fechas (ISO, días calendario) ─────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOY = isoLocal(new FechaReal());
const sumarDias = (iso, n) => {
  const d = new FechaReal(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diaSemana = (iso) => new FechaReal(iso + "T12:00:00Z").getUTCDay();
const habil = (iso) => diaSemana(iso) >= 1 && diaSemana(iso) <= 5;
const habilMas = (iso, n) => {
  let d = iso;
  for (let k = 0; k < n; ) {
    d = sumarDias(d, 1);
    if (habil(d)) k++;
  }
  return d;
};
const habilDesde = (iso) => (habil(iso) ? iso : habilMas(iso, 1));
const habilHasta = (iso) => {
  let d = iso;
  while (!habil(d)) d = sumarDias(d, -1);
  return d;
};
const masUnAnio = (iso) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
const primerHabilDelMes = (iso) => habil(iso) && habilDesde(iso.slice(0, 8) + "01") === iso;
const solapan = (a1, a2, b1, b2) => a1 <= b2 && b1 <= a2;
const dma = (iso) => iso.split("-").reverse().join("/");
const miles = (n) => Number(n).toLocaleString("es-AR");

const FIN = "9999-12-31";
const INICIO = "2024-02-05"; // el sistema empieza a usarse
const ULTIMO_DIA = sumarDias(HOY, -1); // se simula hasta ayer; hoy queda para que el usuario pruebe

// Generador pseudoaleatorio con semilla: los datos salen siempre iguales
const crearAzar = (semilla) => () => {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ───────────────────────── Usuarios que hacen cada tarea ─────────────────────────
// (según sus permisos: el administrador da de alta y renueva documentación; el jefe de taller carga mantenimientos,
//  repuestos y herramientas; el supervisor asigna vehículos, carga kilometraje y siniestros)
const USUARIOS = { admin: "admin", taller: "taller_jefe", supervisor: "supervisor" };

// ───────────────────────── Ajustes base ─────────────────────────
const DISTRITOS = ["La Banda", "Fernández", "Ojo de Agua", "Termas de Río Hondo", "Añatuya"];

const TIPOS_SERVICIO = [
  "Service (aceite y filtros)",
  "Cambio de pastillas de freno",
  "Alineación y balanceo",
  "Cambio de neumáticos",
  "Cambio de batería",
  "Reparación eléctrica",
  "Chapa y pintura",
  "Service de maquinaria (horas)",
];

const REPUESTOS = {
  aceiteD: { nombre: "Aceite de motor 15W40 diésel (litro)", costo: 9800, stock: 60, minimo: 15, lote: 60 },
  aceiteN: { nombre: "Aceite de motor 10W40 nafta (litro)", costo: 8900, stock: 40, minimo: 10, lote: 40 },
  filtroAceite: { nombre: "Filtro de aceite", costo: 15500, stock: 10, minimo: 3, lote: 10 },
  filtroAire: { nombre: "Filtro de aire", costo: 19800, stock: 8, minimo: 3, lote: 8 },
  filtroComb: { nombre: "Filtro de combustible", costo: 24500, stock: 6, minimo: 2, lote: 6 },
  pastillas: { nombre: "Pastillas de freno (juego)", costo: 68000, stock: 4, minimo: 2, lote: 4 },
  neumatico: { nombre: "Neumático 265/65 R17 (camioneta)", costo: 235000, stock: 8, minimo: 4, lote: 8 },
  bateria: { nombre: "Batería 12V 75Ah", costo: 185000, stock: 2, minimo: 1, lote: 2 },
  hidraulico: { nombre: "Aceite hidráulico ISO 68 (litro)", costo: 12500, stock: 40, minimo: 10, lote: 40 },
};

const SECTORES = ["Taller Central", "Riego", "Obras Hidráulicas", "Canales y Desagües", "Hidrometría"];
const OPERARIOS = ["Héctor Carabajal", "Ramón Villalba", "Nicolás Gerez", "Sergio Ávila", "Mariano Luna", "Fabián Ruiz"];

const HERRAMIENTAS = [
  { codigo: "HR-001", nombre: "Motoguadaña Stihl FS 280", sector: "Canales y Desagües", stock: 3, energia: "Nafta" },
  { codigo: "HR-002", nombre: "Motosierra Husqvarna 445", sector: "Canales y Desagües", stock: 2, energia: "Nafta" },
  { codigo: "HR-003", nombre: "Generador Honda 5 kVA", sector: "Obras Hidráulicas", stock: 1, energia: "Nafta" },
  { codigo: "HR-004", nombre: 'Motobomba 3" Honda WB30', sector: "Riego", stock: 2, energia: "Nafta" },
  { codigo: "HR-005", nombre: 'Amoladora Bosch 9"', sector: "Taller Central", stock: 4, energia: "Eléctrica" },
  { codigo: "HR-006", nombre: "Taladro percutor Makita", sector: "Taller Central", stock: 3, energia: "Eléctrica" },
  { codigo: "HR-007", nombre: "Soldadora inverter 200A", sector: "Taller Central", stock: 1, energia: "Eléctrica" },
  { codigo: "HR-008", nombre: "Hidrolavadora Kärcher HD 6/15", sector: "Taller Central", stock: 1, energia: "Eléctrica" },
  { codigo: "HR-009", nombre: "Molinete hidrométrico OTT C31", sector: "Hidrometría", stock: 2, energia: "Manual" },
  { codigo: "HR-010", nombre: "Nivel óptico automático", sector: "Obras Hidráulicas", stock: 2, energia: "Manual" },
];
// Préstamos que quedan abiertos hoy: uno vence en 2 días, otro ya venció y otro todavía tiene tiempo
const PRESTAMOS_FINALES = [
  { codigo: "HR-004", operario: "Ramón Villalba", sector: "Riego", salida: sumarDias(HOY, -8), estimada: sumarDias(HOY, -3), obs: "Desagote de la toma del canal secundario" },
  { codigo: "HR-001", operario: "Héctor Carabajal", sector: "Canales y Desagües", salida: sumarDias(HOY, -5), estimada: sumarDias(HOY, 2), obs: "Desmalezado de banquinas del canal de Fernández" },
  { codigo: "HR-006", operario: "Nicolás Gerez", sector: "Obras Hidráulicas", salida: sumarDias(HOY, -2), estimada: sumarDias(HOY, 9), obs: "Anclajes de compuerta en obra de toma" },
];

// ───────────────────────── Choferes ─────────────────────────
// Categorías de licencia del formulario: A, B, B1, B2, C, D, E, G. Cada tipo de vehículo exige las suyas
// (Vehículos → Ajustes → Tipos): camión C/E, maquinaria G, moto A, utilitario B/B2/C/D/E, auto y camioneta B/B1/B2/C/D/E.
const CHOFERES = [
  { nombre: "Carlos", apellido: "Ledesma", dni: "30123456", tel: "3854101001", categoria: "B2", turno: "Mañana", carnet: true, nacimiento: "1986-04-17", ingreso: "2015-03-02", emision: "2023-05-10", vto: "2028-05-10", foto: "chofer-ejemplo-1.webp", dir: "Av. Belgrano Sur 1250, Santiago del Estero" },
  { nombre: "María", apellido: "Paz", dni: "31789456", tel: "3854101002", categoria: "B1", turno: "Mañana", carnet: false, nacimiento: "1987-09-03", ingreso: "2016-08-01", emision: "2021-12-01", vto: sumarDias(HOY, 20), dir: "Calle Absalón Rojas 455, La Banda" },
  { nombre: "Jorge", apellido: "Coronel", dni: "25123789", tel: "3854101003", categoria: "E", turno: "Tarde", carnet: true, nacimiento: "1972-02-21", ingreso: "2004-05-03", emision: "2022-09-14", vto: "2027-09-14", dir: "Av. Besares 820, La Banda" },
  { nombre: "Laura", apellido: "Gómez", dni: "33456789", tel: "3854101004", categoria: "B2", turno: "Tarde", carnet: false, nacimiento: "1990-06-12", ingreso: "2018-02-05", emision: "2023-03-20", vto: "2028-03-20", dir: "Calle 9 de Julio 312, Fernández" },
  { nombre: "Diego", apellido: "Juárez", dni: "35234567", tel: "3854101005", categoria: "C", turno: "Mañana", carnet: true, nacimiento: "1991-11-28", ingreso: "2019-04-01", emision: "2022-11-08", vto: "2027-11-08", foto: "chofer-ejemplo-2.webp", dir: "Pasaje Los Lapachos 77, Termas de Río Hondo" },
  { nombre: "Ana", apellido: "Salvatierra", dni: "34567123", tel: "3854101006", categoria: "B1", turno: "Tarde/Noche", carnet: false, nacimiento: "1993-01-30", ingreso: "2020-07-01", emision: "2023-07-18", vto: "2028-07-18", dir: "Calle Sarmiento 940, Añatuya" },
  { nombre: "Ricardo", apellido: "Abdala", dni: "16345678", tel: "3854101007", categoria: "D", turno: "Mañana", carnet: true, nacimiento: "1961-03-09", ingreso: "1992-03-02", emision: "2022-04-04", vto: "2027-04-04", dir: "Av. Rivadavia 1501, Santiago del Estero" },
  { nombre: "Sofía", apellido: "Herrera", dni: "36789012", tel: "3854101008", categoria: "B2", turno: "Noche", carnet: false, nacimiento: "1995-08-22", ingreso: "2021-09-01", emision: "2021-11-01", vto: sumarDias(HOY, -10), dir: "Calle Pellegrini 233, Ojo de Agua" },
  { nombre: "Lucía", apellido: "Ibáñez", dni: "34999123", tel: "3854101009", categoria: "A", turno: "Mañana", carnet: true, nacimiento: "1992-05-15", ingreso: "2017-10-02", emision: "2023-01-12", vto: "2028-01-12", dir: "Calle Mitre 128, Ojo de Agua" },
  { nombre: "Pablo", apellido: "Suárez", dni: "32111456", tel: "3854101010", categoria: "G", turno: "Tarde", carnet: true, nacimiento: "1988-12-04", ingreso: "2014-06-02", emision: "2022-06-20", vto: "2027-06-20", foto: "chofer-ejemplo-3.webp", dir: "Av. San Martín 610, Añatuya" },
];
const ALTA_CHOFERES = ["2024-02-06", "2024-02-06", "2024-02-06", "2024-02-07", "2024-02-07", "2024-02-07", "2024-02-08", "2024-02-08", "2024-02-08", "2024-02-08"];
// Novedades de choferes
const RICARDO = 6, ANA = 5, SOFIA = 7;
const BAJA_RICARDO = habilHasta(sumarDias(HOY, -72)); // se jubila
const LICENCIA_ANA = habilHasta(sumarDias(HOY, -14)); // licencia médica
CHOFERES[RICARDO].disponibleHasta = sumarDias(BAJA_RICARDO, -1);
CHOFERES[ANA].disponibleHasta = sumarDias(LICENCIA_ANA, -1);
CHOFERES[SOFIA].disponibleHasta = sumarDias(CHOFERES[SOFIA].vto, -1); // con la licencia vencida no puede manejar

// ───────────────────────── Vehículos ─────────────────────────
// km: kilometraje (u horas) al darlo de alta en el sistema · ritmo: km por día hábil cuando está asignado
const VEHICULOS = [
  { patente: "AE101AA", tipo: "Camioneta", marca: "Toyota", modelo: "Hilux 2.8 SRV 4x4", anio: 2022, combustible: "Diesel", transmision: "Manual", km: 41200, distrito: "La Banda", seguro: "La Segunda", fechaAlta: "2022-05-16", altaSistema: "2024-02-12", ritmo: 150, intervalo: 10000, seguroMD: "05-20", rtoMD: "06-14", taller: "Lubricentro El Cruce" },
  { patente: "AE202BB", tipo: "Camioneta", marca: "Ford", modelo: "Ranger XLT 3.2 4x4", anio: 2021, combustible: "Diesel", transmision: "Manual", km: 63800, distrito: "Fernández", seguro: "Federación Patronal", fechaAlta: "2021-08-09", altaSistema: "2024-02-12", ritmo: 140, intervalo: 10000, seguroMD: "08-12", rtoMD: "09-03", taller: "Lubricentro El Cruce" },
  { patente: "AF303CC", tipo: "Camioneta", marca: "Volkswagen", modelo: "Amarok V6 Highline", anio: 2023, combustible: "Diesel", transmision: "Automática", km: 8900, distrito: "Ojo de Agua", seguro: "Sancor Seguros", fechaAlta: "2023-09-04", altaSistema: "2024-02-19", ritmo: 130, intervalo: 10000, seguroMD: "09-08", rtoMD: "03-21", taller: "Concesionario Volkswagen Santiago" },
  { patente: "AD404DD", tipo: "Camión", marca: "Mercedes-Benz", modelo: "Atego 1726", anio: 2019, combustible: "Diesel", transmision: "Manual", km: 152300, distrito: "Añatuya", seguro: "Sancor Seguros", fechaAlta: "2019-11-11", altaSistema: "2024-02-19", ritmo: 170, intervalo: 15000, seguroMD: sumarDias(HOY, 12).slice(5), rtoMD: "04-17", taller: "Taller Central APRH" },
  { patente: "AF505EE", tipo: "Utilitario", marca: "Fiat", modelo: "Strada Volcano 1.3", anio: 2023, combustible: "Nafta", transmision: "Manual", km: 12400, distrito: "Termas de Río Hondo", seguro: "Federación Patronal", fechaAlta: "2023-06-12", altaSistema: "2024-03-04", ritmo: 100, intervalo: 10000, seguroMD: "06-28", rtoMD: sumarDias(HOY, -8).slice(5), rtoSinRenovar: sumarDias(HOY, -8), taller: "Servicios Mecánicos Norte" },
  { patente: "AE606FF", tipo: "Utilitario", marca: "Renault", modelo: "Kangoo II Express", anio: 2021, combustible: "Nafta", transmision: "Manual", km: 39700, distrito: "La Banda", seguro: "Provincia Seguros", fechaAlta: "2021-03-15", altaSistema: "2024-03-04", ritmo: 110, intervalo: 10000, seguroMD: "03-18", rtoMD: "07-09", taller: "Servicios Mecánicos Norte" },
  { patente: "AF707GG", tipo: "Auto", marca: "Toyota", modelo: "Corolla XEI 2.0 CVT", anio: 2023, combustible: "Nafta", transmision: "Automática", km: 9600, distrito: "La Banda", seguro: "La Segunda", fechaAlta: "2023-10-02", altaSistema: "2024-03-11", ritmo: 90, intervalo: 10000, seguroMD: "10-05", rtoMD: "02-26", taller: "Concesionario Toyota Santiago" },
  { patente: "AG808HH", tipo: "Auto", marca: "Peugeot", modelo: "208 Allure 1.6", anio: 2024, combustible: "Nafta", transmision: "Manual", km: 0, distrito: "Fernández", seguro: "La Segunda", fechaAlta: "2024-04-15", altaSistema: "2024-04-15", ritmo: 100, intervalo: 10000, seguroMD: "04-22", rtoPrimera: "2027-04-15", taller: "Servicios Mecánicos Norte", sinServiceDesde: sumarDias(HOY, -100) },
  { patente: "A909JJK", tipo: "Motocicleta", marca: "Honda", modelo: "XR 150L", anio: 2022, combustible: "Nafta", transmision: "Manual", km: 8300, distrito: "Ojo de Agua", seguro: "Rivadavia Seguros", fechaAlta: "2022-07-04", altaSistema: "2024-03-11", ritmo: 45, intervalo: 5000, seguroMD: "07-08", rtoMD: "08-19", taller: "Motos del Norte (service Honda)" },
  { patente: "MAQ010", tipo: "Maquinaria Pesada", marca: "Caterpillar", modelo: "Retroexcavadora 416F", anio: 2020, combustible: "Diesel", transmision: "Manual", km: 2150, distrito: "Añatuya", seguro: "Provincia Seguros", fechaAlta: "2020-10-19", altaSistema: "2024-03-18", ritmo: 5, intervalo: 250, seguroMD: "10-24", sinRto: true, taller: "Taller Central APRH" },
];
const V = { hilux: 0, ranger: 1, amarok: 2, camion: 3, strada: 4, kangoo: 5, corolla: 6, p208: 7, moto: 8, maq: 9 };
const C = { carlos: 0, maria: 1, jorge: 2, laura: 3, diego: 4, ana: 5, ricardo: 6, sofia: 7, lucia: 8, pablo: 9 };
const LICENCIAS_TIPO = { Camioneta: "B,B1,B2,C,D,E", Camión: "C,E", "Maquinaria Pesada": "G", Utilitario: "B,B2,C,D,E", Auto: "B,B1,B2,C,D,E", Motocicleta: "A" };

// Hechos fijos de la historia (siniestros, el estado en que queda cada vehículo hoy)
const F = {
  // Corolla: siniestro en 2025 (resuelto) y chapa y pintura
  corollaAsig: "2025-07-01", corollaSin: "2025-07-14", corollaRes: "2025-07-24", corollaChapa: "2025-07-25", corollaChapaFin: "2025-08-04",
  // Camión: roce en 2025 (resuelto) y chapa
  camionAsig: "2025-09-22", camionSin: "2025-10-02", camionRes: "2025-10-09", camionChapa: "2025-10-10", camionChapaFin: "2025-10-15",
  // Hoy
  hiluxAsig: habilHasta(sumarDias(HOY, -15)), // Hilux en uso
  amarokAsig: habilHasta(sumarDias(HOY, -12)), amarokSin: habilHasta(sumarDias(HOY, -5)), // Amarok en siniestro
  maqAsig: habilHasta(sumarDias(HOY, -9)), // retroexcavadora en uso
  corollaAsigHoy: habilHasta(sumarDias(HOY, -8)), // Corolla en uso
  rangerElectrica: habilHasta(sumarDias(HOY, -2)), // Ranger en el taller
};
const ASIG_FIJAS = [
  { v: V.corolla, c: C.laura, desde: F.corollaAsig, hasta: F.corollaSin, destino: "Termas de Río Hondo", obs: "Comisión de relevamiento de tomas en Termas de Río Hondo" },
  { v: V.camion, c: C.jorge, desde: F.camionAsig, hasta: F.camionSin, destino: "Añatuya", obs: "Traslado de caños y materiales para obra de desagüe" },
  { v: V.amarok, c: C.diego, desde: F.amarokAsig, hasta: F.amarokSin, destino: "Ojo de Agua", obs: "Inspección de compuertas del canal principal" },
  { v: V.hilux, c: C.carlos, desde: F.hiluxAsig, hasta: null, destino: "La Banda", obs: "Recorrida de control de turnos de riego" },
  { v: V.maq, c: C.pablo, desde: F.maqAsig, hasta: null, destino: "Añatuya", obs: "Limpieza y perfilado del canal de desagüe" },
  { v: V.corolla, c: C.laura, desde: F.corollaAsigHoy, hasta: null, destino: "La Banda", obs: "Traslado de personal técnico a reuniones de consorcio" },
];
// Períodos en que el vehículo no recibe asignaciones ni services "de rutina" porque tiene un hecho fijo
const CONGELADO = {
  [V.corolla]: [[sumarDias(F.corollaAsig, -7), F.corollaChapaFin], [sumarDias(F.corollaAsigHoy, -7), FIN]],
  [V.camion]: [[sumarDias(F.camionAsig, -7), F.camionChapaFin]],
  [V.amarok]: [[sumarDias(F.amarokAsig, -7), FIN]],
  [V.hilux]: [[sumarDias(F.hiluxAsig, -7), FIN]],
  [V.maq]: [[sumarDias(F.maqAsig, -7), FIN]],
  [V.ranger]: [[sumarDias(F.rangerElectrica, -7), FIN]],
};
const LIMITE_ASIG = { [V.strada]: sumarDias(VEHICULOS[V.strada].rtoSinRenovar, -1) }; // con la RTO vencida no sale

const DESTINO_TAREAS = [
  "Recorrida de control de turnos de riego",
  "Inspección de compuertas y tomas",
  "Aforo de caudales en el río Dulce",
  "Traslado de personal a obra",
  "Limpieza de canales y desagües",
  "Relevamiento de reclamos de regantes",
  "Control de represas y bordos",
  "Entrega de materiales a cuadrilla",
];

// ═════════════════════════ PLANIFICACIÓN (día por día) ═════════════════════════
// Arma la lista de hechos en orden. No toca la base: sólo decide qué pasa cada día respetando las reglas.
function planificar(semilla) {
  const azar = crearAzar(semilla);
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
  const hechos = [];
  const hecho = (fecha, hora, quien, tipo, datos = {}) => hechos.push({ fecha, hora, quien, tipo, datos, n: hechos.length });

  const primerVto = (alta, md) => {
    let y = Number(alta.slice(0, 4));
    if (`${y}-${md}` <= sumarDias(alta, 15)) y++;
    return `${y}-${md}`;
  };
  const vs = VEHICULOS.map((d, i) => ({
    i,
    d,
    activo: false,
    odo: d.km,
    kmSis: d.km,
    estado: "Disponible",
    objetivo: d.tipo === "Maquinaria Pesada" ? Math.ceil((d.km + 60) / d.intervalo) * d.intervalo : Math.ceil((d.km + 2500) / d.intervalo) * d.intervalo,
    nServ: 0,
    asig: null,
    taller: null,
    programado: false,
    proximaAsig: null,
    segVto: primerVto(d.altaSistema, d.seguroMD),
    rtoVto: d.sinRto ? null : d.rtoPrimera || primerVto(d.altaSistema, d.rtoMD),
    ultimoChofer: null,
  }));
  const cs = CHOFERES.map((d, i) => ({ i, d, ocupado: null, libreDesde: INICIO, hastaDisp: d.disponibleHasta || FIN, reservas: [] }));
  for (const a of ASIG_FIJAS) cs[a.c].reservas.push([sumarDias(a.desde, -1), a.hasta || FIN]);
  const stock = Object.fromEntries(Object.entries(REPUESTOS).map(([k, r]) => [k, r.stock]));
  const congelado = (v, desde, hasta) => (CONGELADO[v.i] || []).some(([a, b]) => solapan(desde, hasta, a, b));
  const habilitado = (c, v) => LICENCIAS_TIPO[v.d.tipo].split(",").includes(c.d.categoria);

  let factura = 1200;
  let pedido = 40;

  // ── Acciones ──
  const iniciarAsignacion = (v, c, d, hasta, destino, obs, fija = false) => {
    if (v.estado !== "Disponible" || v.asig) throw new Error(`Plan: ${v.d.patente} no está disponible el ${d}`);
    if (c.ocupado !== null || c.libreDesde > d) throw new Error(`Plan: ${c.d.nombre} está ocupado el ${d}`);
    hecho(d, "08:00", "supervisor", "asignar", { v: v.i, c: c.i, km: v.odo, destino, obs });
    v.asig = { c: c.i, hasta, fija };
    v.estado = "En uso";
    v.kmSis = Math.max(v.kmSis, v.odo);
    v.ultimoChofer = c.i;
    c.ocupado = v.i;
  };
  const terminarAsignacion = (v, d, hora) => {
    hecho(d, hora, "supervisor", "devolver", { v: v.i });
    cs[v.asig.c].ocupado = null;
    cs[v.asig.c].libreDesde = hora < "08:00" ? d : sumarDias(d, 1); // devuelto a la tarde: vuelve a manejar al día siguiente
    v.asig = null;
    v.estado = "Disponible";
    v.proximaAsig = sumarDias(d, 1 + Math.floor(azar() * 6));
  };
  const reponerSiFalta = (d, lineas) => {
    for (const [clave, cant] of lineas) {
      if (stock[clave] >= cant) continue;
      const r = REPUESTOS[clave];
      const compra = Math.ceil((cant - stock[clave] + r.minimo) / r.lote) * r.lote;
      hecho(d, "08:00", "taller", "reponer", { clave, cantidad: compra });
      stock[clave] += compra;
    }
    for (const [clave, cant] of lineas) stock[clave] -= cant;
  };
  const entrarAlTaller = (v, d) => {
    if (v.estado === "En uso") terminarAsignacion(v, d, "07:45");
    const n = v.nServ + 1;
    const esCamioneta = v.d.tipo === "Camioneta";
    const dias = esCamioneta && n % 4 === 0 ? 2 : 1; // con cambio de neumáticos queda un día más
    if (v.programado) {
      // Antes de ingresar se toma la lectura del odómetro
      if (v.odo > v.kmSis) {
        hecho(d, "08:15", "supervisor", "km", { v: v.i, km: v.odo, obs: "Lectura de odómetro al ingresar al taller" });
        v.kmSis = v.odo;
      }
      hecho(d, "08:30", "taller", "iniciarProgramado", { v: v.i, objetivo: v.objetivo });
    } else {
      hecho(d, "08:30", "taller", "abrirOrden", {
        v: v.i,
        tipo: v.d.tipo === "Maquinaria Pesada" ? "Service de maquinaria (horas)" : "Service (aceite y filtros)",
        km: v.odo,
        descripcion: v.d.tipo === "Maquinaria Pesada" ? `Ingreso al taller para el service de ${miles(v.objetivo)} hs` : `Ingreso al taller para el service de ${miles(v.objetivo)} km`,
        taller: v.d.taller,
      });
    }
    v.programado = false;
    v.estado = "En mantenimiento";
    v.taller = { tipo: "service", hasta: habilMas(d, dias), n };
  };
  const lineasService = (v, n) => {
    const t = v.d.tipo;
    const diesel = v.d.combustible === "Diesel";
    const litros = { Camioneta: 7, Camión: 14, Utilitario: 5, Auto: 4, Motocicleta: 1, "Maquinaria Pesada": 14 }[t];
    const l = [[diesel ? "aceiteD" : "aceiteN", litros], ["filtroAceite", 1]];
    if (t !== "Motocicleta" || n % 2 === 0) l.push(["filtroAire", 1]);
    if (diesel || n % 2 === 0) l.push(["filtroComb", 1]);
    if (t !== "Maquinaria Pesada" && n % 3 === 0) l.push(["pastillas", 1]);
    if (t === "Camioneta" && n % 4 === 0) l.push(["neumatico", 4]);
    if (["AE202BB", "AE606FF", "AD404DD"].includes(v.d.patente) && n === 3) l.push(["bateria", 1]);
    if (t === "Maquinaria Pesada" && n % 2 === 0) l.push(["hidraulico", 30]);
    return l;
  };
  const describir = (v, lineas) => {
    const partes = [];
    const aceite = lineas.find(([k]) => k === "aceiteD" || k === "aceiteN");
    partes.push(`cambio de aceite (${aceite[1]} L ${aceite[0] === "aceiteD" ? "15W40" : "10W40"})`);
    const nombres = { filtroAceite: "filtro de aceite", filtroAire: "filtro de aire", filtroComb: "filtro de combustible" };
    const filtros = lineas.filter(([k]) => nombres[k]).map(([k]) => nombres[k]);
    if (filtros.length) partes.push(filtros.join(", "));
    if (lineas.some(([k]) => k === "pastillas")) partes.push("cambio de pastillas de freno delanteras");
    if (lineas.some(([k]) => k === "neumatico")) partes.push("cambio de los 4 neumáticos");
    if (lineas.some(([k]) => k === "bateria")) partes.push("reemplazo de batería (la anterior no retenía carga)");
    if (lineas.some(([k]) => k === "hidraulico")) partes.push("cambio de aceite hidráulico (30 L)");
    return partes.join("; ") + ".";
  };
  const terminarTaller = (v, d) => {
    const t = v.taller;
    const externo = !v.d.taller.startsWith("Taller Central");
    const admin = () => {
      factura++;
      pedido++;
      const anio = d.slice(0, 4);
      return externo
        ? { proveedor: v.d.taller, nro_factura: `0003-${pad(0) + String(factura).padStart(6, "0")}`, nro_remito: `0001-${String(factura + 3100).padStart(8, "0")}`, nro_pedido: `PED-${anio}-${String(pedido).padStart(3, "0")}`, nro_expediente: `EXP-${String(1500 + pedido)}/${anio}` }
        : { nro_pedido: `PED-${anio}-${String(pedido).padStart(3, "0")}` };
    };
    if (t.tipo === "service") {
      const lineas = lineasService(v, t.n);
      reponerSiFalta(d, lineas);
      const maq = v.d.tipo === "Maquinaria Pesada";
      const mano = externo ? { Camioneta: 95000, Utilitario: 70000, Auto: 65000, Motocicleta: 28000 }[v.d.tipo] + (lineas.some(([k]) => k === "neumatico") ? 40000 : 0) : 0;
      hecho(d, "15:30", "taller", "cerrarOrden", {
        v: v.i,
        km: v.odo,
        lineas,
        mano,
        taller: v.d.taller,
        proximo: maq ? null : v.odo + v.d.intervalo,
        descripcion: `${maq ? `Service de ${miles(v.objetivo)} hs` : `Service de ${miles(v.objetivo)} km`}: ${describir(v, lineas)}`,
        observaciones: externo ? "" : "Mano de obra propia del Taller Central.",
        admin: admin(),
      });
      v.nServ = t.n;
      v.objetivo = v.odo + v.d.intervalo;
      // Cada dos services, alineación y balanceo (autos, camionetas y utilitarios)
      if (["Camioneta", "Auto", "Utilitario"].includes(v.d.tipo) && t.n % 2 === 0) {
        hecho(d, "16:30", "taller", "ordenRealizada", {
          v: v.i,
          tipo: "Alineación y balanceo",
          km: v.odo,
          taller: "Gomería y Alineación Del Norte",
          mano: 48000,
          descripcion: "Alineación de tren delantero y balanceo de las 4 ruedas.",
          admin: { proveedor: "Gomería y Alineación Del Norte", nro_factura: `0005-${String(factura + 800).padStart(8, "0")}` },
        });
      }
    } else if (t.tipo === "chapa") {
      hecho(d, "15:30", "taller", "cerrarOrden", { v: v.i, km: v.odo, lineas: [], mano: t.mano, taller: t.taller, descripcion: t.trabajo, observaciones: t.obs, admin: { ...admin(), proveedor: t.taller } });
    }
    v.kmSis = Math.max(v.kmSis, v.odo);
    // Igual que el programa: una orden Realizada con más km anula el service programado pendiente
    if (v.programado && v.odo >= v.objetivo) v.programado = false;
    v.taller = null;
    v.estado = "Disponible";
    v.proximaAsig = habilMas(d, 1);
  };
  const intentarAsignar = (v, d) => {
    let hasta = habilDesde(sumarDias(d, 5 + Math.floor(azar() * 24)));
    if (hasta > ULTIMO_DIA) hasta = habilHasta(ULTIMO_DIA);
    if (LIMITE_ASIG[v.i] && hasta > LIMITE_ASIG[v.i]) hasta = habilHasta(LIMITE_ASIG[v.i]);
    if (hasta < habilMas(d, 2) || congelado(v, d, hasta)) {
      v.proximaAsig = sumarDias(d, 1);
      return;
    }
    const libres = cs.filter(
      (c) => c.ocupado === null && c.libreDesde <= d && c.hastaDisp >= hasta && c.d.vto > hasta && habilitado(c, v) && !c.reservas.some(([a, b]) => solapan(d, hasta, a, b)),
    );
    if (!libres.length) {
      v.proximaAsig = sumarDias(d, 1);
      return;
    }
    const habitual = libres.find((c) => c.i === v.ultimoChofer);
    const c = habitual && azar() < 0.6 ? habitual : elegir(libres);
    const destino = azar() < 0.6 ? v.d.distrito : elegir(DISTRITOS);
    iniciarAsignacion(v, c, d, hasta, destino, elegir(DESTINO_TAREAS));
  };

  // ── Préstamos de herramientas ──
  const herr = HERRAMIENTAS.map((h) => ({ ...h, libres: h.stock }));
  const devoluciones = []; // { fecha, codigo, clave }
  let nPrestamo = 0;

  // ── Recorrido día por día ──
  for (let d = INICIO; d <= ULTIMO_DIA; d = sumarDias(d, 1)) {
    const h = habil(d);
    if (d === INICIO) hecho(d, "08:30", "admin", "ajustesBase");
    ALTA_CHOFERES.forEach((f, i) => f === d && hecho(d, `${pad(9 + Math.floor(i / 2))}:${i % 2 ? "40" : "10"}`, "admin", "altaChofer", { c: i }));
    if (d === "2024-02-20") HERRAMIENTAS.forEach((x, i) => hecho(d, `10:${pad(i * 5)}`, "taller", "altaHerramienta", { i }));
    if (h && diaSemana(d) === 1) hecho(d, "07:00", "sistema", "alertas");
    if (d === BAJA_RICARDO) {
      if (cs[RICARDO].ocupado !== null) throw new Error("Plan: Ricardo tiene un vehículo el día de su baja");
      hecho(d, "10:00", "admin", "desactivarChofer", { c: RICARDO, estado: "Inactivo", motivo: "Se acogió al beneficio jubilatorio." });
    }
    if (d === LICENCIA_ANA) {
      if (cs[ANA].ocupado !== null) throw new Error("Plan: Ana tiene un vehículo el día de su licencia");
      hecho(d, "10:15", "admin", "desactivarChofer", { c: ANA, estado: "Licencia Vacaciones/Medica", motivo: "Licencia médica por cirugía programada (30 días)." });
    }

    for (const v of vs) {
      if (!v.activo) {
        if (d === v.d.altaSistema) {
          hecho(d, `${pad(9 + Math.floor(v.i / 3))}:${pad((v.i % 3) * 20)}`, "admin", "altaVehiculo", { v: v.i, segVto: v.segVto, rtoVto: v.rtoVto });
          v.activo = true;
          v.proximaAsig = habilMas(d, 1 + Math.floor(azar() * 3));
        }
        continue;
      }
      let ocupado = false;
      if (v.taller && v.taller.hasta === d) {
        terminarTaller(v, d);
        ocupado = true;
      }

      // ── Hechos fijos ──
      for (const a of ASIG_FIJAS) if (a.v === v.i && a.desde === d) {
        iniciarAsignacion(v, cs[a.c], d, a.hasta || FIN, a.destino, a.obs, true);
        ocupado = true;
      }
      const siniestro = (fecha, datos) => {
        if (d !== fecha) return;
        hecho(d, "10:40", "supervisor", "siniestro", { v: v.i, c: v.asig ? v.asig.c : null, ...datos });
        if (v.asig) {
          cs[v.asig.c].ocupado = null;
          cs[v.asig.c].libreDesde = sumarDias(d, 1);
          v.asig = null;
        }
        v.estado = "En siniestro";
        ocupado = true;
      };
      const resolver = (fecha) => {
        if (d !== fecha) return;
        hecho(d, "11:00", "supervisor", "resolverSiniestro", { v: v.i });
        v.estado = "Disponible";
        ocupado = true;
      };
      const chapa = (fecha, hasta, datos) => {
        if (d !== fecha) return;
        hecho(d, "08:30", "taller", "abrirOrden", { v: v.i, tipo: "Chapa y pintura", km: v.odo, descripcion: datos.ingreso, taller: datos.taller });
        v.estado = "En mantenimiento";
        v.taller = { tipo: "chapa", hasta, ...datos };
        ocupado = true;
      };
      if (v.i === V.corolla) {
        siniestro(F.corollaSin, {
          ubicacion: "Ruta Nacional 9, km 1142 (acceso a La Banda)",
          relato: "Al frenar por un semáforo, un auto que venía detrás no alcanzó a detenerse y lo embistió desde atrás. Sin heridos.",
          danos: "Paragolpes trasero roto, portón del baúl hundido y óptica trasera izquierda rota.",
          tercero: { vehiculo: "Chevrolet Onix AC123XY", seguro: "Sancor Seguros", conductor: "Martín Díaz", contacto: "3854223344" },
        });
        resolver(F.corollaRes);
        chapa(F.corollaChapa, F.corollaChapaFin, {
          ingreso: "Ingreso por siniestro: reparación de la parte trasera.",
          trabajo: "Reparación de chapa trasera, cambio de paragolpes y óptica trasera izquierda, pintura del portón. Cubierto por el seguro del tercero.",
          obs: "Siniestro cubierto por Sancor Seguros (tercero responsable).",
          taller: "Chapería y Pintura Santillán",
          mano: 640000,
        });
      }
      if (v.i === V.camion) {
        siniestro(F.camionSin, {
          ubicacion: "Ruta Provincial 21, ingreso a Añatuya",
          relato: "Al maniobrar marcha atrás en la descarga de materiales rozó un poste de alumbrado. Sin heridos.",
          danos: "Abolladura en el lateral derecho de la caja y faro trasero roto.",
          tercero: {},
        });
        resolver(F.camionRes);
        chapa(F.camionChapa, F.camionChapaFin, {
          ingreso: "Ingreso por siniestro: lateral derecho de la caja.",
          trabajo: "Enderezado del lateral derecho de la caja, cambio de faro trasero y pintura.",
          obs: "Mano de obra propia del Taller Central.",
          taller: "Taller Central APRH",
          mano: 0,
        });
      }
      if (v.i === V.amarok) {
        siniestro(F.amarokSin, {
          ubicacion: "Camino vecinal al canal principal, Ojo de Agua",
          relato: "Por el camino de tierra mojado la camioneta derrapó y cayó en la cuneta. El chofer salió ileso; se pidió grúa.",
          danos: "Tren delantero desalineado, paragolpes delantero y guardabarros izquierdo dañados. Pendiente la evaluación del seguro.",
          tercero: {},
        });
      }
      if (v.i === V.ranger && d === F.rangerElectrica) {
        if (v.estado !== "Disponible") throw new Error("Plan: la Ranger no está disponible para entrar al taller");
        if (v.odo > v.kmSis) {
          hecho(d, "08:15", "supervisor", "km", { v: v.i, km: v.odo, obs: "Lectura de odómetro al ingresar al taller" });
          v.kmSis = v.odo;
        }
        hecho(d, "09:00", "taller", "abrirOrden", {
          v: v.i,
          tipo: "Reparación eléctrica",
          km: v.odo,
          descripcion: "Falla de carga: la batería se descarga y el testigo del alternador queda encendido. Se revisa alternador y regulador.",
          taller: "Electricidad del Automotor Gerez",
        });
        v.estado = "En mantenimiento";
        v.taller = { tipo: "abierta", hasta: FIN };
        ocupado = true;
      }

      // ── Service de rutina: se crea el programado al acercarse y se entra al taller cuando corresponde ──
      const sinService = v.d.sinServiceDesde && d >= v.d.sinServiceDesde;
      if (h && !ocupado && !v.taller && ["Disponible", "En uso"].includes(v.estado) && !sinService && !congelado(v, d, sumarDias(d, 4))) {
        const umbral = v.d.tipo === "Maquinaria Pesada" ? 10 : 700;
        if (v.objetivo - v.odo <= umbral) {
          entrarAlTaller(v, d);
          ocupado = true;
        }
      }
      if (h && !ocupado && !v.taller && !v.programado && v.d.tipo !== "Maquinaria Pesada" && v.estado !== "En siniestro" && v.objetivo - v.odo <= 2000) {
        hecho(d, "10:30", "taller", "programar", { v: v.i, km: v.objetivo });
        v.programado = true;
      }

      // ── Asignación de rutina ──
      if (h && !ocupado && v.estado === "Disponible" && !v.asig && v.proximaAsig && d >= v.proximaAsig) intentarAsignar(v, d);

      // ── Renovación de seguro y RTO (una semana antes del vencimiento) ──
      if (h) {
        const renovar = {};
        if (v.segVto && d >= sumarDias(v.segVto, -7) && v.segVto > d) renovar.seguro = masUnAnio(v.segVto);
        if (v.rtoVto && d >= sumarDias(v.rtoVto, -7) && v.rtoVto > d && v.rtoVto !== v.d.rtoSinRenovar) renovar.rto = masUnAnio(v.rtoVto);
        if (Object.keys(renovar).length) {
          hecho(d, "10:00", "admin", "renovar", { v: v.i, ...renovar });
          if (renovar.seguro) v.segVto = renovar.seguro;
          if (renovar.rto) v.rtoVto = renovar.rto;
        }
      }

      // ── Control mensual del odómetro ──
      if (primerHabilDelMes(d) && v.odo > v.kmSis && v.estado !== "En siniestro") {
        hecho(d, "12:00", "supervisor", "km", { v: v.i, km: v.odo, obs: "Control mensual de odómetro" });
        v.kmSis = v.odo;
      }

      // ── Uso del día y devolución ──
      if (v.estado === "En uso" && h) v.odo += Math.max(1, Math.round(v.d.ritmo * (0.75 + azar() * 0.5)));
      if (v.asig && !v.asig.fija && v.asig.hasta === d) terminarAsignacion(v, d, "17:00");
    }

    // ── Herramientas: devoluciones y préstamos ──
    for (const p of PRESTAMOS_FINALES) {
      if (p.salida !== d) continue;
      const x = herr.find((y) => y.codigo === p.codigo);
      if (x.libres < 1) throw new Error(`Plan: no hay unidades de ${p.codigo} para el préstamo final`);
      x.libres--;
      hecho(d, "08:15", "taller", "prestar", { clave: `final-${p.codigo}`, codigo: p.codigo, operario: p.operario, sector: p.sector, estimada: p.estimada, obs: p.obs });
    }
    if (h && d >= "2024-02-26" && d <= sumarDias(HOY, -16) && azar() < 0.45) {
      const opciones = herr.filter((x) => x.libres > 0);
      if (opciones.length) {
        const x = elegir(opciones);
        const estimada = habilMas(d, 1 + Math.floor(azar() * 4));
        const r = azar();
        const real = r < 0.15 ? habilMas(estimada, 1) : r < 0.3 && estimada > habilMas(d, 1) ? habilMas(d, 1) : estimada;
        const sector = azar() < 0.6 ? x.sector : elegir(SECTORES.filter((s) => s !== "Taller Central"));
        const clave = `p${++nPrestamo}`;
        x.libres--;
        hecho(d, "08:15", "taller", "prestar", { clave, codigo: x.codigo, operario: elegir(OPERARIOS), sector, estimada, obs: elegir(["", "", "Trabajos de mantenimiento en canal", "Reparación en obra de toma", "Tareas de la cuadrilla de desagües", "Aforo de campaña"]) });
        devoluciones.push({ fecha: real, codigo: x.codigo, clave });
      }
    }
    // Las devoluciones son a la tarde: esas unidades se pueden prestar recién desde el día siguiente
    for (const dv of devoluciones.filter((x) => x.fecha === d)) {
      hecho(d, "16:30", "taller", "devolverHerramienta", { clave: dv.clave, codigo: dv.codigo });
      herr.find((x) => x.codigo === dv.codigo).libres++;
    }
  }
  return { hechos, vs, cs, stock };
}

// Busca una semilla en la que el Peugeot 208 quede con el service programado superado (la alerta que queremos mostrar)
function elegirPlan() {
  for (let semilla = 1; semilla < 500; semilla++) {
    let plan;
    try {
      plan = planificar(semilla);
    } catch (e) {
      continue;
    }
    const p208 = plan.vs[V.p208];
    const kangoo = plan.vs[V.kangoo];
    const ok =
      p208.programado && p208.odo - p208.objetivo >= 200 && p208.odo - p208.objetivo <= 2500 && p208.nServ >= 1 &&
      kangoo.objetivo - kangoo.odo > 700 && kangoo.objetivo - kangoo.odo <= 2000 && // service próximo (alerta alta)
      plan.vs.every((v) => v.nServ >= 1);
    if (ok) return { semilla, ...plan };
  }
  throw new Error("No se encontró una combinación de datos que cumpla todas las condiciones.");
}

// ═════════════════════════ EJECUCIÓN (con los controladores del programa) ═════════════════════════
const sinHtml = (t) => String(t || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

(async () => {
  const plan = elegirPlan();
  console.log("");
  console.log(`  Plan armado: ${plan.hechos.length} hechos entre el ${dma(INICIO)} y el ${dma(ULTIMO_DIA)}.`);

  console.log("  Preparando la base y borrando los datos cargados...");
  const { prepararBaseDeDatos } = require("../src/model/database/preparar");
  const { limpiarDatos } = require("../src/model/database/limpieza");
  await prepararBaseDeDatos();
  const db = require("../src/model/database/models");
  // Usuarios reales del sistema que figuran como autores (no se modifican). Se verifican ANTES de borrar nada.
  const usuarios = {};
  for (const [clave, nombre] of Object.entries(USUARIOS)) {
    const fila = await db.Usuario.findOne({ where: { nombre_usuario: nombre }, include: [{ association: "rol" }] });
    if (!fila) throw new Error(`Falta el usuario "${nombre}".`);
    usuarios[clave] = { id: fila.id_usuario, nombre: fila.nombre, apellido: fila.apellido, rol: fila.rol ? fila.rol.nombre : null };
  }

  const { tablas } = await limpiarDatos({ catalogos: true });
  console.log(`  · Tablas vaciadas: ${tablas.length} (usuarios, roles y tipos de vehículo se conservan)`);

  const { validationResult } = require("express-validator");
  const { choferVAlidation } = require("../src/validations/choferValidation");
  const vehicleController = require("../src/controllers/vehicleController");
  const choferController = require("../src/controllers/choferController");
  const assignmentController = require("../src/controllers/assignmentController");
  const siniestroController = require("../src/controllers/siniestroController");
  const toolController = require("../src/controllers/toolController");
  const alertaService = require("../src/data/alertaService");
  const { DIR_DOCUMENTOS } = require("../src/utils/documentos");

  // Simula un pedido al servidor: si el programa responde con un error, se detiene todo
  const llamar = async (handler, quien, { body = {}, params = {}, files = {} } = {}, etiqueta = "") => {
    const avisos = [];
    const req = {
      body,
      params,
      files,
      query: {},
      headers: {},
      session: { usuarioLogueado: usuarios[quien], save: (cb) => cb && cb() },
      flash: (tipo, msg) => (msg === undefined ? [] : avisos.push([tipo, msg])),
    };
    const res = { codigo: 200, destino: null, cuerpo: null };
    res.status = (c) => ((res.codigo = c), res);
    res.redirect = (u) => ((res.destino = u), res);
    res.send = (b) => ((res.cuerpo = b), res);
    res.render = (vista, datos) => ((res.cuerpo = datos && datos.errors ? JSON.stringify(Object.values(datos.errors).map((e) => e.msg)) : vista), res);
    res.json = (d) => ((res.cuerpo = d), res);
    res.setHeader = () => {};
    await handler(req, res);
    const error =
      avisos.find(([t]) => t === "error")?.[1] ||
      (res.codigo >= 400 ? sinHtml(res.cuerpo) : null) ||
      (res.destino && /[?&]error=/.test(res.destino) ? decodeURIComponent(res.destino.split("error=")[1]) : null);
    if (error) throw new Error(`${etiqueta}: el programa lo rechazó → ${error}`);
    return { req, res };
  };

  // Archivos de ejemplo (mismo formato de nombre que una subida real)
  let contador = 0;
  const subir = (origen, nombreOriginal) => {
    fs.mkdirSync(DIR_DOCUMENTOS, { recursive: true });
    const filename = `doc-${Date.now()}${String(++contador).padStart(6, "0")}${path.extname(origen)}`;
    const destino = path.join(DIR_DOCUMENTOS, filename);
    fs.copyFileSync(origen, destino);
    return { fieldname: "", originalname: nombreOriginal, filename, path: destino };
  };
  const DIR_PERFILES = path.join(__dirname, "../public/img/licencias");
  const subirFoto = (archivo) => {
    const filename = `chofer-${Date.now()}${String(++contador).padStart(6, "0")}.webp`;
    fs.copyFileSync(path.join(__dirname, "../public/img/choferes-ejemplo", archivo), path.join(DIR_PERFILES, filename));
    return { fieldname: "imagen", originalname: archivo, filename, path: path.join(DIR_PERFILES, filename) };
  };
  const IMG_DNI = path.join(__dirname, "../public/img/licencias/dni.jpg");
  const IMG_LICENCIA = path.join(__dirname, "../public/img/licencias/licencia.jpg");
  const sinTildes = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // Identificadores que se van creando
  const ids = { veh: {}, cho: {}, rep: {}, herr: {}, sector: {}, operario: {}, prestamo: {} };
  const idVeh = (i) => ids.veh[i];
  const buscarUno = async (modelo, where, orden) => {
    const fila = await db[modelo].findOne({ where, order: orden || [] });
    if (!fila) throw new Error(`No se encontró ${modelo} ${JSON.stringify(where)}`);
    return fila;
  };

  const acciones = {
    ajustesBase: async () => {
      for (const nombre of DISTRITOS) await llamar(vehicleController.createDistrito, "admin", { body: { nombre } }, `Distrito ${nombre}`);
      for (const [desc, lic] of Object.entries(LICENCIAS_TIPO)) {
        const t = await db.TipoVehiculo.findOne({ where: { descripcion: desc } });
        if (!t) throw new Error(`Falta el tipo de vehículo "${desc}"`);
        if (t.licencias !== lic) await llamar(vehicleController.licenciasTipo, "admin", { params: { id: t.id_tipo }, body: { licencias: lic.split(",") } }, `Licencias ${desc}`);
      }
      fijarReloj(INICIO, "11:00");
      for (const nombre of TIPOS_SERVICIO) await llamar(vehicleController.createTipoServicio, "taller", { body: { nombre } }, `Tipo de servicio ${nombre}`);
      for (const [clave, r] of Object.entries(REPUESTOS)) {
        await llamar(vehicleController.createRepuesto, "taller", { body: { nombre: r.nombre, stock: String(r.stock), stock_minimo: String(r.minimo), costo_unitario: String(r.costo) } }, `Repuesto ${r.nombre}`);
        ids.rep[clave] = (await buscarUno("Repuesto", { nombre: r.nombre })).id_repuesto;
      }
      fijarReloj(INICIO, "12:00");
      for (const nombre of SECTORES) {
        await llamar(toolController.createSector, "taller", { body: { nombre } }, `Sector ${nombre}`);
        ids.sector[nombre] = (await buscarUno("Sector", { nombre })).id_sector;
      }
      for (const nombre of OPERARIOS) {
        await llamar(toolController.createOperario, "taller", { body: { nombre } }, `Operario ${nombre}`);
        ids.operario[nombre] = (await buscarUno("Operario", { nombre })).id_operario;
      }
    },
    altaChofer: async ({ c }) => {
      const x = CHOFERES[c];
      const nombreCompleto = `${x.nombre} ${x.apellido}`;
      const body = {
        nombre: x.nombre,
        apellido: x.apellido,
        dni: x.dni,
        telefono: x.tel,
        direccion: x.dir,
        email: `${sinTildes(x.nombre)}.${sinTildes(x.apellido)}@recursoshidricos.gob.ar`,
        fechaNacimiento: x.nacimiento,
        fechaIngreso: x.ingreso,
        "activo-inactivo": "Activo",
        Turno: x.turno,
        motivoBaja: "",
        fecha_inactivo: "",
        tiene_carnet_oficial: x.carnet ? "si" : "no",
        numero_licencia: `SDE-${x.dni}`,
        categoria: x.categoria,
        fecha_emision: x.emision,
        fecha_vencimiento: x.vto,
      };
      const files = { dni_archivos: [subir(IMG_DNI, `DNI ${nombreCompleto} - frente.jpg`), subir(IMG_DNI, `DNI ${nombreCompleto} - dorso.jpg`)] };
      if (x.carnet) {
        files.carnet_frente = [subir(IMG_LICENCIA, `Carnet oficial ${nombreCompleto} - frente.jpg`)];
        files.carnet_dorso = [subir(IMG_LICENCIA, `Carnet oficial ${nombreCompleto} - dorso.jpg`)];
      }
      if (x.foto) files.imagen = [subirFoto(x.foto)];
      // Mismas validaciones que el formulario (express-validator) y después el mismo controlador
      const req0 = { body, files, params: {} };
      await Promise.all(choferVAlidation().map((regla) => regla.run(req0)));
      const errores = validationResult(req0);
      if (!errores.isEmpty()) throw new Error(`Chofer ${nombreCompleto}: ${errores.array().map((e) => e.msg).join(" · ")}`);
      const handler = async (req, res) => {
        Object.assign(req, req0, { session: req.session, flash: req.flash });
        return choferController.processChofer(req, res);
      };
      await llamar(handler, "admin", { body, files }, `Alta chofer ${nombreCompleto}`);
      ids.cho[c] = (await buscarUno("Chofer", { dni: x.dni })).id_chofer;
    },
    altaVehiculo: async ({ v, segVto, rtoVto }) => {
      const x = VEHICULOS[v];
      const tipo = await buscarUno("TipoVehiculo", { descripcion: x.tipo });
      const body = {
        patente: x.patente,
        id_tipo: String(tipo.id_tipo),
        marca: x.marca,
        modelo: x.modelo,
        anio: String(x.anio),
        chasis: `8A${x.marca.slice(0, 3).toUpperCase()}${x.anio}${String(510230 + v * 7919)}`,
        num_motor: `MT${String(4402100 + v * 30517)}`,
        combustible: x.combustible,
        transmision: x.transmision,
        estado_actual: "Disponible",
        km_actual: String(x.km),
        distrito: x.distrito,
        observaciones: x.km === 0 ? "Unidad 0 km." : "",
        fecha_alta: x.fechaAlta,
        cedula_numero: `CED-${String(40112300 + v * 1013)}`,
        cedula_titular: "Administración Provincial de Recursos Hídricos",
        seguro_compania: x.seguro,
        seguro_vencimiento: segVto,
        rto_vencimiento: rtoVto || "",
        tiene_documentacion: "no",
      };
      await llamar(vehicleController.processVehicle, "admin", { body, files: {} }, `Alta vehículo ${x.patente}`);
      ids.veh[v] = (await buscarUno("Vehiculo", { patente: x.patente })).id_vehiculo;
    },
    asignar: async ({ v, c, km, destino, obs }, fecha) => {
      await llamar(assignmentController.create, "supervisor", { body: { id_vehiculo: String(idVeh(v)), id_chofer: String(ids.cho[c]), fecha_desde: fecha, km_salida: String(km), destino, observaciones: obs } }, `Asignación ${VEHICULOS[v].patente}`);
    },
    devolver: async ({ v }) => {
      const a = await buscarUno("AsignacionVehiculo", { id_vehiculo: idVeh(v), estado: "Activo" });
      await llamar(assignmentController.finalize, "supervisor", { params: { id: String(a.id_asignacion) } }, `Devolución ${VEHICULOS[v].patente}`);
    },
    km: async ({ v, km, obs }, fecha) => {
      await llamar(vehicleController.processActualizarKm, "supervisor", { body: { id_vehiculo: String(idVeh(v)), km_nuevo: String(km), fecha_actualizacion: fecha, observaciones: obs } }, `Km ${VEHICULOS[v].patente}`);
    },
    programar: async ({ v, km }) => {
      const x = VEHICULOS[v];
      await llamar(vehicleController.processMaintenance, "taller", { body: { id_vehiculo: String(idVeh(v)), estado: "Programado", tipo_servicio: "Service (aceite y filtros)", km_programado: String(km), descripcion: `Service de ${miles(km)} km programado`, taller: x.taller } }, `Programado ${x.patente}`);
    },
    iniciarProgramado: async ({ v, objetivo }) => {
      const m = await buscarUno("Mantenimiento", { id_vehiculo: idVeh(v), estado: "Programado", proximo_km: objetivo });
      await llamar(vehicleController.updateEstadoMantenimiento, "taller", { params: { id: String(m.id_mantenimiento) }, body: { estado: "En proceso" } }, `Inicio service ${VEHICULOS[v].patente}`);
    },
    abrirOrden: async ({ v, tipo, km, descripcion, taller }, fecha) => {
      await llamar(vehicleController.processMaintenance, "taller", { body: { id_vehiculo: String(idVeh(v)), estado: "En proceso", tipo_servicio: tipo, fecha_inicio: fecha, km_servicio: String(km), descripcion, taller, mano_obra: "" } }, `Orden ${tipo} ${VEHICULOS[v].patente}`);
    },
    cerrarOrden: async ({ v, km, lineas, mano, taller, proximo, descripcion, observaciones, admin }) => {
      const m = await buscarUno("Mantenimiento", { id_vehiculo: idVeh(v), estado: "En proceso" });
      const body = {
        estado: "Realizado",
        km_servicio: String(km),
        descripcion,
        observaciones: observaciones || "",
        proximo_servicio_km: proximo ? String(proximo) : "",
        mano_obra: String(mano),
        taller,
        id_repuesto: lineas.map(([k]) => String(ids.rep[k])),
        cantidad: lineas.map(([, n]) => String(n)),
        costo_unitario: lineas.map(([k]) => String(REPUESTOS[k].costo)),
        ...admin,
      };
      await llamar(vehicleController.updateEstadoMantenimiento, "taller", { params: { id: String(m.id_mantenimiento) }, body }, `Cierre orden ${VEHICULOS[v].patente}`);
    },
    ordenRealizada: async ({ v, tipo, km, taller, mano, descripcion, admin }, fecha) => {
      await llamar(vehicleController.processMaintenance, "taller", { body: { id_vehiculo: String(idVeh(v)), estado: "Realizado", tipo_servicio: tipo, fecha_inicio: fecha, km_servicio: String(km), descripcion, taller, mano_obra: String(mano), ...admin } }, `${tipo} ${VEHICULOS[v].patente}`);
    },
    reponer: async ({ clave, cantidad }) => {
      await llamar(vehicleController.ajustarRepuesto, "taller", { params: { id: String(ids.rep[clave]) }, body: { cantidad: String(cantidad), stock_minimo: "" } }, `Reposición ${REPUESTOS[clave].nombre}`);
    },
    renovar: async ({ v, seguro, rto }) => {
      const x = await db.Vehiculo.findByPk(idVeh(v));
      const iso = (f) => (f ? String(f).slice(0, 10) : "");
      const body = {
        estado_actual: x.estado_actual,
        km_actual: String(x.km_actual),
        distrito: x.distrito || "",
        observaciones: x.observaciones || "",
        combustible: x.combustible || "",
        transmision: x.transmision || "",
        cedula_numero: x.cedula_numero || "",
        cedula_titular: x.cedula_titular || "",
        seguro_compania: x.seguro_compania || "",
        seguro_vencimiento: seguro || iso(x.seguro_vencimiento),
        rto_vencimiento: rto || iso(x.rto_vencimiento),
        fecha_baja: "",
      };
      await llamar(vehicleController.processEditVehiculo, "admin", { params: { id: String(idVeh(v)) }, body, files: {} }, `Renovación ${x.patente}`);
    },
    siniestro: async ({ v, c, ubicacion, relato, danos, tercero }, fecha) => {
      await llamar(
        siniestroController.ProcesoCarga,
        "supervisor",
        {
          body: {
            id_vehiculo: String(idVeh(v)),
            id_chofer: c === null ? "" : String(ids.cho[c]),
            fecha_siniestro: fecha,
            ubicacion,
            descripcion: relato,
            danos_vehiculo: danos,
            tercero_vehiculo: tercero.vehiculo || "",
            tercero_seguro: tercero.seguro || "",
            tercero_conductor: tercero.conductor || "",
            tercero_contacto: tercero.contacto || "",
          },
          files: [],
        },
        `Siniestro ${VEHICULOS[v].patente}`,
      );
    },
    resolverSiniestro: async ({ v }) => {
      const s = await buscarUno("Siniestro", { id_vehiculo: idVeh(v), estado: "EN PROCESO" });
      await llamar(siniestroController.CambiarEstado, "supervisor", { params: { id: String(s.id_siniestro) }, body: { estado: "RESUELTO" } }, `Resolución siniestro ${VEHICULOS[v].patente}`);
    },
    desactivarChofer: async ({ c, estado, motivo }, fecha) => {
      await llamar(choferController.desactivarChofer, "admin", { params: { id: String(ids.cho[c]) }, body: { estado, motivoBaja: motivo, fecha_inactivo: fecha } }, `Novedad chofer ${CHOFERES[c].nombre}`);
    },
    altaHerramienta: async ({ i }, fecha) => {
      const x = HERRAMIENTAS[i];
      await llamar(toolController.processTool, "taller", { body: { codigo_activo: x.codigo, nombre: x.nombre, sector: x.sector, stock: String(x.stock), estado: "Disponible", combustible_energia: x.energia, observaciones: "", fecha_alta: fecha } }, `Herramienta ${x.codigo}`);
      ids.herr[x.codigo] = (await buscarUno("Herramienta", { codigo_activo: x.codigo })).id_herramienta;
    },
    prestar: async ({ clave, codigo, operario, sector, estimada, obs }, fecha) => {
      await llamar(toolController.processPrestamo, "taller", { body: { id_herramienta: String(ids.herr[codigo]), id_operario: String(ids.operario[operario]), id_sector_destino: String(ids.sector[sector]), fecha_salida: fecha, fecha_devolucion_estimada: estimada, observaciones_entrega: obs } }, `Préstamo ${codigo}`);
      ids.prestamo[clave] = (await buscarUno("Prestamo", { id_herramienta: ids.herr[codigo], estado_prestamo: "Activo" }, [["id_prestamo", "DESC"]])).id_prestamo;
    },
    devolverHerramienta: async ({ clave, codigo }) => {
      await llamar(toolController.processDevolucion, "taller", { body: { id_herramienta: String(ids.herr[codigo]), id_prestamo: String(ids.prestamo[clave]) } }, `Devolución ${codigo}`);
    },
    alertas: async () => alertaService.generarTodas(),
  };

  try {
    const orden = [...plan.hechos].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora) || a.n - b.n);
    let anio = null;
    global.Date = FechaSimulada;
    for (const h of orden) {
      if (h.fecha.slice(0, 4) !== anio) {
        anio = h.fecha.slice(0, 4);
        console.log(`  · Registrando ${anio}...`);
      }
      fijarReloj(h.fecha, h.hora);
      await acciones[h.tipo](h.datos, h.fecha);
    }
    relojReal();
    global.Date = FechaReal;
    await alertaService.generarTodas();

    const [[r]] = await db.sequelize.query(
      `SELECT (SELECT COUNT(*) FROM chofer) choferes, (SELECT COUNT(*) FROM vehiculo) vehiculos, (SELECT COUNT(*) FROM asignacion_vehiculo) asignaciones,
              (SELECT COUNT(*) FROM historial_km) lecturas_km, (SELECT COUNT(*) FROM mantenimiento) mantenimientos, (SELECT COUNT(*) FROM siniestro) siniestros,
              (SELECT COUNT(*) FROM herramienta) herramientas, (SELECT COUNT(*) FROM prestamo) prestamos, (SELECT COUNT(*) FROM repuestos) repuestos,
              (SELECT COUNT(*) FROM tipos_servicio) tipos_servicio, (SELECT COUNT(*) FROM distritos) distritos, (SELECT COUNT(*) FROM alerta) alertas,
              (SELECT COUNT(*) FROM auditoria) auditoria, (SELECT COUNT(*) FROM usuario) usuarios`,
    );
    console.log("");
    console.log("  ✅ Datos de prueba cargados:");
    for (const [k, n] of Object.entries(r)) console.log(`     · ${String(n).padStart(4)} ${k.replace("_", " ")}`);
    console.log("");
    console.log("  Los usuarios y sus contraseñas no se modificaron.");
    console.log("");
  } finally {
    relojReal();
    global.Date = FechaReal;
    await db.sequelize.close();
  }
})().catch((e) => {
  relojReal();
  global.Date = FechaReal;
  console.error("");
  console.error("  [ERROR] " + e.message);
  console.error("  No se completó la carga. Revisá el mensaje, corregí y volvé a ejecutar el comando.");
  console.error("");
  process.exit(1);
});
