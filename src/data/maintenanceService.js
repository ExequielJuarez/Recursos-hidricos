const db = require("../model/database/models");
const { Op } = require("sequelize");
const { hoyISO, esFechaValida } = require("../utils/fechas");
const { ErrorNegocio } = require("../utils/errores");

// Programado: próximo service por kilometraje (aún no se hizo). En proceso: el vehículo está en el taller.
// Realizado: service terminado (o registro histórico cargado a mano).
const ESTADOS_MANTENIMIENTO = ["Programado", "En proceso", "Realizado", "Cancelado"];
const ESTADOS_ALTA = ["Programado", "En proceso", "Realizado"]; // los que se pueden elegir al cargar una orden
const DIAS_RECIENTE = 15; // un service más viejo que esto se considera registro histórico
const ESTADOS_ABIERTOS = ["En proceso"]; // sólo estos mantienen al vehículo fuera de servicio

const aLista = (valor) => (valor === undefined ? [] : Array.isArray(valor) ? valor : [valor]);

const redondear = (n) => Math.round(n * 100) / 100;

// Cantidad de órdenes abiertas (pendientes o en proceso) de un vehículo
const ordenesAbiertas = (id_vehiculo, transaction, excluirId = null) => {
  const where = { id_vehiculo, estado: { [Op.in]: ESTADOS_ABIERTOS } };
  if (excluirId) where.id_mantenimiento = { [Op.ne]: excluirId };
  return db.Mantenimiento.count({ where, transaction });
};

// Datos administrativos del historial (todos opcionales): remito, factura, proveedor, pedido y expediente
const CAMPOS_ADMIN = [
  ["nro_remito", "N° de remito", 50],
  ["nro_factura", "N° de factura", 50],
  ["proveedor", "Casa proveedora", 150],
  ["nro_pedido", "N° de pedido", 50],
  ["nro_expediente", "N° de expediente", 50],
];
const datosAdministrativos = (body) => {
  const datos = {};
  for (const [campo, etiqueta, max] of CAMPOS_ADMIN) {
    const valor = String(body[campo] ?? "").trim();
    if (valor.length > max) throw new ErrorNegocio(`${etiqueta}: máximo ${max} caracteres.`);
    datos[campo] = valor || null;
  }
  return datos;
};

