// Genera los PDF de ejemplo (uno por cada fila de documento_adjunto de los datos de demo)
// en uploads/documentos, para poder ver y abrir la documentación adjunta sin cargar nada a mano.
const fs = require("fs");
const path = require("path");

const MANIFIESTO = path.join(__dirname, "../pruebasdb/documentos_demo.json");

// PDF mínimo de una página con un título (sin dependencias)
const crearPdf = (titulo, detalle) => {
  const limpiar = (t) => String(t).replace(/[^\x20-\x7E]/g, (c) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u", ñ: "n", Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ñ: "N", ü: "u" })[c] || "?").replace(/([()\\])/g, "\\$1");
  const flujo = `BT /F1 20 Tf 60 740 Td (DOCUMENTO DE EJEMPLO) Tj ET\nBT /F1 14 Tf 60 700 Td (${limpiar(titulo)}) Tj ET\nBT /F1 11 Tf 60 676 Td (${limpiar(detalle || "")}) Tj ET\nBT /F1 10 Tf 60 640 Td (Archivo generado por los datos de demostracion de Ficha Tecnica.) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(flujo)} >>\nstream\n${flujo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
};

const generarDocumentosDemo = () => {
  const { DIR_DOCUMENTOS } = require("../src/utils/documentos");
  if (!fs.existsSync(MANIFIESTO)) return 0;
  const lista = JSON.parse(fs.readFileSync(MANIFIESTO, "utf8"));
  fs.mkdirSync(DIR_DOCUMENTOS, { recursive: true });
  for (const d of lista) fs.writeFileSync(path.join(DIR_DOCUMENTOS, d.archivo), crearPdf(d.titulo, d.detalle));
  return lista.length;
};

module.exports = { generarDocumentosDemo, crearPdf };
