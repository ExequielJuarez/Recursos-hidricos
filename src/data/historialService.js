// Historial administrativo de mantenimientos: una fila por orden realizada o en proceso, con los datos
// que se completan en el escritorio (remito, factura, casa proveedora, pedido, expediente) además de
// fecha, cantidad, descripción y precio. Se puede bajar a Excel, completar y volver a cargar.
const ExcelJS = require("exceljs");
const { Op } = require("sequelize");
const db = require("../model/database/models");
const { hoyISO, aISO } = require("../utils/fechas");
const { ErrorNegocio } = require("../utils/errores");
const { CAMPOS_ADMIN, datosAdministrativos } = require("./maintenanceService");

const ESTADOS_HISTORIAL = ["Realizado", "En proceso"];
const redondear = (n) => Math.round(n * 100) / 100;

// Columnas del Excel (el orden es el pedido por la administración)
const COLUMNAS = [
  { clave: "id_mantenimiento", titulo: "ID orden", ancho: 10, editable: false },
  { clave: "patente", titulo: "Patente", ancho: 12, editable: false },
  { clave: "fecha", titulo: "Fecha", ancho: 13, editable: false },
  { clave: "nro_remito", titulo: "N° Remito", ancho: 16, editable: true },
  { clave: "nro_factura", titulo: "N° Factura", ancho: 16, editable: true },
  { clave: "proveedor", titulo: "Casa proveedora", ancho: 26, editable: true },
  { clave: "nro_pedido", titulo: "N° Pedido", ancho: 16, editable: true },
  { clave: "nro_expediente", titulo: "N° Expediente", ancho: 18, editable: true },
  { clave: "cantidad", titulo: "Cantidad", ancho: 10, editable: false },
  { clave: "descripcion", titulo: "Descripción", ancho: 55, editable: true },
  { clave: "precio", titulo: "Precio", ancho: 16, editable: true },
];

const normalizar = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// "N° Remito", "Nro remito", "Remito" → misma clave
const CLAVE_POR_TITULO = (() => {
  const m = new Map();
  COLUMNAS.forEach((c) => m.set(normalizar(c.titulo), c.clave));
  m.set("id", "id_mantenimiento");
  m.set("id orden", "id_mantenimiento");
  m.set("remito", "nro_remito");
  m.set("factura", "nro_factura");
  m.set("pedido", "nro_pedido");
  m.set("expediente", "nro_expediente");
  m.set("n remito", "nro_remito");
  m.set("n factura", "nro_factura");
  m.set("n pedido", "nro_pedido");
  m.set("n expediente", "nro_expediente");
  m.set("nro remito", "nro_remito");
  m.set("nro factura", "nro_factura");
  m.set("nro pedido", "nro_pedido");
  m.set("nro expediente", "nro_expediente");
  m.set("proveedor", "proveedor");
  return m;
})();

const desdeAnios = (anios) => {
  const n = Number(anios);
  if (![1, 2, 3, 5].includes(n)) return null; // "todo"
  const hoy = hoyISO();
  return `${Number(hoy.slice(0, 4)) - n}${hoy.slice(4)}`;
};

