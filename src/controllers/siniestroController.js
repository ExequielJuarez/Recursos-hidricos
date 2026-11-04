const fs = require("fs");
const path = require("path");
const db = require("../model/database/models");
const { Op } = require("sequelize");
const auditoriaService = require("../data/auditoriaService");
const alertaService = require("../data/alertaService");
const assignmentService = require("../data/assignmentService");
const { ErrorNegocio } = require("../utils/errores");
const { escapeHtml } = require("../utils/html");
const { hoyISO, esFechaValida } = require("../utils/fechas");

const DIR_SINIESTROS = path.join(__dirname, "../../public/img/siniestros");
const ESTADOS = ["EN PROCESO", "RESUELTO", "CERRADO"];

const borrarArchivos = (nombres) => {
  (nombres || []).forEach((n) => {
    if (n && /^siniestro-\d+/.test(n)) fs.unlink(path.join(DIR_SINIESTROS, n), () => {});
  });
};

const nombresSubidos = (req) => (req.files || []).map((f) => f.filename);

// Cuando ya no quedan siniestros abiertos el vehículo vuelve a operar
const liberarVehiculoSiCorresponde = async (id_vehiculo, transaction) => {
  const vehiculo = await db.Vehiculo.findByPk(id_vehiculo, { transaction });
  if (!vehiculo || vehiculo.estado_actual !== "En siniestro") return;

  const abiertos = await db.Siniestro.count({ where: { id_vehiculo, estado: "EN PROCESO" }, transaction });
  if (abiertos > 0) return;

  const ordenesAbiertas = await db.Mantenimiento.count({
    where: { id_vehiculo, estado: "En proceso" },
    transaction,
  });
  await vehiculo.update({ estado_actual: ordenesAbiertas > 0 ? "En mantenimiento" : "Disponible" }, { transaction });
};

