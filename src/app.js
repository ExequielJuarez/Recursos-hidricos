// La zona horaria se fija ANTES de cargar cualquier otra cosa: fechas, auditoría y alertas
// se calculan siempre en hora de Argentina, sin importar dónde corra el servidor.
process.env.TZ = process.env.TZ || "America/Argentina/Buenos_Aires";

require("dotenv").config({ quiet: true });
const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const cron = require("node-cron");

const db = require("./model/database/models");
const alertaService = require("./data/alertaService");
const { prepararBaseDeDatos } = require("./model/database/preparar");
const { safeJson, escapeHtml } = require("./utils/html");
const fechas = require("./utils/fechas");
const { asegurarToken, verificarToken } = require("./middlewares/csrfMiddleware");
const flashMiddleware = require("./middlewares/flashMiddleware");

const app = express();
const esProduccion = process.env.NODE_ENV === "production";

const indexRouter = require("./routes/index.Routes");

const puerto = Number(process.env.PORT) || 3000;

if (esProduccion && !process.env.SESSION_SECRET) {
  throw new Error("Falta la variable de entorno SESSION_SECRET (necesaria en producción).");
}
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-solo-para-desarrollo-local";

app.disable("x-powered-by");
if (esProduccion) app.set("trust proxy", 1);

app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(methodOverride("_method"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.safeJson = safeJson;
app.locals.escapeHtml = escapeHtml;
// Fechas "solo día" (YYYY-MM-DD) sin corrimiento por zona horaria, y días que faltan hasta una fecha
app.locals.fmtFecha = (valor) => {
  if (!valor) return "—";
  const iso = fechas.aISO(valor);
  const [y, m, d] = iso.split("-");
  return d ? `${Number(d)}/${Number(m)}/${y}` : "—";
};
app.locals.fmtMoneda = (n) => "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
// Unidad de uso del vehículo ("km" u "hs" para maquinaria) y número formateado con su unidad
app.locals.unidadDe = (v) => (v && v.TipoVehiculo && v.TipoVehiculo.unidad) || "km";
app.locals.fmtUso = (n, v) => Number(n || 0).toLocaleString("es-AR") + " " + app.locals.unidadDe(v);
app.locals.diasHasta = fechas.diasHasta;
app.locals.aISO = fechas.aISO;

// Cabeceras de seguridad básicas
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

// Las sesiones se guardan en la base de datos (persisten entre reinicios y no llenan la memoria)
const sessionStore = new SequelizeStore({
  db: db.sequelize,
  tableName: "sessions",
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 8 * 60 * 60 * 1000,
});

app.use(
  session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // Cookie solo por HTTPS en producción. COOKIE_SECURE=false permite usar el sistema por http (red local);
      // COOKIE_SECURE=auto la marca segura solo cuando la conexión llega por HTTPS (túnel + acceso local por http)
      secure: process.env.COOKIE_SECURE === "auto" ? "auto" : process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : esProduccion,
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

// Evita que el navegador muestre páginas privadas desde caché después de cerrar sesión
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(asegurarToken);
app.use(verificarToken);
app.use(flashMiddleware);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.usuarioLocal = req.session.usuarioLogueado || null;
  next();
});

app.get("/favicon.ico", (req, res) => res.status(204).end());

app.use("/", indexRouter);

// 404
app.use((req, res) => {
  res.status(404).send(
    "<div style='font-family:sans-serif;padding:40px;text-align:center'><h2>Página no encontrada</h2><p>La dirección que buscás no existe.</p><a href='/'>Volver al inicio</a></div>",
  );
});

// Errores no controlados (incluye errores de subida de archivos)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Error no controlado:", err);
  const esSubida = err && (err.name === "MulterError" || err.codigoSubida);
  const mensaje = esSubida
    ? err.message
    : "Ocurrió un error inesperado. Intentá nuevamente.";
  if (esSubida && req.session && req.headers.referer) {
    req.flash("error", mensaje);
    return res.redirect(req.headers.referer);
  }
  res.status(esSubida ? 400 : 500).send(
    `<div style='font-family:sans-serif;padding:40px;text-align:center'><h2>${escapeHtml(mensaje)}</h2><a href="javascript:history.back()">Volver</a></div>`,
  );
});

const generarAlertas = async () => {
  await alertaService.generarTodas();
};

const iniciar = async () => {
  try {
    // Crea la base y las tablas si hace falta (primera vez en una máquina nueva)
    await prepararBaseDeDatos();

    await db.sequelize.authenticate();
    console.log("✅ Conexión a la base de datos MySQL establecida con éxito.");

    await db.sequelize.sync({ force: false });
    await sessionStore.sync();

    // Migración única: el estado "Pendiente" de los mantenimientos pasó a llamarse "Programado"
    await db.Mantenimiento.update({ estado: "Programado" }, { where: { estado: "Pendiente" } });

    console.log("🔔 Generando alertas iniciales...");
    await generarAlertas();

    // ── CRON: TODOS LOS DÍAS A LAS 6AM ───────────────────────
    cron.schedule("0 6 * * *", async () => {
      console.log("🔔 Generando alertas automáticas diarias...");
      await generarAlertas();
    });

    app.listen(puerto, () => {
      console.log(`🚀 Servidor Express corriendo en el puerto ${puerto}`);
    });
  } catch (error) {
    console.error("❌ Error al iniciar la aplicación:", error);
    process.exit(1);
  }
};

if (require.main === module) {
  iniciar();
}

module.exports = { app, iniciar };
