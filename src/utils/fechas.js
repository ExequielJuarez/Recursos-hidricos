// Utilidades de fecha. La zona horaria del proceso se fija en app.js (America/Argentina/Buenos_Aires).

const pad = (n) => String(n).padStart(2, "0");

// Fecha de hoy (local) en formato YYYY-MM-DD
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Convierte "YYYY-MM-DD" (o Date) a milisegundos UTC de esa fecha calendario
const aUTC = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) {
    return Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  const [y, m, d] = String(valor).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
};

// Días desde hoy hasta la fecha (negativo si ya pasó)
const diasHasta = (valor) => {
  const destino = aUTC(valor);
  if (destino === null) return null;
  return Math.round((destino - aUTC(hoyISO())) / 86400000);
};

// Devuelve un string YYYY-MM-DD para un valor DATE/DATEONLY de Sequelize (tolerante a null)
const aISO = (valor) => {
  if (!valor) return "";
  if (typeof valor === "string") return valor.slice(0, 10);
  const d = new Date(valor);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const esFechaValida = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || "")) && !Number.isNaN(Date.parse(valor));

module.exports = { hoyISO, aUTC, diasHasta, aISO, esFechaValida };
