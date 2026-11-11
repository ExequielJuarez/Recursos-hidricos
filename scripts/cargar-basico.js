// Deja el sistema LIMPIO y carga sólo 10 vehículos, 10 choferes y 10 herramientas (con sus ajustes) de ejemplo.
//   npm run db:basico -- --confirmar
//
// · NO toca usuarios, roles ni contraseñas (quedan como estaban), ni los tipos de vehículo.
// · Borra todo lo demás: vehículos, choferes, mantenimientos, repuestos, asignaciones, siniestros, herramientas,
//   préstamos, documentos, alertas, auditoría y los catálogos (distritos, sectores y operarios).
// · Cada vehículo y cada chofer se da de alta con las MISMAS validaciones y funciones que usa el programa al guardar
//   el formulario: si alguno no las pasara, el script se detiene antes de guardarlo.
// · Todos quedan "Disponible" / "Activo", con documentación y licencias vigentes (sin alertas).
process.env.TZ = process.env.TZ || "America/Argentina/Buenos_Aires";
require("dotenv").config({ quiet: true });

const base = process.env.DB_NAME || "vehiculos_db";
if (!process.argv.includes("--confirmar")) {
  console.log("");
  console.log(`  Esto BORRA todos los datos cargados en la base "${base}" (menos usuarios, roles y tipos de vehículo)`);
  console.log("  y carga 10 vehículos y 10 choferes de ejemplo.");
  console.log("  Para continuar ejecutá:  npm run db:basico -- --confirmar");
  console.log("");
  process.exit(1);
}

const { validationResult } = require("express-validator");
const { prepararBaseDeDatos } = require("../src/model/database/preparar");
const { limpiarDatos } = require("../src/model/database/limpieza");

const pad = (n) => String(n).padStart(2, "0");
// Fecha local (YYYY-MM-DD) desplazada `dias` días desde hoy
const fecha = (dias) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const AÑO = 365;

// Distritos que usan los vehículos (el formulario los elige de este catálogo)
const DISTRITOS = ["Capital", "Rawson", "Pocito", "Chimbas", "Rivadavia", "Caucete"];

// Ajustes de Herramientas: sectores (destino de herramientas y préstamos) y operarios (responsables de los préstamos)
// Tipos de servicio de mantenimiento (Mantenimientos → Repuestos / Servicios): se eligen de esta lista al registrar una orden
const TIPOS_SERVICIO = [
  "Service (aceite y filtros)",
  "Cambio de pastillas de freno",
  "Cambio de discos y pastillas",
  "Alineación y balanceo",
  "Cambio de neumáticos",
  "Cambio de batería",
  "Reparación eléctrica",
  "Cambio de embrague",
  "Cambio de correa de distribución",
  "Chapa y pintura",
  "Service de maquinaria (horas)",
];

const SECTORES = ["Taller Central", "Riego", "Obras Hidráulicas", "Canales y Desagües", "Hidrometría", "Administración"];
const OPERARIOS = ["Héctor Quiroga", "Ramón Videla", "Nicolás Castro", "Sergio Olivera", "Mariano Godoy", "Fabián Peralta", "Esteban Navarro", "Julio Aguilera"];

// Herramientas (stock = unidades totales del pañol; todas quedan en pañol, sin préstamos)
const HERRAMIENTAS = [
  { codigo: "HR-001", nombre: "Motoguadaña Stihl FS 280", sector: "Canales y Desagües", stock: 3, energia: "Nafta" },
  { codigo: "HR-002", nombre: "Motosierra Husqvarna 445", sector: "Canales y Desagües", stock: 2, energia: "Nafta" },
  { codigo: "HR-003", nombre: "Generador Honda 5 kVA", sector: "Obras Hidráulicas", stock: 1, energia: "Nafta" },
  { codigo: "HR-004", nombre: "Motobomba 3\" Honda WB30", sector: "Riego", stock: 2, energia: "Nafta" },
  { codigo: "HR-005", nombre: "Amoladora Bosch 9\"", sector: "Taller Central", stock: 4, energia: "Eléctrica" },
  { codigo: "HR-006", nombre: "Taladro percutor Makita", sector: "Taller Central", stock: 3, energia: "Eléctrica" },
  { codigo: "HR-007", nombre: "Soldadora inverter 200A", sector: "Taller Central", stock: 1, energia: "Eléctrica" },
  { codigo: "HR-008", nombre: "Hidrolavadora Kärcher HD 6/15", sector: "Taller Central", stock: 1, energia: "Eléctrica" },
  { codigo: "HR-009", nombre: "Molinete hidrométrico OTT C31", sector: "Hidrometría", stock: 2, energia: "Manual" },
  { codigo: "HR-010", nombre: "Nivel óptico automático", sector: "Obras Hidráulicas", stock: 2, energia: "Manual" },
];