const siniestroController = {
  ListarSiniestros: async (req, res) => {
    try {
      const { patente, fechaDesde, fechaHasta } = req.query;
      const whereClause = {};

      if (fechaDesde && fechaHasta) {
        whereClause.fecha_siniestro = { [Op.between]: [fechaDesde, fechaHasta] };
      } else if (fechaDesde) {
        whereClause.fecha_siniestro = { [Op.gte]: fechaDesde };
      } else if (fechaHasta) {
        whereClause.fecha_siniestro = { [Op.lte]: fechaHasta };
      }

      const filtraPatente = patente && patente !== "" && patente !== "Todas las Patentes";

      const siniestros = await db.Siniestro.findAll({
        where: whereClause,
        include: [
          {
            model: db.Vehiculo,
            as: "Vehiculo",
            where: filtraPatente ? { patente: { [Op.like]: `%${patente}%` } } : undefined,
            required: !!filtraPatente,
          },
          { model: db.Chofer, as: "Chofer", required: false },
        ],
        order: [
          ["fecha_siniestro", "DESC"],
          ["id_siniestro", "DESC"],
        ],
      });

      const vehiculos = await db.Vehiculo.findAll({ order: [["patente", "ASC"]] });

      res.render("ListadoSiniestros", { siniestros, vehiculos, filtros: req.query });
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al cargar el módulo de siniestros.");
      res.redirect("/Vehicles");
    }
  },

  DetalleSiniestro: async (req, res) => {
    try {
      const siniestro = await db.Siniestro.findByPk(req.params.id, {
        include: [
          { model: db.Vehiculo, as: "Vehiculo" },
          { model: db.Chofer, as: "Chofer", required: false },
        ],
      });

      if (!siniestro) {
        req.flash("error", "El siniestro no existe.");
        return res.redirect("/Siniestros");
      }

      res.render("DetalleSiniestro", { siniestro });
    } catch (error) {
      console.error(error);
      res.redirect("/Siniestros");
    }
  },

  CargaSiniestro: async (req, res) => {
    try {
      const vehiculos = await db.Vehiculo.findAll({
        where: { estado_actual: { [Op.ne]: "Baja" } },
        order: [["patente", "ASC"]],
      });
      const choferes = await db.Chofer.findAll({ where: { estado: "Activo" }, order: [["apellido", "ASC"], ["nombre", "ASC"]] });

      res.render("CargaSiniestro", { vehiculos, choferes });
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al cargar el formulario.");
      res.redirect("/Siniestros");
    }
  },

  ProcesoCarga: async (req, res) => {
    const subidos = nombresSubidos(req);
    let transaction = null;
    try {
      const {
        id_vehiculo,
        id_chofer,
        fecha_siniestro,
        ubicacion,
        descripcion,
        danos_vehiculo,
        tercero_vehiculo,
        tercero_seguro,
        tercero_conductor,
        tercero_contacto,
      } = req.body;

      const ubicacionLimpia = String(ubicacion || "").trim();
      if (!id_vehiculo) throw new ErrorNegocio("Seleccioná el vehículo involucrado.");
      if (!fecha_siniestro || !esFechaValida(fecha_siniestro)) throw new ErrorNegocio("La fecha del siniestro no es válida.");
      if (fecha_siniestro > hoyISO()) throw new ErrorNegocio("La fecha del siniestro no puede ser futura.");
      if (!ubicacionLimpia) throw new ErrorNegocio("Indicá la ubicación del siniestro.");

      const vehiculoPrevio = await db.Vehiculo.findByPk(id_vehiculo);
      if (!vehiculoPrevio) throw new ErrorNegocio("El vehículo seleccionado no existe.");
      if (vehiculoPrevio.estado_actual === "Baja") throw new ErrorNegocio("El vehículo está dado de baja.");

      let chofer = null;
      if (id_chofer) {
        chofer = await db.Chofer.findByPk(id_chofer);
        if (!chofer) throw new ErrorNegocio("El chofer seleccionado no existe.");
      }

      // Si el vehículo estaba asignado, la asignación termina (ya no está en la calle)
      await assignmentService.finalizarActivasDeVehiculo(vehiculoPrevio.id_vehiculo, "Cierre automático por siniestro");

      transaction = await db.sequelize.transaction();
      const vehiculo = await db.Vehiculo.findByPk(id_vehiculo, { transaction, lock: transaction.LOCK.UPDATE });

      const nuevoSiniestro = await db.Siniestro.create(
        {
          id_vehiculo: vehiculo.id_vehiculo,
          id_chofer: chofer ? chofer.id_chofer : null,
          chofer_involucrado: chofer ? `${chofer.nombre} ${chofer.apellido}` : null,
          fecha_siniestro,
          ubicacion: ubicacionLimpia,
          relato: String(descripcion || "").trim() || null,
          danos_vehiculo: String(danos_vehiculo || "").trim() || null,
          tercero_vehiculo: String(tercero_vehiculo || "").trim() || null,
          tercero_seguro: String(tercero_seguro || "").trim() || null,
          tercero_conductor: String(tercero_conductor || "").trim() || null,
          tercero_contacto: String(tercero_contacto || "").trim() || null,
          estado: "EN PROCESO",
          archivos_adjuntos: subidos.join(","),
        },
        { transaction },
      );
      await vehiculo.update({ estado_actual: "En siniestro" }, { transaction });
      await transaction.commit();

      await auditoriaService.desdeRequest(
        req,
        "siniestro",
        nuevoSiniestro.id_siniestro,
        "CREAR",
        null,
        { id_vehiculo: vehiculo.id_vehiculo, patente: vehiculo.patente, ubicacion: ubicacionLimpia, fecha_siniestro, chofer: nuevoSiniestro.chofer_involucrado },
        `Siniestro registrado en: ${ubicacionLimpia} (vehículo ${vehiculo.patente})`,
      );

      await alertaService.generarAlertasVehiculos();
      req.flash("ok", "Siniestro registrado correctamente.");
      res.redirect("/Siniestros");
    } catch (error) {
      if (transaction) await transaction.rollback().catch(() => {});
      borrarArchivos(subidos);
      if (!(error instanceof ErrorNegocio)) console.error(error);
      const mensaje = error instanceof ErrorNegocio ? error.message : "Ocurrió un error al guardar el siniestro.";
      res.status(400).send(
        `<div style="font-family:sans-serif;padding:40px;text-align:center;"><h2 style="color:#dc2626;">No se pudo registrar el siniestro</h2><p style="background:#fef2f2;padding:15px;border:1px solid #fecaca;border-radius:8px;display:inline-block;">${escapeHtml(mensaje)}</p><br><br><button onclick="history.back()" style="padding:10px 20px;cursor:pointer;">Volver</button></div>`,
      );
    }
  },

  CambiarEstado: async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
      const estado = String(req.body.estado || "RESUELTO").trim().toUpperCase();
      if (!ESTADOS.includes(estado)) throw new ErrorNegocio("El estado indicado no es válido.");

      const siniestro = await db.Siniestro.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!siniestro) throw new ErrorNegocio("El siniestro no existe.");
      const anterior = siniestro.estado;
      if (anterior === estado) {
        await transaction.rollback();
        return res.redirect("/Siniestros");
      }

      await siniestro.update({ estado }, { transaction });

      if (estado === "EN PROCESO") {
        // Reapertura: el vehículo vuelve a quedar fuera de servicio
        const vehiculo = await db.Vehiculo.findByPk(siniestro.id_vehiculo, { transaction });
        if (vehiculo && ["Disponible", "En mantenimiento"].includes(vehiculo.estado_actual)) {
          await vehiculo.update({ estado_actual: "En siniestro" }, { transaction });
        }
      } else {
        await liberarVehiculoSiCorresponde(siniestro.id_vehiculo, transaction);
      }

      await transaction.commit();

      await auditoriaService.desdeRequest(
        req,
        "siniestro",
        siniestro.id_siniestro,
        "EDITAR_ESTADO",
        { estado: anterior },
        { estado },
        `Siniestro ID ${siniestro.id_siniestro} cambió de ${anterior} a: ${estado}`,
      );

      await alertaService.generarAlertasVehiculos();
      req.flash("ok", `Siniestro actualizado: ${estado}.`);
    } catch (error) {
      await transaction.rollback().catch(() => {});
      if (!(error instanceof ErrorNegocio)) console.error(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo actualizar el siniestro.");
    }
    res.redirect("/Siniestros");
  },

  Eliminar: async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
      const siniestro = await db.Siniestro.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!siniestro) throw new ErrorNegocio("El siniestro no existe.");

      const snapshot = siniestro.toJSON();
      await siniestro.destroy({ transaction });
      await db.Alerta.destroy({ where: { tipo: "siniestro_activo", entidad_tipo: "Siniestro", entidad_id: snapshot.id_siniestro }, transaction });
      await liberarVehiculoSiCorresponde(snapshot.id_vehiculo, transaction);
      await transaction.commit();

      borrarArchivos(String(snapshot.archivos_adjuntos || "").split(",").map((n) => n.trim()));

      await auditoriaService.desdeRequest(
        req,
        "siniestro",
        snapshot.id_siniestro,
        "ELIMINAR",
        snapshot,
        null,
        `Se eliminó el siniestro ID ${snapshot.id_siniestro} (${snapshot.ubicacion})`,
      );
      req.flash("ok", "Siniestro eliminado.");
    } catch (error) {
      await transaction.rollback().catch(() => {});
      if (!(error instanceof ErrorNegocio)) console.error(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo eliminar el siniestro.");
    }
    res.redirect("/Siniestros");
  },
};

module.exports = siniestroController;
