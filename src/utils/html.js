// Escapa texto para insertarlo de forma segura dentro de HTML
const escapeHtml = (valor) =>
  String(valor === undefined || valor === null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Serializa a JSON seguro para incrustar dentro de un <script>
const safeJson = (dato) =>
  JSON.stringify(dato === undefined ? null : dato)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");

module.exports = { escapeHtml, safeJson };