// Opciones válidas del formulario de vehículos: combustible Diesel/Nafta/Electrico, transmisión Manual/Automática
const VEHICULOS = [
  { patente: "AE101AA", tipo: "Camioneta", marca: "Toyota", modelo: "Hilux 2.8 SRV 4x4", anio: 2022, combustible: "Diesel", transmision: "Manual", km: 64200, distrito: "Capital", seguro: "La Segunda" },
  { patente: "AE202BB", tipo: "Camioneta", marca: "Ford", modelo: "Ranger XLT 3.2", anio: 2021, combustible: "Diesel", transmision: "Manual", km: 88750, distrito: "Rawson", seguro: "Federación Patronal" },
  { patente: "AF303CC", tipo: "Camioneta", marca: "Volkswagen", modelo: "Amarok V6 Highline", anio: 2023, combustible: "Diesel", transmision: "Automática", km: 31400, distrito: "Chimbas", seguro: "Sancor Seguros" },
  { patente: "AD404DD", tipo: "Camión", marca: "Mercedes-Benz", modelo: "Atego 1726", anio: 2019, combustible: "Diesel", transmision: "Manual", km: 186300, distrito: "Pocito", seguro: "Sancor Seguros" },
  { patente: "AF505EE", tipo: "Utilitario", marca: "Fiat", modelo: "Strada Volcano 1.3", anio: 2023, combustible: "Nafta", transmision: "Manual", km: 22800, distrito: "Rivadavia", seguro: "Federación Patronal" },
  { patente: "AE606FF", tipo: "Utilitario", marca: "Renault", modelo: "Kangoo II Express", anio: 2021, combustible: "Nafta", transmision: "Manual", km: 57900, distrito: "Capital", seguro: "Provincia Seguros" },
  { patente: "AF707GG", tipo: "Auto", marca: "Toyota", modelo: "Corolla XEI 2.0 CVT", anio: 2023, combustible: "Nafta", transmision: "Automática", km: 26100, distrito: "Capital", seguro: "La Segunda" },
  { patente: "AG808HH", tipo: "Auto", marca: "Peugeot", modelo: "208 Allure 1.6", anio: 2024, combustible: "Nafta", transmision: "Manual", km: 9800, distrito: "Rawson", seguro: "La Segunda" },
  { patente: "A909JJK", tipo: "Motocicleta", marca: "Honda", modelo: "XR 150L", anio: 2022, combustible: "Nafta", transmision: "Manual", km: 14300, distrito: "Chimbas", seguro: "Rivadavia Seguros" },
  { patente: "MAQ010", tipo: "Maquinaria Pesada", marca: "Caterpillar", modelo: "Retroexcavadora 416F", anio: 2020, combustible: "Diesel", transmision: "Manual", km: 4210, distrito: "Caucete", seguro: "Provincia Seguros" },
];

