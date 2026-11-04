const db = require("../model/database/models");
const { Op } = require("sequelize");
const { esFechaValida } = require("../utils/fechas");

const auditoriaController = {
  ListarAuditoria: async (req, res) => {
    try {
      // 1. Capturamos las fechas que el usuario elige en el filtro (si es que elige alguna)
      let { fechaDesde, fechaHasta } = req.query;
      if (fechaDesde && !esFechaValida(fechaDesde)) fechaDesde = undefined;
      if (fechaHasta && !esFechaValida(fechaHasta)) fechaHasta = undefined;
      let whereClause = {}; // Objeto vacío por si no hay filtros

      // 2. Armamos la lógica de la consulta
      if (fechaDesde && fechaHasta) {
        // Si puso ambas fechas, buscamos "Entre" (Between)
        whereClause.fecha = { [Op.between]: [fechaDesde, fechaHasta] };
      } else if (fechaDesde) {
        // Si solo puso Desde, buscamos "Mayor o igual a" (gte)
        whereClause.fecha = { [Op.gte]: fechaDesde };
      } else if (fechaHasta) {
        // Si solo puso Hasta, buscamos "Menor o igual a" (lte)
        whereClause.fecha = { [Op.lte]: fechaHasta };
      }

      // 3. Ejecutamos la búsqueda (el usuario viene en la misma consulta, sin una consulta por fila)
      const registrosAuditoria = await db.Auditoria.findAll({
        where: whereClause,
        include: [{ model: db.Usuario, as: "usuario", attributes: ["nombre", "apellido"], required: false }],
        order: [
          ["fecha", "DESC"],
          ["hora", "DESC"],
          ["id_auditoria", "DESC"],
        ],
        limit: 500,
      });

      // 4. Limpieza de datos (fechas y usuarios)
      for (const registro of registrosAuditoria) {
        if (registro.fecha) {
          const [y, m, d] = String(registro.fecha).split("-");
          registro.fechaLimpia = `${Number(d)}/${Number(m)}/${y}`;
        } else {
          registro.fechaLimpia = "Sin fecha";
        }
        registro.nombreUsuario = registro.usuario
          ? `${registro.usuario.nombre} ${registro.usuario.apellido}`
          : registro.id_usuario
            ? `ID: ${registro.id_usuario} (Borrado)`
            : "Sin identificar";
      }

      // 5. Enviamos todo a la vista (incluyendo los filtros para que no se borren de la pantalla)
      res.render("Auditoria", {
        registros: registrosAuditoria,
        filtros: { fechaDesde, fechaHasta },
      });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar el módulo de Auditoría.");
      res.redirect("/Vehicles");
    }
  },
};

module.exports = auditoriaController;
