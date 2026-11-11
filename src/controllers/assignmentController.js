const db = require("../model/database/models");
const assignmentService = require("../data/assignmentService");
const auditoriaService = require("../data/auditoriaService");
const alertaService = require("../data/alertaService");
const { esFechaValida } = require("../utils/fechas");

const { ErrorNegocio } = require("../utils/errores");

const assignmentController = {
  showForm: async (req, res) => {
    try {
      const { vehiculos, choferes, categoriasPorTipo } = await assignmentService.getFormData();
      const asignaciones = await assignmentService.getActiveAssignments();
      // Destinos posibles: los distritos / ubicaciones cargados en Vehículos → Ajustes
      const distritos = await db.Distrito.findAll({ order: [["nombre", "ASC"]] });

      res.render("AsignacionVehiculo", {
        vehiculos,
        choferes,
        categoriasPorTipo,
        asignaciones,
        distritos,
        error: req.query.error || null,
        success: req.query.success || null,
      });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar el formulario de asignación.");
      res.redirect("/Vehicles");
    }
  },

  // Historial de asignaciones de un vehículo (Vehículos → ficha → Asignaciones → Ver todas)
  historialVehiculo: async (req, res) => {
    try {
      const vehiculo = await db.Vehiculo.findByPk(req.params.id);
      if (!vehiculo) {
        req.flash("error", "El vehículo no existe.");
        return res.redirect("/Vehicles");
      }
      const asignaciones = await assignmentService.historial({ id_vehiculo: vehiculo.id_vehiculo });
      res.render("HistorialAsignaciones", { de: "vehiculo", vehiculo, asignaciones });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar las asignaciones del vehículo.");
      res.redirect("/Vehicles");
    }
  },

  // Historial de asignaciones de un chofer
  historialChofer: async (req, res) => {
    try {
      const chofer = await db.Chofer.findByPk(req.params.id);
      if (!chofer) {
        req.flash("error", "El chofer no existe.");
        return res.redirect("/Choferes");
      }
      const asignaciones = await assignmentService.historial({ id_chofer: chofer.id_chofer });
      // La ficha del chofer (que se arma en el navegador) pide las últimas en JSON
      if (req.query.formato === "json") {
        return res.json({
          total: asignaciones.length,
          asignaciones: asignaciones.slice(0, 3).map((a) => ({
            fecha_salida: a.fecha_salida,
            fecha_devolucion: a.fecha_devolucion,
            estado: a.estado,
            destino: a.destino_area,
            patente: a.vehiculo ? a.vehiculo.patente : "",
            vehiculo: a.vehiculo ? `${a.vehiculo.marca} ${a.vehiculo.modelo}` : "",
          })),
        });
      }
      res.render("HistorialAsignaciones", { de: "chofer", chofer, asignaciones });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar las asignaciones del chofer.");
      res.redirect("/Choferes");
    }
  },

  create: async (req, res) => {
    try {
      const { id_vehiculo, id_chofer, fecha_desde } = req.body;

      if (!id_vehiculo || !id_chofer || !fecha_desde) {
        return res.redirect("/asignaciones?error=" + encodeURIComponent("Completá todos los campos obligatorios"));
      }
      if (!esFechaValida(fecha_desde)) {
        return res.redirect("/asignaciones?error=" + encodeURIComponent("La fecha de inicio ingresada no es válida"));
      }
      if (req.body.km_salida === undefined || req.body.km_salida === "") {
        return res.redirect("/asignaciones?error=" + encodeURIComponent("Ingresá el kilometraje de salida"));
      }

      const { asignacion, vehiculo, chofer } = await assignmentService.create(req.body);

      await auditoriaService.desdeRequest(
        req,
        "asignacion_vehiculo",
        asignacion.id_asignacion,
        "CREAR",
        null,
        {
          id_vehiculo: vehiculo.id_vehiculo,
          patente: vehiculo.patente,
          id_chofer: chofer.id_chofer,
          chofer: `${chofer.nombre} ${chofer.apellido}`,
          fecha_salida: fecha_desde,
          destino: req.body.destino || null,
        },
        `Asignación del vehículo ${vehiculo.patente} a ${chofer.nombre} ${chofer.apellido}`,
      );

      await alertaService.generarAlertasMantenimiento();
      res.redirect("/asignaciones?success=" + encodeURIComponent("Asignación registrada correctamente"));
    } catch (error) {
      const mensaje = error instanceof ErrorNegocio ? error.message : "Error al guardar la asignación";
      if (!(error instanceof ErrorNegocio)) console.log(error);
      res.redirect("/asignaciones?error=" + encodeURIComponent(mensaje));
    }
  },

  finalize: async (req, res) => {
    try {
      const asignacion = await assignmentService.finalize(req.params.id);
      await auditoriaService.desdeRequest(
        req,
        "asignacion_vehiculo",
        asignacion.id_asignacion,
        "EDITAR",
        { estado: "Activo" },
        { estado: "Finalizado" },
        `Vehículo devuelto: se finalizó la asignación ID: ${asignacion.id_asignacion} (vehículo ID: ${asignacion.id_vehiculo})`,
      );
      await alertaService.generarAlertasMantenimiento();
      res.redirect("/asignaciones?success=" + encodeURIComponent("Vehículo marcado como devuelto. Ya está disponible."));
    } catch (error) {
      const mensaje = error instanceof ErrorNegocio ? error.message : "Error al finalizar la asignación";
      if (!(error instanceof ErrorNegocio)) console.log(error);
      res.redirect("/asignaciones?error=" + encodeURIComponent(mensaje));
    }
  },
};

module.exports = assignmentController;