// Categorías válidas del formulario: A, B, B1, B2, C, D, E, G. Turnos: Mañana, Tarde, Tarde/Noche, Noche.
const CHOFERES = [
  { nombre: "Carlos", apellido: "Rodríguez", dni: "28456123", telefono: "2645101001", categoria: "B1", turno: "Mañana", carnet: true, edad: 44 },
  { nombre: "María", apellido: "González", dni: "31789456", telefono: "2645101002", categoria: "B1", turno: "Mañana", carnet: false, edad: 38 },
  { nombre: "Jorge", apellido: "Fernández", dni: "25123789", telefono: "2645101003", categoria: "E", turno: "Tarde", carnet: true, edad: 51 },
  { nombre: "Laura", apellido: "Martínez", dni: "33456789", telefono: "2645101004", categoria: "B2", turno: "Tarde", carnet: false, edad: 34 },
  { nombre: "Diego", apellido: "López", dni: "29876543", telefono: "2645101005", categoria: "C", turno: "Mañana", carnet: true, edad: 42 },
  { nombre: "Ana", apellido: "Pérez", dni: "35234567", telefono: "2645101006", categoria: "B1", turno: "Tarde/Noche", carnet: false, edad: 31 },
  { nombre: "Ricardo", apellido: "Sánchez", dni: "22345678", telefono: "2645101007", categoria: "D", turno: "Mañana", carnet: true, edad: 56 },
  { nombre: "Sofía", apellido: "Romero", dni: "36789012", telefono: "2645101008", categoria: "B1", turno: "Noche", carnet: false, edad: 29 },
  { nombre: "Lucía", apellido: "Torres", dni: "34567123", telefono: "2645101009", categoria: "A", turno: "Mañana", carnet: true, edad: 33 },
  { nombre: "Pablo", apellido: "Álvarez", dni: "30123456", telefono: "2645101010", categoria: "G", turno: "Tarde", carnet: true, edad: 40 },
];

const sinTildes = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "Sube" un archivo de ejemplo a la carpeta de documentos con el mismo formato de nombre que usa el programa (doc-<n>.ext)
// y devuelve el objeto que entrega multer, para que el alta lo guarde igual que si se hubiera cargado desde el formulario.
const fs = require("fs");
const path = require("path");
const { DIR_DOCUMENTOS } = require("../src/utils/documentos");
const IMG_DNI = path.join(__dirname, "../public/img/licencias/dni.jpg");
const IMG_LICENCIA = path.join(__dirname, "../public/img/licencias/licencia.jpg");
// Fotos de perfil de ejemplo para 3 choferes (el resto queda con la imagen "sin foto" hasta que se edite)
const FOTOS_EJEMPLO = { 0: "chofer-ejemplo-1.webp", 2: "chofer-ejemplo-2.webp", 4: "chofer-ejemplo-3.webp" };
const DIR_PERFILES = path.join(__dirname, "../public/img/licencias");
const subirFotoPerfil = (archivo) => {
  const filename = `chofer-${Date.now()}${String(++contador).padStart(6, "0")}.webp`; // mismo formato que una foto subida
  fs.copyFileSync(path.join(__dirname, "../public/img/choferes-ejemplo", archivo), path.join(DIR_PERFILES, filename));
  return { fieldname: "imagen", originalname: archivo, filename, path: path.join(DIR_PERFILES, filename) };
};
let contador = 0;
const subir = (origen, nombreOriginal) => {
  fs.mkdirSync(DIR_DOCUMENTOS, { recursive: true });
  const filename = `doc-${Date.now()}${String(++contador).padStart(6, "0")}${path.extname(origen)}`;
  const destino = path.join(DIR_DOCUMENTOS, filename);
  fs.copyFileSync(origen, destino);
  return { fieldname: "", originalname: nombreOriginal, filename, path: destino };
};

