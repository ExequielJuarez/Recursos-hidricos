const db = require("../model/database/models");
const { Op } = require("sequelize");
const { hoyISO, aISO, esFechaValida } = require("../utils/fechas");
const { ErrorNegocio } = require("../utils/errores");

const ESTADOS_VEHICULO = ["Disponible", "En uso", "En mantenimiento", "En siniestro", "Baja"];
const TRANSMISIONES = ["Manual", "Automática"];

const texto = (valor) => {
  const v = String(valor === undefined || valor === null ? "" : valor).trim();
  return v === "" ? null : v;
};

const errorPorDuplicado = (error) => {
  if (error && error.name === "SequelizeUniqueConstraintError") {
    const campo = error.errors && error.errors[0] ? error.errors[0].path : "";
    const nombres = {
      patente: "la patente",
      legajo: "el legajo",
      num_chasis: "el número de chasis",
      num_motor: "el número de motor",
      cedula_numero: "el número de cédula",
    };
    const clave = Object.keys(nombres).find((k) => String(campo).includes(k));
    return new ErrorNegocio(`Ya existe un vehículo con ${clave ? nombres[clave] : "esos datos"}.`);
  }
  return error;
};

const vehicleService = {
  ESTADOS_VEHICULO,

  getAll: async function () {
    try {
      return await db.Vehiculo.findAll({
        include: [{ association: "TipoVehiculo" }],
        order: [["patente", "ASC"]],
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  },

  getOne: async function (id) {
    try {
      return await db.Vehiculo.findByPk(id, {
        include: [{ association: "TipoVehiculo" }],
      });
    } catch (error) {
      console.log(error);
      return null;
    }
  },

  // Valida los datos del alta y devuelve la lista de errores (vacía si está todo bien)
  validarAlta: async function (body) {
    const errores = [];
    const anioNum = parseInt(body.anio, 10);
    const anioActual = new Date().getFullYear() + 1;

    const patente = String(body.patente || "").replace(/\s+/g, "").toUpperCase();
    if (!patente) errores.push("La patente es obligatoria.");
    else if (!/^[A-Z0-9-]{5,10}$/.test(patente)) errores.push("La patente sólo puede tener letras y números (5 a 10 caracteres).");

    if (!body.id_tipo) errores.push("El tipo de vehículo es obligatorio.");
    else if (!(await db.TipoVehiculo.findByPk(body.id_tipo))) errores.push("El tipo de vehículo seleccionado no existe.");

    if (!texto(body.marca)) errores.push("La marca es obligatoria.");
    if (!texto(body.modelo)) errores.push("El modelo es obligatorio.");
    if (!body.anio || Number.isNaN(anioNum) || anioNum < 1900 || anioNum > anioActual) {
      errores.push(`El año debe estar entre 1900 y ${anioActual}.`);
    }
    if (!texto(body.chasis)) errores.push("El número de chasis es obligatorio.");
    if (!texto(body.num_motor)) errores.push("El número de motor es obligatorio.");

    if (!body.estado_actual) errores.push("El estado es obligatorio.");
    else if (!ESTADOS_VEHICULO.includes(body.estado_actual)) errores.push("El estado seleccionado no es válido.");
    else if (body.estado_actual === "En uso") errores.push('Un vehículo pasa a "En uso" al asignarle un chofer desde Asignaciones.');
    else if (body.estado_actual === "En siniestro") errores.push('El estado "En siniestro" se asigna al registrar un siniestro.');
    else if (body.estado_actual === "En mantenimiento") errores.push('Un vehículo pasa a "En mantenimiento" al iniciar una orden En proceso desde Mantenimientos.');

    if (body.km_actual === "" || body.km_actual === undefined || !/^\d+$/.test(String(body.km_actual))) {
      errores.push("El kilometraje es obligatorio, entero y no puede ser negativo.");
    }
    if (!body.fecha_alta || !esFechaValida(body.fecha_alta)) errores.push("La fecha de alta es obligatoria.");
    else if (body.fecha_alta > hoyISO()) errores.push("La fecha de alta no puede ser futura.");
    else if (anioNum && new Date(body.fecha_alta).getUTCFullYear() < anioNum) {
      errores.push("La fecha de alta no puede ser anterior al año del vehículo.");
    }
    if (body.transmision && !TRANSMISIONES.includes(body.transmision)) errores.push("La transmisión no es válida.");
    if (body.seguro_vencimiento && !esFechaValida(body.seguro_vencimiento)) errores.push("La fecha de vencimiento del seguro no es válida.");
    if (body.rto_vencimiento && !esFechaValida(body.rto_vencimiento)) errores.push("La fecha de vencimiento de la RTO no es válida.");

    // Duplicados: se informan todos juntos, antes de intentar guardar
    const duplicados = [
      ["patente", patente, "la patente"],
      ["num_chasis", texto(body.chasis), "el número de chasis"],
      ["num_motor", texto(body.num_motor), "el número de motor"],
      ["cedula_numero", texto(body.cedula_numero), "el número de cédula"],
    ];
    for (const [campo, valor, etiqueta] of duplicados) {
      if (valor && (await db.Vehiculo.findOne({ where: { [campo]: valor } }))) {
        errores.push(`Ya existe un vehículo con ${etiqueta} "${valor}".`);
      }
    }
    return errores;
  },

  create: async function (req) {
    const body = req.body;
    try {
      return await db.Vehiculo.create({
        patente: String(body.patente).replace(/\s+/g, "").toUpperCase(),
        id_tipo: body.id_tipo,
        marca: body.marca.trim(),
        modelo: body.modelo.trim(),
        anio: body.anio,
        num_chasis: texto(body.chasis),
        num_motor: texto(body.num_motor),
        combustible: texto(body.combustible),
        transmision: texto(body.transmision),
        estado_actual: body.estado_actual,
        km_actual: body.km_actual,
        distrito: texto(body.distrito),
        observaciones: texto(body.observaciones),
        fecha_alta: body.fecha_alta,
        fecha_baja: body.estado_actual === "Baja" ? hoyISO() : null,
        cedula_numero: texto(body.cedula_numero),
        cedula_titular: texto(body.cedula_titular),
        seguro_compania: texto(body.seguro_compania),
        seguro_vencimiento: texto(body.seguro_vencimiento),
        rto_vencimiento: texto(body.rto_vencimiento),
        foto_cedula: req.files?.foto_cedula?.[0]?.filename || null,
        foto_titulo: req.files?.foto_titulo?.[0]?.filename || null,
        foto_rto: req.files?.foto_rto?.[0]?.filename || null,
      });
    } catch (error) {
      throw errorPorDuplicado(error);
    }
  },

  update: async function (id, body, files = {}) {
    const transaction = await db.sequelize.transaction();
    try {
      const vehiculo = await db.Vehiculo.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!vehiculo) throw new ErrorNegocio("El vehículo no existe.");
      const valorAnterior = vehiculo.toJSON();

      const estado = body.estado_actual;
      if (!ESTADOS_VEHICULO.includes(estado)) throw new ErrorNegocio("El estado seleccionado no es válido.");

      const asignacionActiva = await db.AsignacionVehiculo.findOne({
        where: { id_vehiculo: id, estado: "Activo" },
        transaction,
      });
      if (estado !== vehiculo.estado_actual) {
        if (estado === "En uso" && !asignacionActiva) {
          throw new ErrorNegocio('Un vehículo pasa a "En uso" al asignarle un chofer desde Asignaciones.');
        }
        if (estado === "En siniestro") {
          throw new ErrorNegocio('El estado "En siniestro" se asigna al registrar un siniestro.');
        }
        if (estado === "En mantenimiento") {
          throw new ErrorNegocio('Un vehículo pasa a "En mantenimiento" al iniciar una orden En proceso desde Mantenimientos.');
        }
        if (vehiculo.estado_actual === "En mantenimiento") {
          const abiertas = await db.Mantenimiento.count({ where: { id_vehiculo: id, estado: "En proceso" }, transaction });
          if (abiertas > 0) throw new ErrorNegocio("El vehículo tiene una orden de mantenimiento En proceso: finalizala desde Mantenimientos antes de cambiar su estado.");
        }
        if (vehiculo.estado_actual === "En siniestro") {
          const abiertos = await db.Siniestro.count({ where: { id_vehiculo: id, estado: "EN PROCESO" }, transaction });
          if (abiertos > 0) throw new ErrorNegocio("El vehículo tiene un siniestro en proceso: resolvelo desde Siniestros antes de cambiar su estado.");
        }
        if (asignacionActiva && estado !== "En uso") {
          throw new ErrorNegocio("El vehículo tiene una asignación activa: finalizala desde Asignaciones antes de cambiar su estado.");
        }
      }

      if (!/^\d+$/.test(String(body.km_actual))) throw new ErrorNegocio("El kilometraje debe ser un número entero mayor o igual a 0.");
      const kmNuevo = Number(body.km_actual);
      if (kmNuevo < vehiculo.km_actual) {
        throw new ErrorNegocio(`El kilometraje no puede ser menor al actual (${vehiculo.km_actual} km).`);
      }

      if (body.seguro_vencimiento && !esFechaValida(body.seguro_vencimiento)) throw new ErrorNegocio("La fecha de vencimiento del seguro no es válida.");
      if (body.rto_vencimiento && !esFechaValida(body.rto_vencimiento)) throw new ErrorNegocio("La fecha de vencimiento de la RTO no es válida.");
      if (body.fecha_baja && !esFechaValida(body.fecha_baja)) throw new ErrorNegocio("La fecha de baja no es válida.");
      if (body.transmision && !TRANSMISIONES.includes(body.transmision)) throw new ErrorNegocio("La transmisión no es válida.");

      const datos = {
        estado_actual: estado,
        km_actual: kmNuevo,
        distrito: texto(body.distrito),
        observaciones: texto(body.observaciones),
        combustible: texto(body.combustible),
        transmision: texto(body.transmision),
        cedula_numero: texto(body.cedula_numero),
        cedula_titular: texto(body.cedula_titular),
        seguro_compania: texto(body.seguro_compania),
        seguro_vencimiento: texto(body.seguro_vencimiento),
        rto_vencimiento: texto(body.rto_vencimiento),
        // La fecha de baja sólo tiene sentido si el vehículo está de baja
        fecha_baja: estado === "Baja" ? texto(body.fecha_baja) || aISO(vehiculo.fecha_baja) || hoyISO() : null,
      };

      if (files?.foto_cedula?.[0]) datos.foto_cedula = files.foto_cedula[0].filename;
      if (files?.foto_titulo?.[0]) datos.foto_titulo = files.foto_titulo[0].filename;
      if (files?.foto_rto?.[0]) datos.foto_rto = files.foto_rto[0].filename;

      await vehiculo.update(datos, { transaction });

      // Todo cambio de kilometraje deja rastro en el historial
      if (kmNuevo !== valorAnterior.km_actual) {
        await db.HistorialKm.create(
          {
            id_vehiculo: vehiculo.id_vehiculo,
            km_anterior: valorAnterior.km_actual,
            km_nuevo: kmNuevo,
            fecha: hoyISO(),
            observaciones: "Corrección desde la edición de la ficha",
          },
          { transaction },
        );
      }

      await transaction.commit();
      return { valorAnterior, valorNuevo: datos, fotosAnteriores: { foto_cedula: valorAnterior.foto_cedula, foto_titulo: valorAnterior.foto_titulo, foto_rto: valorAnterior.foto_rto } };
    } catch (error) {
      await transaction.rollback();
      throw errorPorDuplicado(error);
    }
  },

  /* =========================================================
       MANTENIMIENTOS (lectura)
    ========================================================= */

  getAllMantenimientos: async () => {
    try {
      const mantenimientos = await db.Mantenimiento.findAll({
        include: [
          { association: "vehiculo", include: [{ association: "TipoVehiculo", attributes: ["unidad"] }] },
          { association: "detalles" },
        ],
        order: [
          ["fecha_inicio", "DESC"],
          ["id_mantenimiento", "DESC"],
        ],
      });

      return mantenimientos.map((m) => {
        const mant = m.toJSON();
        mant.proximo_servicio_km = mant.proximo_km;

        // Los importes guardados son la fuente de verdad; si no hay, se derivan del detalle
        const costoTotal = Number(mant.costo_total) || 0;
        let costoRepuestos = Number(mant.costo_repuestos) || 0;
        if (!costoRepuestos && mant.detalles && mant.detalles.length > 0) {
          costoRepuestos = mant.detalles.reduce((t, d) => t + Number(d.cantidad) * Number(d.costo_unitario), 0);
        }
        mant.costo_repuestos = costoRepuestos;
        mant.mano_obra = Number(mant.mano_obra) || Math.max(0, costoTotal - costoRepuestos);
        return mant;
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  },

  getLastMantenimientos: async function (id_vehiculo, limit = 3) {
    try {
      return await db.Mantenimiento.findAll({
        where: { id_vehiculo },
        order: [
          ["fecha_inicio", "DESC"],
          ["id_mantenimiento", "DESC"],
        ],
        limit,
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  },

  // Historial completo de mantenimientos de un vehículo (con repuestos y responsable)
  getMantenimientosCompletos: async function (id_vehiculo) {
    const ordenes = await db.Mantenimiento.findAll({
      where: { id_vehiculo },
      include: [
        { association: "usuario", attributes: ["nombre", "apellido"], required: false },
        { association: "detalles", required: false, include: [{ association: "repuesto", attributes: ["nombre"], required: false }] },
      ],
      order: [
        ["fecha_inicio", "DESC"],
        ["id_mantenimiento", "DESC"],
      ],
    });
    return ordenes.map((m) => {
      const o = m.toJSON();
      const costoRepuestos = Number(o.costo_repuestos) || (o.detalles || []).reduce((t, d) => t + Number(d.cantidad) * Number(d.costo_unitario), 0);
      o.costo_repuestos = costoRepuestos;
      o.mano_obra = Number(o.mano_obra) || Math.max(0, (Number(o.costo_total) || 0) - costoRepuestos);
      o.costo_total = Number(o.costo_total) || 0;
      return o;
    });
  },

  getLastAsignaciones: async function (id_vehiculo, limit = 3) {
    try {
      return await db.AsignacionVehiculo.findAll({
        where: { id_vehiculo },
        order: [["fecha_salida", "DESC"]],
        limit,
        include: [{ association: "Chofer" }],
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  },

  getAsignacionActiva: async function (id_vehiculo) {
    try {
      return await db.AsignacionVehiculo.findOne({
        where: { id_vehiculo, estado: "Activo" },
        include: [{ association: "Chofer" }],
      });
    } catch (error) {
      console.log(error);
      return null;
    }
  },

  /* =========================================================
       KILOMETRAJE
    ========================================================= */

  actualizarKm: async function (id_vehiculo, km_nuevo, fecha, observaciones) {
    const transaction = await db.sequelize.transaction();
    try {
      const vehiculo = await db.Vehiculo.findByPk(id_vehiculo, { transaction, lock: transaction.LOCK.UPDATE });
      if (!vehiculo) throw new ErrorNegocio("El vehículo no existe.");
      if (vehiculo.estado_actual === "Baja") throw new ErrorNegocio("El vehículo está dado de baja.");
      if (!Number.isInteger(km_nuevo) || km_nuevo < 0) throw new ErrorNegocio("Ingresá un kilometraje entero mayor o igual a 0.");
      if (km_nuevo < vehiculo.km_actual) {
        throw new ErrorNegocio(`El kilometraje nuevo (${km_nuevo} km) no puede ser menor al actual (${vehiculo.km_actual} km).`);
      }
      if (!esFechaValida(fecha)) throw new ErrorNegocio("La fecha de actualización no es válida.");
      if (fecha > hoyISO()) throw new ErrorNegocio("La fecha de actualización no puede ser futura.");

      const km_anterior = vehiculo.km_actual;
      await vehiculo.update({ km_actual: km_nuevo }, { transaction });
      await db.HistorialKm.create(
        {
          id_vehiculo,
          km_anterior,
          km_nuevo,
          fecha,
          observaciones: texto(observaciones),
        },
        { transaction },
      );

      await transaction.commit();
      return { vehiculo, km_anterior };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  getHistorialKm: async function (id_vehiculo = null) {
    try {
      const where = id_vehiculo ? { id_vehiculo } : {};

      return await db.HistorialKm.findAll({
        where,
        order: [
          ["fecha", "DESC"],
          ["id_historial", "DESC"],
        ],
        include: [
          {
            association: "vehiculo",
            attributes: ["patente", "marca", "modelo"],
          },
        ],
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  },

  getVehiculosConHistorial: async function () {
    try {
      const ids = await db.HistorialKm.findAll({ attributes: ["id_vehiculo"], group: ["id_vehiculo"], raw: true });
      if (!ids.length) return [];
      return await db.Vehiculo.findAll({
        where: { id_vehiculo: { [Op.in]: ids.map((r) => r.id_vehiculo) } },
        attributes: ["id_vehiculo", "patente", "marca", "modelo", "km_actual"],
        order: [["patente", "ASC"]],
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  },
};

module.exports = vehicleService;