const historialService = {
  COLUMNAS,
  ESTADOS_HISTORIAL,

  // filtros: { id_vehiculo, anios (1|2|3|5|"todo"), pendientes (true: solo con datos por completar) }
  listar: async function (filtros = {}) {
    const where = { estado: { [Op.in]: ESTADOS_HISTORIAL } };
    if (filtros.id_vehiculo) where.id_vehiculo = Number(filtros.id_vehiculo);
    const desde = desdeAnios(filtros.anios);
    if (desde) where.fecha_inicio = { [Op.gte]: desde };

    const ordenes = await db.Mantenimiento.findAll({
      where,
      include: [
        { association: "vehiculo", attributes: ["patente", "marca", "modelo"] },
        { association: "detalles", required: false, attributes: ["cantidad"] },
      ],
      order: [
        ["fecha_inicio", "DESC"],
        ["id_mantenimiento", "DESC"],
      ],
    });

    let filas = ordenes.map((m) => {
      const cantidad = (m.detalles || []).reduce((t, d) => t + Number(d.cantidad || 0), 0) || 1;
      const fila = {
        id_mantenimiento: m.id_mantenimiento,
        patente: m.vehiculo ? m.vehiculo.patente : "",
        vehiculo: m.vehiculo ? `${m.vehiculo.marca} ${m.vehiculo.modelo}` : "",
        fecha: aISO(m.fecha_inicio),
        tipo_servicio: m.tipo_servicio,
        estado: m.estado,
        cantidad,
        descripcion: m.descripcion || "",
        precio: Number(m.costo_total) || 0,
        costo_repuestos: Number(m.costo_repuestos) || 0,
      };
      CAMPOS_ADMIN.forEach(([campo]) => (fila[campo] = m[campo] || ""));
      fila.faltantes = CAMPOS_ADMIN.filter(([campo]) => !fila[campo]).map(([, etiqueta]) => etiqueta);
      return fila;
    });
    if (filtros.pendientes) filas = filas.filter((f) => f.faltantes.length > 0);
    return filas;
  },

  // Aplica cambios a una orden. `datos` puede traer los 5 datos administrativos, descripcion y precio.
  // Devuelve { anterior, nuevo } con los campos que realmente cambiaron (vacío si nada cambió).
  actualizar: async function (id, datos, transaction) {
    const m = await db.Mantenimiento.findByPk(id, { transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined });
    if (!m || !ESTADOS_HISTORIAL.includes(m.estado)) throw new ErrorNegocio(`La orden ${id} no existe o no pertenece al historial.`);

    const cambios = {};
    const admin = datosAdministrativos(Object.fromEntries(CAMPOS_ADMIN.filter(([c]) => datos[c] !== undefined).map(([c]) => [c, datos[c]])));
    for (const [campo] of CAMPOS_ADMIN) {
      if (datos[campo] === undefined) continue;
      if ((m[campo] || null) !== admin[campo]) cambios[campo] = admin[campo];
    }

    if (datos.descripcion !== undefined && datos.descripcion !== null) {
      const d = String(datos.descripcion).trim();
      if (d !== (m.descripcion || "")) {
        if (!d) throw new ErrorNegocio("La descripción no puede quedar vacía.");
        cambios.descripcion = d;
      }
    }

    if (datos.precio !== undefined && datos.precio !== null && String(datos.precio).trim() !== "") {
      const precio = typeof datos.precio === "number" ? datos.precio : Number(String(datos.precio).trim().replace(/[$\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
      if (!Number.isFinite(precio) || precio < 0) throw new ErrorNegocio("El precio debe ser un número mayor o igual a 0.");
      if (redondear(precio) !== redondear(Number(m.costo_total) || 0)) {
        const repuestos = Number(m.costo_repuestos) || 0;
        if (precio < repuestos) throw new ErrorNegocio(`El precio ($${redondear(precio)}) no puede ser menor al costo de los repuestos ya registrados ($${redondear(repuestos)}).`);
        cambios.costo_total = redondear(precio);
        cambios.mano_obra = redondear(precio - repuestos); // la diferencia se registra como mano de obra
      }
    }

    if (Object.keys(cambios).length === 0) return { anterior: {}, nuevo: {} };
    const anterior = {};
    Object.keys(cambios).forEach((k) => (anterior[k] = m[k] === undefined ? null : m[k]));
    await m.update(cambios, { transaction });
    return { anterior, nuevo: cambios, mantenimiento: m };
  },

  // ───────── Excel ─────────
  exportar: async function (filas, { titulo = "Historial de mantenimiento" } = {}) {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Ficha Técnica de Vehículos";
    wb.created = new Date();

    const ws = wb.addWorksheet("Historial", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }));

    const encabezado = ws.getRow(1);
    encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
    encabezado.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    encabezado.height = 24;
    COLUMNAS.forEach((c, i) => {
      encabezado.getCell(i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.editable ? "FF1D4ED8" : "FF64748B" } };
    });

    filas.forEach((f) => {
      const [y, mo, d] = f.fecha.split("-").map(Number);
      const fila = ws.addRow({
        id_mantenimiento: f.id_mantenimiento,
        patente: f.patente,
        fecha: new Date(Date.UTC(y, mo - 1, d)),
        nro_remito: f.nro_remito,
        nro_factura: f.nro_factura,
        proveedor: f.proveedor,
        nro_pedido: f.nro_pedido,
        nro_expediente: f.nro_expediente,
        cantidad: f.cantidad,
        descripcion: f.descripcion,
        precio: f.precio,
      });
      COLUMNAS.forEach((c, i) => {
        const celda = fila.getCell(i + 1);
        celda.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } }, left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };
        celda.alignment = { vertical: "top", wrapText: c.clave === "descripcion" };
        if (!c.editable) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        else if (CAMPOS_ADMIN.some(([k]) => k === c.clave) && !celda.value) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } }; // por completar
      });
      fila.getCell("fecha").numFmt = "dd/mm/yyyy";
      fila.getCell("precio").numFmt = '"$"#,##0.00';
      // Los números de documento van como texto para no perder ceros a la izquierda (ej. 0001-00004567)
      ["nro_remito", "nro_factura", "nro_pedido", "nro_expediente"].forEach((k) => (fila.getCell(k).numFmt = "@"));
    });

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } };

    const info = wb.addWorksheet("Instrucciones");
    info.columns = [{ width: 110 }];
    [
      titulo,
      `Generado el ${hoyISO().split("-").reverse().join("/")} · ${filas.length} orden(es)`,
      "",
      "CÓMO USAR ESTE ARCHIVO",
      "1. Completá las columnas en azul: N° Remito, N° Factura, Casa proveedora, N° Pedido, N° Expediente, Descripción y Precio. Las celdas amarillas son datos que todavía faltan.",
      "2. No modifiques las columnas grises (ID orden, Patente, Fecha, Cantidad): el ID identifica a qué mantenimiento corresponde cada fila.",
      "3. No borres ni muevas la fila de encabezados. Podés ordenar o filtrar las filas libremente.",
      "4. Guardá el archivo (.xlsx) y subilo desde Mantenimientos > Historial Administrativo > \"Cargar Excel completado\". Los datos se actualizan en cada mantenimiento.",
      "5. Si cambiás el Precio, la diferencia con los repuestos ya registrados se guarda como mano de obra. La Cantidad sale de los repuestos de la orden (1 si no usó repuestos).",
      "6. Dejá en blanco lo que no tengas: las celdas vacías no borran datos ya cargados.",
    ].forEach((t, i) => {
      const fila = info.addRow([t]);
      fila.alignment = { wrapText: true, vertical: "top" };
      if (i === 0 || i === 3) fila.font = { bold: true, size: i === 0 ? 14 : 12 };
    });

    return wb.xlsx.writeBuffer();
  },

  // Lee el Excel completado. Devuelve [{ fila, datos }]. Lanza ErrorNegocio si el archivo no sirve.
  leerExcel: async function (buffer) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer);
    } catch (e) {
      throw new ErrorNegocio("No se pudo leer el archivo. Subí el Excel (.xlsx) descargado desde el sistema.");
    }
    const ws = wb.getWorksheet("Historial") || wb.worksheets[0];
    if (!ws) throw new ErrorNegocio("El archivo no tiene hojas.");

    // La fila de encabezados es la primera (entre las 10 primeras) que tiene "ID orden"
    let filaEnc = 0;
    let mapa = {};
    for (let r = 1; r <= Math.min(10, ws.rowCount) && !filaEnc; r++) {
      const m = {};
      ws.getRow(r).eachCell((celda, col) => {
        const clave = CLAVE_POR_TITULO.get(normalizar(celda.text));
        if (clave) m[clave] = col;
      });
      if (m.id_mantenimiento) {
        filaEnc = r;
        mapa = m;
      }
    }
    if (!filaEnc) throw new ErrorNegocio('No se encontró la columna "ID orden". Usá el archivo descargado desde el sistema y no borres la fila de encabezados.');

    const valorTexto = (celda) => {
      const v = celda.value;
      if (v === null || v === undefined) return "";
      if (typeof v === "object") {
        if (v.richText) return v.richText.map((t) => t.text).join("").trim();
        if (v.result !== undefined) return String(v.result).trim();
        if (v.text !== undefined) return String(v.text).trim();
        if (v instanceof Date) return v.toISOString();
      }
      return String(celda.text ?? v).trim();
    };

    const filas = [];
    for (let r = filaEnc + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const leer = (clave) => (mapa[clave] ? row.getCell(mapa[clave]) : null);
      const idTxt = leer("id_mantenimiento") ? valorTexto(leer("id_mantenimiento")) : "";
      const datos = {};
      let vacia = !idTxt;
      for (const clave of ["nro_remito", "nro_factura", "proveedor", "nro_pedido", "nro_expediente", "descripcion"]) {
        if (!mapa[clave]) continue;
        const v = valorTexto(leer(clave));
        datos[clave] = v; // vacío = "no tocar" (se resuelve más abajo)
        if (v) vacia = false;
      }
      if (mapa.precio) {
        const c = leer("precio");
        const v = c.value;
        datos.precio = typeof v === "number" ? v : v && typeof v === "object" && typeof v.result === "number" ? v.result : valorTexto(c);
        if (datos.precio !== "" && datos.precio !== null) vacia = false;
      }
      if (vacia) continue;
      filas.push({ fila: r, id: idTxt, patente: mapa.patente ? valorTexto(leer("patente")) : null, datos });
    }
    return filas;
  },

  // Aplica el Excel completo en una sola transacción: si una fila falla, no se guarda nada.
  importar: async function (buffer) {
    const filas = await historialService.leerExcel(buffer);
    if (filas.length === 0) throw new ErrorNegocio("El archivo no tiene filas con datos para cargar.");

    const errores = [];
    const cambios = [];
    let sinCambios = 0;
    const transaction = await db.sequelize.transaction();
    try {
      for (const f of filas) {
        try {
          if (!/^\d+$/.test(f.id)) throw new ErrorNegocio("falta el ID de la orden (no borres esa columna).");
          const id = Number(f.id);
          const datos = {};
          // Las celdas vacías no borran lo ya cargado
          for (const [k, v] of Object.entries(f.datos)) if (v !== "" && v !== null && v !== undefined) datos[k] = v;
          const orden = await db.Mantenimiento.findByPk(id, { include: [{ association: "vehiculo", attributes: ["patente"] }], transaction });
          if (!orden || !ESTADOS_HISTORIAL.includes(orden.estado)) throw new ErrorNegocio(`la orden ${id} no existe o no es un mantenimiento realizado/en proceso.`);
          if (f.patente && orden.vehiculo && f.patente.toUpperCase() !== orden.vehiculo.patente.toUpperCase()) {
            throw new ErrorNegocio(`la patente ${f.patente} no coincide con la de la orden ${id} (${orden.vehiculo.patente}).`);
          }
          const r = await historialService.actualizar(id, datos, transaction);
          if (Object.keys(r.nuevo).length) cambios.push({ id, patente: orden.vehiculo ? orden.vehiculo.patente : "", anterior: r.anterior, nuevo: r.nuevo });
          else sinCambios++;
        } catch (e) {
          if (!(e instanceof ErrorNegocio)) throw e;
          errores.push(`Fila ${f.fila}: ${e.message}`);
        }
      }
      if (errores.length) {
        await transaction.rollback();
        return { ok: false, errores, actualizadas: 0, sinCambios: 0, cambios: [] };
      }
      await transaction.commit();
      return { ok: true, errores: [], actualizadas: cambios.length, sinCambios, cambios };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

module.exports = historialService;
