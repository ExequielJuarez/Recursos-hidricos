const db = require("../model/database/models");
const { hoyISO, esFechaValida } = require("../utils/fechas");
const { ErrorNegocio } = require("../utils/errores");

const prestamoService = {
  // Registra un nuevo préstamo (respeta el stock: no se presta más de lo que hay)
  create: async function (data) {
    const transaction = await db.sequelize.transaction();
    try {
      const herramienta = await db.Herramienta.findByPk(data.id_herramienta, { transaction, lock: transaction.LOCK.UPDATE });
      if (!herramienta) throw new ErrorNegocio("La herramienta no existe.");
      if (["En Reparación", "Baja"].includes(herramienta.estado)) {
        throw new ErrorNegocio(`No se puede prestar: la herramienta está "${herramienta.estado}".`);
      }

      const activos = await db.Prestamo.count({ where: { id_herramienta: herramienta.id_herramienta, estado_prestamo: "Activo" }, transaction });
      if (activos >= herramienta.stock) {
        throw new ErrorNegocio("Esta herramienta no tiene unidades disponibles: todas están en préstamo activo.");
      }

      // Operario y sector se toman del catálogo (el formulario envía sus ids)
      const operario = data.id_operario
        ? await db.Operario.findByPk(data.id_operario, { transaction })
        : data.nombre_operario
          ? await db.Operario.findOne({ where: { nombre: data.nombre_operario }, transaction })
          : null;
      if (!operario) throw new ErrorNegocio("Seleccioná un operario válido.");
      if (operario.estado && operario.estado !== "Activo") throw new ErrorNegocio("El operario seleccionado no está activo.");

      let sectorNombre = null;
      if (data.id_sector_destino) {
        const sector = await db.Sector.findByPk(data.id_sector_destino, { transaction });
        if (!sector) throw new ErrorNegocio("Seleccioná un sector de destino válido.");
        sectorNombre = sector.nombre;
      } else if (data.sector_destino) {
        sectorNombre = String(data.sector_destino).trim();
      }
      if (!sectorNombre) throw new ErrorNegocio("Seleccioná un sector de destino.");

      const salida = data.fecha_salida || hoyISO();
      if (!esFechaValida(salida)) throw new ErrorNegocio("La fecha de salida no es válida.");
      if (!data.fecha_devolucion_estimada || !esFechaValida(data.fecha_devolucion_estimada)) {
        throw new ErrorNegocio("La fecha de devolución estimada no es válida.");
      }
      if (data.fecha_devolucion_estimada < salida) {
        throw new ErrorNegocio("La devolución estimada no puede ser anterior a la fecha de salida.");
      }

      const observaciones = String(data.observaciones_entrega ?? data.observaciones ?? "").trim() || null;

      const nuevoPrestamo = await db.Prestamo.create(
        {
          id_herramienta: herramienta.id_herramienta,
          nombre_operario: operario.nombre,
          fecha_salida: salida,
          fecha_devolucion_estimada: data.fecha_devolucion_estimada,
          sector_destino: sectorNombre,
          observaciones,
          estado_prestamo: "Activo",
        },
        { transaction },
      );

      // "En uso" sólo cuando todas las unidades están afuera
      if (activos + 1 >= herramienta.stock) {
        await herramienta.update({ estado: "En uso" }, { transaction });
      }

      await transaction.commit();
      return { prestamo: nuevoPrestamo, herramienta };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  getByTool: async function (id_herramienta) {
    try {
      return await db.Prestamo.findAll({
        where: { id_herramienta },
        order: [["fecha_salida", "DESC"]],
      });
    } catch (error) {
      console.log("Error en getByTool:", error);
      return [];
    }
  },

  // Registra la devolución de un préstamo (el indicado, o el activo más antiguo de la herramienta)
  devolver: async function ({ id_herramienta, id_prestamo }) {
    const transaction = await db.sequelize.transaction();
    try {
      let prestamo = null;
      if (id_prestamo) {
        prestamo = await db.Prestamo.findByPk(id_prestamo, { transaction, lock: transaction.LOCK.UPDATE });
      } else if (id_herramienta) {
        prestamo = await db.Prestamo.findOne({
          where: { id_herramienta, estado_prestamo: "Activo" },
          order: [["fecha_salida", "ASC"], ["id_prestamo", "ASC"]],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
      }
      if (!prestamo) throw new ErrorNegocio("No hay un préstamo activo para devolver.");
      if (prestamo.estado_prestamo !== "Activo") throw new ErrorNegocio("Ese préstamo ya fue devuelto.");

      await prestamo.update({ estado_prestamo: "Finalizado", fecha_devolucion_real: new Date() }, { transaction });

      const herramienta = await db.Herramienta.findByPk(prestamo.id_herramienta, { transaction, lock: transaction.LOCK.UPDATE });
      if (herramienta && herramienta.estado === "En uso") {
        // Al volver una unidad, hay disponibilidad
        await herramienta.update({ estado: "Disponible" }, { transaction });
      }

      await transaction.commit();
      return { prestamo, herramienta };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

module.exports = prestamoService;
