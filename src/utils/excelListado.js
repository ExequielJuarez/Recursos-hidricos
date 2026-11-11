const ExcelJS = require("exceljs");
const { aISO, hoyISO } = require("./fechas");

// Fecha (DATE / DATEONLY / ISO) → Date de Excel (sin corrimiento por zona horaria)
const fechaExcel = (valor) => {
  const iso = aISO(valor);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const BORDE = { style: "thin", color: { argb: "FFE2E8F0" } };

// Genera un .xlsx con una hoja: encabezado con estilo, filtros, columnas con ancho y formato.
//   columnas: [{ titulo, clave, ancho, tipo: "texto" | "numero" | "fecha" }]
//   filas: objetos con esas claves
const generarListado = async ({ hoja, titulo, columnas, filas }) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestión de Flota";
  wb.created = new Date();
  const ws = wb.addWorksheet(hoja, { views: [{ state: "frozen", ySplit: 3 }] });

  ws.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = ws.getCell(1, 1);
  celdaTitulo.value = `${titulo} · generado el ${hoyISO().split("-").reverse().join("/")} · ${filas.length} registro(s)`;
  celdaTitulo.font = { bold: true, size: 13, color: { argb: "FF0F172A" } };
  ws.getRow(1).height = 22;

  const encabezado = ws.getRow(3);
  columnas.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.ancho || 16;
    const celda = encabezado.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    celda.border = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
  });
  encabezado.height = 24;

  filas.forEach((f) => {
    const fila = ws.addRow(
      columnas.map((c) => {
        const v = f[c.clave];
        if (v === null || v === undefined || v === "") return null;
        if (c.tipo === "fecha") return fechaExcel(v);
        if (c.tipo === "numero") return Number(v);
        return String(v);
      }),
    );
    columnas.forEach((c, i) => {
      const celda = fila.getCell(i + 1);
      celda.border = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
      celda.alignment = { vertical: "top", wrapText: c.tipo === "texto" && (c.ancho || 16) >= 30 };
      if (c.tipo === "fecha") celda.numFmt = "dd/mm/yyyy";
      else if (c.tipo === "numero") celda.numFmt = "#,##0";
      else celda.numFmt = "@";
    });
  });

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columnas.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
};

const enviarExcel = (res, nombre, buffer) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nombre}-${hoyISO()}.xlsx"`);
  res.send(buffer);
};

module.exports = { generarListado, enviarExcel };