const maintenanceService = {
  ESTADOS_MANTENIMIENTO,
  CAMPOS_ADMIN,
  datosAdministrativos,

  // Un service programado a X km deja de tener sentido cuando ya se realizó otro a X km o más:
  // se cancela solo (queda registrado en sus observaciones).
  cancelarProgramadosObsoletos: async function (id_vehiculo, transaction = null) {
    const opciones = transaction ? { transaction } : {};
    const ultimoKm = await db.Mantenimiento.max("km_servicio", { where: { id_vehiculo, estado: "Realizado" }, ...opciones });
    if (!ultimoKm) return 0;
    const obsoletos = await db.Mantenimiento.findAll({
      where: { id_vehiculo, estado: "Programado", proximo_km: { [Op.lte]: ultimoKm } },
      ...opciones,
    });
    for (const m of obsoletos) {
      const nota = `Cancelado automáticamente: ya se realizó un service a los ${ultimoKm} km.`;
      await m.update({ estado: "Cancelado", observaciones: [m.observaciones, nota].filter(Boolean).join(" | ") }, opciones);
    }
    return obsoletos.length;
  },

  // Alta de una orden. Los importes se calculan SIEMPRE en el servidor a partir del detalle.
  crear: async function (body, id_usuario) {
    const transaction = await db.sequelize.transaction();
    try {
      const estado = body.estado;
      if (!ESTADOS_ALTA.includes(estado)) throw new ErrorNegocio("El estado de la orden no es válido.");

      const tipo = String(body.tipo_servicio || "").trim();
      if (!tipo) throw new ErrorNegocio("Indicá el tipo de servicio.");
      if (tipo.length > 100) throw new ErrorNegocio("El tipo de servicio no puede superar los 100 caracteres.");

      // ───────── Service PROGRAMADO: se maneja sólo por kilometraje ─────────
      if (estado === "Programado") {
        const vehiculoProg = await db.Vehiculo.findByPk(body.id_vehiculo, { transaction, lock: transaction.LOCK.UPDATE });
        if (!vehiculoProg) throw new ErrorNegocio("Seleccioná un vehículo válido.");
        if (vehiculoProg.estado_actual === "Baja") throw new ErrorNegocio("El vehículo está dado de baja.");
        if (!/^\d+$/.test(String(body.km_programado ?? ""))) throw new ErrorNegocio("Ingresá el kilometraje del service programado (número entero).");
        const kmProgramado = Number(body.km_programado);
        if (kmProgramado <= vehiculoProg.km_actual) {
          throw new ErrorNegocio(`El km del service programado (${kmProgramado}) debe ser mayor al km actual del vehículo (${vehiculoProg.km_actual}).`);
        }
        const repetido = await db.Mantenimiento.findOne({
          where: { id_vehiculo: vehiculoProg.id_vehiculo, estado: "Programado", proximo_km: kmProgramado },
          transaction,
        });
        if (repetido) throw new ErrorNegocio(`Ya hay un service programado para ese vehículo a los ${kmProgramado} km.`);

        const programado = await db.Mantenimiento.create(
          {
            id_vehiculo: vehiculoProg.id_vehiculo,
            id_usuario,
            fecha_inicio: hoyISO(), // fecha de carga: el service se programa por km, no por fecha
            fecha_fin: null,
            tipo_servicio: tipo,
            estado: "Programado",
            km_servicio: kmProgramado,
            proximo_km: kmProgramado,
            descripcion: String(body.descripcion || "").trim() || `Service programado a los ${kmProgramado} km`,
            observaciones: String(body.observaciones || "").trim() || null,
            costo_repuestos: 0,
            mano_obra: 0,
            costo_total: 0,
          },
          { transaction },
        );
        await transaction.commit();
        return { mantenimiento: programado, lineas: [] };
      }

      const descripcion = String(body.descripcion || "").trim();
      if (!descripcion) throw new ErrorNegocio("Describí las tareas realizadas.");

      if (!body.fecha_inicio || !esFechaValida(body.fecha_inicio)) throw new ErrorNegocio("La fecha de inicio no es válida.");
      if (body.fecha_inicio > hoyISO()) {
        throw new ErrorNegocio("La fecha del servicio no puede ser futura. Para un service futuro usá el estado Programado.");
      }

      if (!/^\d+$/.test(String(body.km_servicio ?? ""))) throw new ErrorNegocio("El kilometraje del servicio debe ser un número entero mayor o igual a 0.");
      const kmServicio = Number(body.km_servicio);
      let proximoKm = null;
      if (body.proximo_servicio_km !== undefined && body.proximo_servicio_km !== "") {
        if (!/^\d+$/.test(String(body.proximo_servicio_km))) throw new ErrorNegocio("El próximo servicio debe ser un número entero.");
        proximoKm = Number(body.proximo_servicio_km);
        if (proximoKm <= kmServicio) throw new ErrorNegocio("El próximo servicio (km) debe ser mayor al km del servicio actual.");
      }

      const manoObra = body.mano_obra === undefined || body.mano_obra === "" ? 0 : Number(body.mano_obra);
      if (!Number.isFinite(manoObra) || manoObra < 0) throw new ErrorNegocio("La mano de obra no puede ser negativa.");

      const vehiculo = await db.Vehiculo.findByPk(body.id_vehiculo, { transaction, lock: transaction.LOCK.UPDATE });
      if (!vehiculo) throw new ErrorNegocio("Seleccioná un vehículo válido.");
      if (vehiculo.estado_actual === "Baja") throw new ErrorNegocio("El vehículo está dado de baja.");
      if (vehiculo.estado_actual === "En siniestro") throw new ErrorNegocio("El vehículo está en siniestro: resolvelo antes de cargar un mantenimiento.");
      // Una orden EN PROCESO ocurre ahora, así que no puede tener menos km que el vehículo.
      // Una orden REALIZADA puede ser un registro histórico (papeles viejos): ahí el km puede ser menor al actual.
      if (estado === "En proceso" && kmServicio < vehiculo.km_actual) {
        throw new ErrorNegocio(`El km del servicio (${kmServicio}) no puede ser menor al actual del vehículo (${vehiculo.km_actual}).`);
      }

      // Un service con fecha vieja no puede tener más km que el vehículo hoy: sería un error de carga
      // (y subiría el km actual del vehículo). Sólo los recientes pueden adelantar el km.
      if (estado === "Realizado" && kmServicio > vehiculo.km_actual) {
        const limiteReciente = new Date(Date.now() - DIAS_RECIENTE * 86400000 - 3 * 3600000).toISOString().slice(0, 10);
        if (body.fecha_inicio < limiteReciente) {
          throw new ErrorNegocio(
            `El km del servicio (${kmServicio}) supera el km actual del vehículo (${vehiculo.km_actual}) y la fecha es anterior a ${DIAS_RECIENTE} días. Revisá el km (o actualizá primero el kilometraje del vehículo).`,
          );
        }
      }

      const abierta = estado === "En proceso";
      if (abierta && vehiculo.estado_actual === "En uso") {
        throw new ErrorNegocio("El vehículo está en uso (asignado a un chofer): finalizá la asignación antes de enviarlo a mantenimiento.");
      }

      // ── Detalle de repuestos ──
      const ids = aLista(body.id_repuesto);
      const cantidades = aLista(body.cantidad);
      const costos = aLista(body.costo_unitario);
      const lineas = [];
      const acumulado = new Map(); // total pedido por repuesto (mismo repuesto en varias filas)

      for (let i = 0; i < ids.length; i++) {
        if (!ids[i]) continue;
        const cantidad = Number(cantidades[i] === undefined || cantidades[i] === "" ? 1 : cantidades[i]);
        const costo = Number(costos[i] === undefined || costos[i] === "" ? 0 : costos[i]);
        if (!Number.isInteger(cantidad) || cantidad < 1) throw new ErrorNegocio("La cantidad de cada repuesto debe ser un entero mayor a 0.");
        if (!Number.isFinite(costo) || costo < 0) throw new ErrorNegocio("El costo unitario no puede ser negativo.");
        lineas.push({ id_repuesto: Number(ids[i]), cantidad, costo });
        acumulado.set(Number(ids[i]), (acumulado.get(Number(ids[i])) || 0) + cantidad);
      }

      const repuestos = new Map();
      for (const [idRepuesto, pedido] of acumulado) {
        const repuesto = await db.Repuesto.findByPk(idRepuesto, { transaction, lock: transaction.LOCK.UPDATE });
        if (!repuesto) throw new ErrorNegocio("Uno de los repuestos seleccionados no existe.");
        if (repuesto.stock < pedido) {
          throw new ErrorNegocio(`Stock insuficiente de "${repuesto.nombre}": pedís ${pedido} y hay ${repuesto.stock}.`);
        }
        repuestos.set(idRepuesto, repuesto);
      }

      const costoRepuestos = redondear(lineas.reduce((t, l) => t + l.cantidad * l.costo, 0));
      const costoTotal = redondear(costoRepuestos + manoObra);

      const mantenimiento = await db.Mantenimiento.create(
        {
          id_vehiculo: vehiculo.id_vehiculo,
          id_usuario,
          fecha_inicio: body.fecha_inicio,
          fecha_fin: estado === "Realizado" ? hoyISO() : null,
          tipo_servicio: tipo,
          estado,
          km_servicio: kmServicio,
          proximo_km: proximoKm,
          descripcion,
          observaciones: String(body.observaciones || "").trim() || null,
          costo_repuestos: costoRepuestos,
          mano_obra: redondear(manoObra),
          costo_total: costoTotal,
          ...datosAdministrativos(body),
        },
        { transaction },
      );

      for (const l of lineas) {
        await db.DetalleMantenimiento.create(
          {
            id_mantenimiento: mantenimiento.id_mantenimiento,
            id_repuesto: l.id_repuesto,
            cantidad: l.cantidad,
            costo_unitario: l.costo,
          },
          { transaction },
        );
      }
      for (const [idRepuesto, pedido] of acumulado) {
        const repuesto = repuestos.get(idRepuesto);
        await repuesto.update({ stock: repuesto.stock - pedido }, { transaction });
      }

      // ── Estado y kilometraje del vehículo ──
      const cambios = {};
      if (abierta) {
        cambios.estado_actual = "En mantenimiento";
      } else {
        if (kmServicio > vehiculo.km_actual) {
          cambios.km_actual = kmServicio;
          await db.HistorialKm.create(
            {
              id_vehiculo: vehiculo.id_vehiculo,
              km_anterior: vehiculo.km_actual,
              km_nuevo: kmServicio,
              fecha: hoyISO(),
              observaciones: `Actualizado por el mantenimiento #${mantenimiento.id_mantenimiento}`,
            },
            { transaction },
          );
        }
        if (vehiculo.estado_actual === "En mantenimiento" && (await ordenesAbiertas(vehiculo.id_vehiculo, transaction)) === 0) {
          cambios.estado_actual = "Disponible";
        }
      }
      if (Object.keys(cambios).length) await vehiculo.update(cambios, { transaction });
      if (estado === "Realizado") await maintenanceService.cancelarProgramadosObsoletos(vehiculo.id_vehiculo, transaction);

      await transaction.commit();
      return { mantenimiento, lineas };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  // Cambio de estado de una orden existente: Programado → En proceso → Realizado
  cambiarEstado: async function (id, nuevoEstado, kmServicio) {
    const transaction = await db.sequelize.transaction();
    try {
      if (!ESTADOS_MANTENIMIENTO.includes(nuevoEstado)) throw new ErrorNegocio("El estado de la orden no es válido.");

      const mantenimiento = await db.Mantenimiento.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!mantenimiento) throw new ErrorNegocio("La orden de mantenimiento no existe.");

      const anterior = mantenimiento.estado;
      if (anterior === nuevoEstado) throw new ErrorNegocio(`La orden ya está en estado "${nuevoEstado}".`);
      if (anterior === "Realizado") throw new ErrorNegocio("Una orden Realizada no puede volver a abrirse.");
      if (anterior === "Cancelado") throw new ErrorNegocio("Una orden Cancelada no puede volver a abrirse.");
      if (nuevoEstado === "Programado") throw new ErrorNegocio("Una orden en curso no puede volver a Programado.");
      if (nuevoEstado === "Cancelado" && anterior !== "Programado") {
        throw new ErrorNegocio("Sólo se puede cancelar un service Programado (uno en proceso ya consumió repuestos: finalizalo).");
      }

      const vehiculo = await db.Vehiculo.findByPk(mantenimiento.id_vehiculo, { transaction, lock: transaction.LOCK.UPDATE });
      const cambiosOrden = { estado: nuevoEstado };
      const cambiosVehiculo = {};
      const eraProgramado = anterior === "Programado";

      if (nuevoEstado === "Cancelado") {
        cambiosOrden.observaciones = [mantenimiento.observaciones, "Cancelado manualmente."].filter(Boolean).join(" | ");
      } else if (nuevoEstado === "En proceso") {
        if (vehiculo) {
          if (["Baja", "En siniestro"].includes(vehiculo.estado_actual)) {
            throw new ErrorNegocio(`No se puede iniciar: el vehículo está "${vehiculo.estado_actual}".`);
          }
          if (vehiculo.estado_actual === "En uso") {
            throw new ErrorNegocio("El vehículo está en uso (asignado a un chofer): finalizá la asignación antes de enviarlo al taller.");
          }
          if (vehiculo.estado_actual === "Disponible") cambiosVehiculo.estado_actual = "En mantenimiento";
          cambiosOrden.km_servicio = vehiculo.km_actual; // entra al taller con el km actual
        }
        cambiosOrden.fecha_inicio = hoyISO();
        cambiosOrden.proximo_km = null; // el km programado ya se cumplió
      } else {
        // Realizado
        cambiosOrden.fecha_fin = hoyISO();
        let km = kmServicio !== undefined && kmServicio !== "" ? Number(kmServicio) : mantenimiento.km_servicio;
        if (eraProgramado) {
          // Un service programado se realiza al km real del vehículo
          km = vehiculo ? Math.max(vehiculo.km_actual, Number.isInteger(km) && kmServicio ? km : 0) : km;
          cambiosOrden.km_servicio = km;
          cambiosOrden.fecha_inicio = hoyISO();
          cambiosOrden.proximo_km = null;
        }
        if (vehiculo) {
          if (Number.isInteger(km) && km > vehiculo.km_actual) {
            cambiosVehiculo.km_actual = km;
            await db.HistorialKm.create(
              {
                id_vehiculo: vehiculo.id_vehiculo,
                km_anterior: vehiculo.km_actual,
                km_nuevo: km,
                fecha: hoyISO(),
                observaciones: `Actualizado por el mantenimiento #${mantenimiento.id_mantenimiento}`,
              },
              { transaction },
            );
          }
          if (vehiculo.estado_actual === "En mantenimiento" && (await ordenesAbiertas(vehiculo.id_vehiculo, transaction, mantenimiento.id_mantenimiento)) === 0) {
            cambiosVehiculo.estado_actual = "Disponible";
          }
        }
      }

      await mantenimiento.update(cambiosOrden, { transaction });
      if (vehiculo && Object.keys(cambiosVehiculo).length) await vehiculo.update(cambiosVehiculo, { transaction });
      if (nuevoEstado === "Realizado") await maintenanceService.cancelarProgramadosObsoletos(mantenimiento.id_vehiculo, transaction);

      await transaction.commit();
      return { mantenimiento, anterior };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

module.exports = maintenanceService;