(async () => {
  console.log("");
  console.log("  Preparando la base y borrando los datos cargados...");
  await prepararBaseDeDatos();
  const { tablas } = await limpiarDatos({ catalogos: true });
  console.log(`  · Tablas vaciadas: ${tablas.length} (usuarios, roles y tipos de vehículo se conservan)`);

  // Los modelos y servicios se cargan después de preparar la base
  const db = require("../src/model/database/models");
  const vehicleService = require("../src/data/vehicleService");
  const choferService = require("../src/data/choferService");
  const alertaService = require("../src/data/alertaService");
  const { choferVAlidation, choferEditValidation } = require("../src/validations/choferValidation");

  try {
    for (const nombre of DISTRITOS) await db.Distrito.create({ nombre });

    const tipos = await db.TipoVehiculo.findAll();
    const idTipo = (descripcion) => {
      const t = tipos.find((x) => x.descripcion === descripcion);
      if (!t) throw new Error(`Falta el tipo de vehículo "${descripcion}" en la base.`);
      return t.id_tipo;
    };

    // ── Vehículos: misma validación y alta que el formulario "Alta de vehículo"
    for (const [i, v] of VEHICULOS.entries()) {
      const body = {
        patente: v.patente,
        id_tipo: String(idTipo(v.tipo)),
        marca: v.marca,
        modelo: v.modelo,
        anio: String(v.anio),
        chasis: `8A${v.marca.slice(0, 3).toUpperCase()}${v.anio}${String(510230 + i * 7919)}`,
        num_motor: `MT${String(4402100 + i * 30517)}`,
        combustible: v.combustible,
        transmision: v.transmision,
        estado_actual: "Disponible",
        km_actual: String(v.km),
        distrito: v.distrito,
        observaciones: "",
        fecha_alta: `${Math.min(v.anio + 1, new Date().getFullYear())}-03-${pad(10 + i)}`,
        cedula_numero: `CED-${String(40112300 + i * 1013)}`,
        cedula_titular: "Administración Provincial de Recursos Hídricos",
        seguro_compania: v.seguro,
        seguro_vencimiento: fecha(120 + i * 23), // vigente (más de 30 días: sin alertas)
        rto_vencimiento: v.tipo === "Maquinaria Pesada" ? "" : fecha(90 + i * 31),
      };
      const errores = await vehicleService.validarAlta(body);
      if (errores.length) throw new Error(`Vehículo ${v.patente} no pasa las validaciones del programa: ${errores.join(" ")}`);
      await vehicleService.create({ body, files: {} });
    }
    console.log(`  · Vehículos cargados: ${VEHICULOS.length}`);

    // ── Choferes: mismas validaciones (alta y edición) y misma alta que el formulario "Nuevo chofer"
    for (const [i, c] of CHOFERES.entries()) {
      const body = {
        nombre: c.nombre,
        apellido: c.apellido,
        dni: c.dni,
        telefono: c.telefono,
        direccion: `${["Av. Libertador", "Calle Mendoza", "Av. Rioja", "Calle Tucumán", "Av. Ignacio de la Roza"][i % 5]} ${320 + i * 115} (O)`,
        email: `${sinTildes(c.nombre)}.${sinTildes(c.apellido)}@recursoshidricos.gob.ar`,
        fechaNacimiento: fecha(-(c.edad * AÑO + 40 + i * 17)),
        fechaIngreso: fecha(-(AÑO * (2 + (i % 7)) + i * 11)),
        "activo-inactivo": "Activo",
        Turno: c.turno,
        motivoBaja: "",
        tiene_carnet_oficial: c.carnet ? "si" : "no",
        numero_licencia: `L-${c.dni}`,
        categoria: c.categoria,
        fecha_emision: fecha(-(AÑO + i * 45)),
        fecha_vencimiento: fecha(AÑO * 3 + i * 40), // vigente (sin alertas)
      };
      // Documentación obligatoria del alta (igual que el formulario): DNI frente y dorso; carnet frente y dorso si tiene carnet oficial
      const nombreCompleto = `${c.nombre} ${c.apellido}`;
      const files = {
        dni_archivos: [subir(IMG_DNI, `DNI ${nombreCompleto} - frente.jpg`), subir(IMG_DNI, `DNI ${nombreCompleto} - dorso.jpg`)],
      };
      if (c.carnet) {
        files.carnet_frente = [subir(IMG_LICENCIA, `Carnet oficial ${nombreCompleto} - frente.jpg`)];
        files.carnet_dorso = [subir(IMG_LICENCIA, `Carnet oficial ${nombreCompleto} - dorso.jpg`)];
      }

      if (FOTOS_EJEMPLO[i]) files.imagen = [subirFotoPerfil(FOTOS_EJEMPLO[i])];

      const req = { body: { ...body }, files, params: {}, session: null };
      await Promise.all(choferVAlidation().map((regla) => regla.run(req)));
      const errores = validationResult(req);
      if (!errores.isEmpty()) {
        throw new Error(`Chofer ${nombreCompleto} no pasa las validaciones del programa: ${errores.array().map((e) => e.msg).join(" · ")}`);
      }
      if (files.dni_archivos.length < 2) throw new Error(`Chofer ${nombreCompleto}: falta el DNI (frente y dorso).`);
      if (c.carnet && (!files.carnet_frente.length || !files.carnet_dorso.length)) throw new Error(`Chofer ${nombreCompleto}: falta el carnet oficial.`);
      const nuevo = await choferService.create(req);

      // Que también se pueda editar sin errores desde el programa
      const reqEdit = { body: { ...body }, files: {}, params: { id: String(nuevo.id_chofer) }, session: null };
      await Promise.all(choferEditValidation().map((regla) => regla.run(reqEdit)));
      const erroresEdit = validationResult(reqEdit);
      if (!erroresEdit.isEmpty()) {
        throw new Error(`Chofer ${c.nombre} ${c.apellido} no pasaría la edición: ${erroresEdit.array().map((e) => e.msg).join(" · ")}`);
      }
    }
    console.log(`  · Choferes cargados: ${CHOFERES.length} (cada uno con su licencia, DNI y, si corresponde, carnet oficial)`);

    // ── Ajustes de herramientas y herramientas (misma validación y alta que "Carga nueva")
    for (const nombre of TIPOS_SERVICIO) await db.TipoServicio.create({ nombre });
    console.log(`  · Tipos de servicio de mantenimiento: ${TIPOS_SERVICIO.length}`);
    for (const nombre of SECTORES) await db.Sector.create({ nombre });
    for (const nombre of OPERARIOS) await db.Operario.create({ nombre, estado: "Activo" });
    const toolService = require("../src/data/toolService");
    for (const [i, h] of HERRAMIENTAS.entries()) {
      await toolService.create({
        body: {
          codigo_activo: h.codigo,
          nombre: h.nombre,
          sector: h.sector,
          stock: String(h.stock),
          fecha_alta: fecha(-(400 - i * 30)),
          estado: "Disponible",
          combustible_energia: h.energia,
          observaciones: "",
        },
      });
    }
    console.log(`  · Ajustes de herramientas: ${SECTORES.length} sectores y ${OPERARIOS.length} operarios`);
    console.log(`  · Herramientas cargadas: ${HERRAMIENTAS.length}`);

    await alertaService.generarTodas();
    const [[resumen]] = await db.sequelize.query(
      "SELECT (SELECT COUNT(*) FROM vehiculo) vehiculos, (SELECT COUNT(*) FROM chofer) choferes, (SELECT COUNT(*) FROM licencia_chofer) licencias, (SELECT COUNT(*) FROM documento_adjunto) documentos, (SELECT COUNT(*) FROM distritos) distritos, (SELECT COUNT(*) FROM herramienta) herramientas, (SELECT COUNT(*) FROM sectores) sectores, (SELECT COUNT(*) FROM operarios) operarios, (SELECT COUNT(*) FROM alerta) alertas, (SELECT COUNT(*) FROM usuario) usuarios",
    );
    console.log("");
    console.log("  ✅ Sistema limpio con los datos básicos:");
    for (const [k, n] of Object.entries(resumen)) console.log(`     · ${String(n).padStart(3)} ${k}`);
    console.log("");
    console.log("  Los usuarios y sus contraseñas no se modificaron.");
    console.log("");
  } finally {
    await db.sequelize.close();
  }
})().catch((e) => {
  console.error("");
  console.error("  [ERROR] " + e.message);
  console.error("  No se completó la carga. Revisá el mensaje, corregí y volvé a ejecutar el comando.");
  console.error("");
  process.exit(1);
});
