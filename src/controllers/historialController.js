const path = require("path");
const multer = require("multer");
const db = require("../model/database/models");
const historialService = require("../data/historialService");
const auditoriaService = require("../data/auditoriaService");
const { CAMPOS_ADMIN } = require("../data/maintenanceService");
const { ErrorNegocio } = require("../utils/errores");
const { hoyISO } = require("../utils/fechas");

const ANIOS = ["1", "2", "3", "5", "todo"];

const leerFiltros = (q) => ({
  id_vehiculo: /^\d+$/.test(String(q.vehiculo || "")) ? Number(q.vehiculo) : null,
  anios: ANIOS.includes(String(q.anios)) ? String(q.anios) : "3",
  pendientes: q.pendientes === "1",
});

const queryDe = (f) => {
  const p = new URLSearchParams();
  if (f.id_vehiculo) p.set("vehiculo", f.id_vehiculo);
  p.set("anios", f.anios);
  if (f.pendientes) p.set("pendientes", "1");
  return p.toString();
};

// Solo se vuelve a pantallas del propio historial (evita redirecciones a otros sitios)
const destinoSeguro = (volver) => (typeof volver === "string" && /^\/Mantenimientos\/Historial(\?[\w=&%.-]*)?$/.test(volver) ? volver : "/Mantenimientos/Historial");

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".xlsx") {
      const error = new Error("Subí el archivo Excel (.xlsx) descargado desde el sistema.");
      error.codigoSubida = true;
      return cb(error);
    }
    cb(null, true);
  },
}).single("archivo");

const historialController = {
  uploadExcel,

  ver: async (req, res) => {
    try {
      const filtros = leerFiltros(req.query);
      const filas = await historialService.listar(filtros);
      const vehiculos = await db.Vehiculo.findAll({ attributes: ["id_vehiculo", "patente", "marca", "modelo"], order: [["patente", "ASC"]] });
      const todas = filtros.pendientes ? await historialService.listar({ ...filtros, pendientes: false }) : filas;
      res.render("HistorialMantenimiento", {
        filas,
        vehiculos,
        filtros,
        queryActual: queryDe(filtros),
        resumen: {
          total: todas.length,
          completas: todas.filter((f) => f.faltantes.length === 0).length,
          importe: todas.reduce((t, f) => t + f.precio, 0),
        },
        campos: CAMPOS_ADMIN.map(([clave, etiqueta, max]) => ({ clave, etiqueta, max })),
      });
    } catch (error) {
      console.log(error);
      req.flash("error", "No se pudo cargar el historial administrativo.");
      res.redirect("/Mantenimientos");
    }
  },

  exportar: async (req, res) => {
    try {
      const filtros = leerFiltros(req.query);
      let etiqueta = "flota";
      if (filtros.id_vehiculo) {
        const v = await db.Vehiculo.findByPk(filtros.id_vehiculo);
        if (!v) {
          req.flash("error", "El vehículo no existe.");
          return res.redirect("/Mantenimientos/Historial");
        }
        etiqueta = v.patente;
      }
      const filas = await historialService.listar(filtros);
      const periodo = filtros.anios === "todo" ? "todo el historial" : `últimos ${filtros.anios} año(s)`;
      const buffer = await historialService.exportar(filas, { titulo: `Historial de mantenimiento · ${etiqueta === "flota" ? "toda la flota" : "vehículo " + etiqueta} · ${periodo}` });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="historial-mantenimiento-${etiqueta}-${hoyISO()}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.log(error);
      req.flash("error", "No se pudo generar el Excel.");
      res.redirect("/Mantenimientos/Historial");
    }
  },

  importar: async (req, res) => {
    const destino = destinoSeguro(req.body && req.body.volver);
    try {
      if (!req.file) throw new ErrorNegocio("Elegí el archivo Excel (.xlsx) completado.");
      const r = await historialService.importar(req.file.buffer);
      if (!r.ok) {
        const mostrar = r.errores.slice(0, 6).join(" · ");
        const resto = r.errores.length > 6 ? ` · y ${r.errores.length - 6} error(es) más` : "";
        req.flash("error", `No se guardó nada: corregí el archivo y volvé a subirlo. ${mostrar}${resto}`);
        return res.redirect(destino);
      }
      for (const c of r.cambios) {
        await auditoriaService.desdeRequest(req, "mantenimiento", c.id, "EDITAR", c.anterior, c.nuevo, `Historial administrativo (carga de Excel): orden ${c.id} de ${c.patente}`);
      }
      req.flash("ok", `Excel cargado: ${r.actualizadas} orden(es) actualizada(s)` + (r.sinCambios ? `, ${r.sinCambios} sin cambios.` : "."));
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo procesar el archivo.");
    }
    res.redirect(destino);
  },

  // Edición de una fila desde el cuadro de la pantalla
  editar: async (req, res) => {
    const destino = destinoSeguro(req.body.volver);
    const transaction = await db.sequelize.transaction();
    try {
      const datos = { descripcion: req.body.descripcion, precio: req.body.precio };
      CAMPOS_ADMIN.forEach(([campo]) => {
        if (req.body[campo] !== undefined) datos[campo] = req.body[campo]; // vacío = borrar el dato
      });
      const r = await historialService.actualizar(Number(req.params.id), datos, transaction);
      await transaction.commit();
      if (Object.keys(r.nuevo).length === 0) {
        req.flash("ok", "No había cambios para guardar.");
      } else {
        await auditoriaService.desdeRequest(req, "mantenimiento", req.params.id, "EDITAR", r.anterior, r.nuevo, `Historial administrativo: se actualizó la orden ${req.params.id}`);
        req.flash("ok", "Datos del mantenimiento actualizados.");
      }
    } catch (error) {
      await transaction.rollback();
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo guardar el cambio.");
    }
    res.redirect(destino);
  },
};

module.exports = historialController;
