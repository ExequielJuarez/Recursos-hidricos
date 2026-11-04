const db = require("../model/database/models");
const { Op } = require("sequelize");
const { ErrorNegocio } = require("../utils/errores");

const ESTADOS_HERRAMIENTA = ["Disponible", "En uso", "En Reparación", "Baja"];

const texto = (valor) => {
  const v = String(valor === undefined || valor === null ? "" : valor).trim();
  return v === "" ? null : v;
};

const prestamosActivos = (id_herramienta, transaction) =>
  db.Prestamo.count({ where: { id_herramienta, estado_prestamo: "Activo" }, transaction });

const toolService = {
  ESTADOS_HERRAMIENTA,

  getAll: async function () {
    try {
      return await db.Herramienta.findAll({ order: [["nombre", "ASC"]] });
    } catch (error) {
      console.log("Error en toolService.getAll:", error);
      return [];
    }
  },

  getOne: async function (id) {
    try {
      return await db.Herramienta.findByPk(id);
    } catch (error) {
      console.log("Error en toolService.getOne:", error);
      return null;
    }
  },

  getWithPrestamos: async function (id) {
    return db.Herramienta.findByPk(id, {
      include: [{ association: "prestamos" }],
      order: [
        [{ model: db.Prestamo, as: "prestamos" }, "fecha_salida", "DESC"],
        [{ model: db.Prestamo, as: "prestamos" }, "id_prestamo", "DESC"],
      ],
    });
  },

  _validar: async function (data, idActual = null) {
    const codigo = texto(data.codigo_activo);
    const nombre = texto(data.nombre);
    if (!codigo || codigo.length > 50) throw new ErrorNegocio("Ingresá el código de activo (hasta 50 caracteres).");
    if (!nombre || nombre.length > 100) throw new ErrorNegocio("Ingresá el nombre de la herramienta (hasta 100 caracteres).");

    const stock = data.stock === undefined || data.stock === "" ? 1 : Number(data.stock);
    if (!Number.isInteger(stock) || stock < 0) throw new ErrorNegocio("El stock debe ser un número entero mayor o igual a 0.");

    const where = { codigo_activo: codigo };
    if (idActual) where.id_herramienta = { [Op.ne]: idActual };
    if (await db.Herramienta.findOne({ where })) throw new ErrorNegocio(`Ya existe una herramienta con el código "${codigo}".`);

    const sector = texto(data.sector);
    if (sector && !(await db.Sector.findOne({ where: { nombre: sector } }))) {
      throw new ErrorNegocio("El sector seleccionado no existe. Cargalo primero en Ajustes.");
    }

    return { codigo, nombre, stock, sector };
  },

  create: async function (req) {
    const data = req.body;
    const { codigo, nombre, stock, sector } = await toolService._validar(data);

    const estado = data.estado || "Disponible";
    if (!["Disponible", "En Reparación", "Baja"].includes(estado)) throw new ErrorNegocio("El estado inicial no es válido.");

    return db.Herramienta.create({
      codigo_activo: codigo,
      nombre,
      sector,
      estado,
      stock,
      combustible_energia: texto(data.combustible_energia),
      observaciones: texto(data.observaciones),
      imagen_url: null,
      fecha_alta: data.fecha_alta && !Number.isNaN(Date.parse(data.fecha_alta)) ? data.fecha_alta : new Date(),
    });
  },

  update: async function (req) {
    const id = req.params.id;
    const data = req.body;
    const herramienta = await db.Herramienta.findByPk(id);
    if (!herramienta) throw new ErrorNegocio("La herramienta no existe.");

    const { codigo, nombre, stock, sector } = await toolService._validar(data, id);
    if (!ESTADOS_HERRAMIENTA.includes(data.estado)) throw new ErrorNegocio("El estado seleccionado no es válido.");

    const activos = await prestamosActivos(id);
    if (stock < activos) throw new ErrorNegocio(`El stock no puede ser menor a los préstamos activos (${activos}).`);

    let estado = data.estado;
    if (activos > 0 && ["En Reparación", "Baja"].includes(estado)) {
      throw new ErrorNegocio("La herramienta tiene préstamos activos: registrá la devolución antes de cambiar su estado.");
    }
    if (["Disponible", "En uso"].includes(estado)) {
      // "En uso" / "Disponible" se derivan de los préstamos activos
      estado = activos > 0 && activos >= stock ? "En uso" : "Disponible";
    }

    const cambios = {
      codigo_activo: codigo,
      nombre,
      sector,
      stock,
      estado,
      combustible_energia: texto(data.combustible_energia),
      observaciones: texto(data.observaciones),
    };
    if (data.fecha_alta && !Number.isNaN(Date.parse(data.fecha_alta))) cambios.fecha_alta = data.fecha_alta;

    const anterior = herramienta.toJSON();
    await herramienta.update(cambios);
    return { anterior, nuevo: cambios };
  },

  // Elimina la herramienta y su historial de préstamos (sólo si no tiene préstamos activos)
  delete: async function (id) {
    const transaction = await db.sequelize.transaction();
    try {
      const herramienta = await db.Herramienta.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!herramienta) throw new ErrorNegocio("La herramienta no existe.");

      if ((await prestamosActivos(id, transaction)) > 0) {
        throw new ErrorNegocio("No se puede eliminar: la herramienta tiene préstamos activos. Registrá primero la devolución.");
      }

      const historial = await db.Prestamo.count({ where: { id_herramienta: id }, transaction });
      const snapshot = herramienta.toJSON();

      await db.Prestamo.destroy({ where: { id_herramienta: id }, transaction });
      await db.Alerta.destroy({ where: { tipo: "prestamo_vencido", entidad_tipo: "Herramienta", entidad_id: id }, transaction });
      await herramienta.destroy({ transaction });

      await transaction.commit();
      return { snapshot, historial };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

module.exports = toolService;
