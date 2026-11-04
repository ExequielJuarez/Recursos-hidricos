// Protección CSRF con token por sesión.
// - Formularios urlencoded: campo oculto `_csrf` (lo agrega public/js/csrf.js).
// - Formularios multipart y fetch: cabecera `x-csrf-token` o query `?_csrf=`.
const crypto = require("crypto");

const METODOS_SEGUROS = ["GET", "HEAD", "OPTIONS"];

const asegurarToken = (req, res, next) => {
  if (req.session) {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    res.locals.csrfToken = req.session.csrfToken;
  } else {
    res.locals.csrfToken = "";
  }
  next();
};

const comparar = (a, b) => {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  return bufA.length === bufB.length && bufA.length > 0 && crypto.timingSafeEqual(bufA, bufB);
};

const verificarToken = (req, res, next) => {
  if (METODOS_SEGUROS.includes(req.method)) return next();

  const recibido =
    req.headers["x-csrf-token"] || (req.query && req.query._csrf) || (req.body && req.body._csrf);

  if (req.session && comparar(recibido, req.session.csrfToken)) return next();

  const quiereJson = String(req.headers.accept || "").includes("application/json") || req.xhr;
  if (quiereJson) return res.status(403).json({ ok: false, error: "Token de seguridad inválido. Recargá la página." });
  return res
    .status(403)
    .send(
      "<div style='font-family:sans-serif;padding:40px;text-align:center'><h2>La sesión de seguridad expiró</h2><p>Recargá la página e intentá nuevamente.</p><a href='/'>Volver</a></div>",
    );
};

module.exports = { asegurarToken, verificarToken };
