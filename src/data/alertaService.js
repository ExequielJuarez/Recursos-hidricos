const db = require("../model/database/models");
const { Op } = require("sequelize");
const { diasHasta } = require("../utils/fechas");
const maintenanceService = require("./maintenanceService");

const recortar = (texto, max) => String(texto == null ? "" : texto).slice(0, max);

// Las generaciones se ejecutan de a una (evita alertas duplicadas si dos pedidos coinciden)
let cola = Promise.resolve();
const serializar = (tarea) => {
  const corrida = cola.then(tarea, tarea);
  cola = corrida.catch(() => {});
  return corrida;
};

/**
 * Sincroniza un grupo de alertas automáticas con la realidad:
 *  - crea las que faltan,
 *  - actualiza mensaje/prioridad de las existentes (sin reabrir las ya leídas salvo que cambie el tipo o la prioridad),
 *  - elimina las que ya no corresponden (documento renovado, service hecho, préstamo devuelto...).
 * `deseadas`: [{ clave, tipo, prioridad, mensaje, entidad_tipo, entidad_id, entidad_nombre }]
 * `existentes`: alertas actuales del grupo; `claveDe(alerta)` devuelve su clave.
 */
const sincronizarGrupo = async (deseadas, existentes, claveDe) => {
  const porClave = new Map();
  const sobrantes = [];
  for (const alerta of existentes) {
    const clave = claveDe(alerta);
    if (clave && !porClave.has(clave)) porClave.set(clave, alerta);
    else sobrantes.push(alerta);
  }

  const vigentes = new Set();
  for (const d of deseadas) {
    vigentes.add(d.clave);
    const actual = porClave.get(d.clave);
    const datos = {
      tipo: d.tipo,
      prioridad: d.prioridad,
      mensaje: recortar(d.mensaje, 255),
      entidad_tipo: d.entidad_tipo,
      entidad_id: d.entidad_id,
      entidad_nombre: recortar(d.entidad_nombre, 100),
    };
    if (!actual) {
      await db.Alerta.create({ ...datos, generada_automaticamente: true });
    } else {
      const cambioImportante = actual.tipo !== d.tipo || actual.prioridad !== d.prioridad;
      const cambios = { ...datos };
      if (cambioImportante) cambios.leida = false;
      await actual.update(cambios);
    }
  }

  for (const [clave, alerta] of porClave) {
    if (!vigentes.has(clave)) await alerta.destroy();
  }
  for (const alerta of sobrantes) await alerta.destroy();
};

const alertaService = {
  getAll: async function (filtros = {}) {
    try {
      const where = {};

      if (filtros.tipo) where.tipo = filtros.tipo;
      if (filtros.prioridad) where.prioridad = filtros.prioridad;

      if (filtros.estado === "leida") where.leida = true;
      if (filtros.estado === "no_leida") where.leida = false;

      if (filtros.buscar) {
        where[Op.or] = [
          { mensaje: { [Op.like]: `%${filtros.buscar}%` } },
          { entidad_nombre: { [Op.like]: `%${filtros.buscar}%` } },
        ];
      }

      if (filtros.fechaDesde && filtros.fechaHasta) {
        where.createdAt = {
          [Op.gte]: new Date(filtros.fechaDesde),
          [Op.lt]: new Date(
            new Date(filtros.fechaHasta).setDate(
              new Date(filtros.fechaHasta).getDate() + 1,
            ),
          ),
        };
      }

      const limite = parseInt(filtros.limite) || 10;
      const pagina = parseInt(filtros.pagina) || 1;
      const offset = (pagina - 1) * limite;

      const { count, rows } = await db.Alerta.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: limite,
        offset: offset,
        distinct: true,
      });

      return {
        alertas: rows,
        totalRegistros: count,
        totalPaginas: Math.ceil(count / limite),
        paginaActual: pagina,
        limite,
      };
    } catch (error) {
      console.log(error);
      return { alertas: [], totalRegistros: 0, totalPaginas: 0, paginaActual: 1, limite: 10 };
    }
  },

  getRecientes: async function (limite = 8) {
    try {
      return await db.Alerta.findAll({
        where: { leida: false },
        order: [["createdAt", "DESC"]],
        limit: limite,
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  },

  contarNoLeidas: async function () {
    try {
      return await db.Alerta.count({ where: { leida: false } });
    } catch (error) {
      console.log(error);
      return 0;
    }
  },

  getResumen: async function () {
    try {
        const [licVencidas, licProximas, docsVencidas, siniestrosActivos, mantProximos] = await Promise.all([
            db.Alerta.count({ where: { tipo: 'licencia_vencida',   leida: false } }),
            db.Alerta.count({ where: { tipo: 'licencia_proxima',   leida: false } }),
            db.Alerta.count({ where: { tipo: 'documentacion_vencida', leida: false } }),
            db.Alerta.count({ where: { tipo: 'siniestro_activo',   leida: false } }),
            db.Alerta.count({ where: { tipo: { [Op.in]: ['mantenimiento_proximo', 'mantenimiento_vencido'] }, leida: false } }),
        ]);

        return { licVencidas, licProximas, docsVencidas, siniestrosActivos, mantProximos };
    } catch (error) {
        console.log("Error en getResumen:", error);
        return { licVencidas: 0, licProximas: 0, docsVencidas: 0, siniestrosActivos: 0, mantProximos: 0 };
    }
},

  getEstadisticasGraficos: async function () {
    try {
      const [vehiculos, choferes] = await Promise.all([
        db.Vehiculo.findAll({ attributes: ["estado_actual"] }),
        db.Chofer.findAll({ attributes: ["estado"] }),
      ]);

      const statsVehiculos = { disponible: 0, uso: 0, mantenimiento: 0, baja: 0 };
      vehiculos.forEach((v) => {
        if (v.estado_actual === "Disponible") statsVehiculos.disponible++;
        else if (v.estado_actual === "En uso") statsVehiculos.uso++;
        else if (v.estado_actual === "En mantenimiento" || v.estado_actual === "En siniestro") statsVehiculos.mantenimiento++;
        else if (v.estado_actual === "Baja") statsVehiculos.baja++;
      });

      const statsChoferes = { activo: 0, inactivo: 0 };
      choferes.forEach((c) => {
        if (c.estado === "Activo") statsChoferes.activo++;
        else statsChoferes.inactivo++;
      });

      return { vehiculos: statsVehiculos, choferes: statsChoferes };
    } catch (error) {
      console.log(error);
      return { vehiculos: { disponible: 0, uso: 0, mantenimiento: 0, baja: 0 }, choferes: { activo: 0, inactivo: 0 } };
    }
  },

  marcarLeida: async function (id) {
    try {
      await db.Alerta.update({ leida: true }, { where: { id_alerta: id } });
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  },

  marcarTodasLeidas: async function () {
    try {
      await db.Alerta.update({ leida: true }, { where: { leida: false } });
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  },

  generarAlertasLicencias: function () {
    return serializar(async () => {
      try {
        const limite = 30;
        // Una sola licencia por chofer: la que vence más tarde (la vigente)
        const choferes = await db.Chofer.findAll({
          where: { estado: { [Op.ne]: "Inactivo" } },
          include: [{ model: db.LicenciaChofer, as: "licencias", required: true }],
        });

        const deseadas = [];
        for (const chofer of choferes) {
          const vigente = chofer.licencias.reduce((a, b) =>
            String(a.fecha_vencimiento) >= String(b.fecha_vencimiento) ? a : b,
          );
          const dias = diasHasta(vigente.fecha_vencimiento);
          if (dias === null || dias > limite) continue;

          const nombre = `${chofer.nombre} ${chofer.apellido}`;
          const vencida = dias < 0;
          deseadas.push({
            clave: String(chofer.id_chofer),
            tipo: vencida ? "licencia_vencida" : "licencia_proxima",
            prioridad: vencida ? "alta" : "media",
            mensaje: vencida
              ? `Licencia de ${nombre} vencida hace ${Math.abs(dias)} días`
              : dias === 0
                ? `Licencia de ${nombre} vence hoy`
                : `Licencia de ${nombre} vence en ${dias} días`,
            entidad_tipo: "Chofer",
            entidad_id: chofer.id_chofer,
            entidad_nombre: nombre,
          });
        }

        const existentes = await db.Alerta.findAll({
          where: { tipo: { [Op.in]: ["licencia_vencida", "licencia_proxima"] }, entidad_tipo: "Chofer" },
        });
        await sincronizarGrupo(deseadas, existentes, (a) => String(a.entidad_id));
      } catch (error) {
        console.log("Error generando alertas de licencias:", error);
      }
    });
  },

  generarAlertasVehiculos: function () {
    return serializar(async () => {
      try {
        const limite = 30;
        const vehiculos = await db.Vehiculo.findAll({ where: { estado_actual: { [Op.ne]: "Baja" } } });

        const deseadas = [];
        const documentos = [
          { campo: "rto_vencimiento", etiqueta: "RTO/VTV", sub: "RTO" },
          { campo: "seguro_vencimiento", etiqueta: "Póliza de seguro", sub: "SEGURO" },
        ];

        for (const v of vehiculos) {
          for (const doc of documentos) {
            if (!v[doc.campo]) continue;
            const dias = diasHasta(v[doc.campo]);
            if (dias === null || dias > limite) continue;
            const vencida = dias < 0;
            deseadas.push({
              clave: `${v.id_vehiculo}|${doc.sub}`,
              tipo: "documentacion_vencida",
              prioridad: vencida ? "alta" : "media",
              mensaje: vencida
                ? `${doc.etiqueta} vencida hace ${Math.abs(dias)} días`
                : dias === 0
                  ? `${doc.etiqueta} vence hoy`
                  : `${doc.etiqueta} vence en ${dias} días`,
              entidad_tipo: "Vehiculo",
              entidad_id: v.id_vehiculo,
              entidad_nombre: `${v.marca} ${v.modelo} (${v.patente})`,
            });
          }
        }

        const existentes = await db.Alerta.findAll({
          where: { tipo: "documentacion_vencida", entidad_tipo: "Vehiculo" },
        });
        const claveDe = (a) => {
          const mensaje = String(a.mensaje).toLowerCase();
          if (mensaje.includes("rto")) return `${a.entidad_id}|RTO`;
          if (mensaje.includes("seguro") || mensaje.includes("póliza")) return `${a.entidad_id}|SEGURO`;
          return null;
        };
        await sincronizarGrupo(deseadas, existentes, claveDe);

        await alertaService._sincronizarSiniestros();
      } catch (error) {
        console.log("Error generando alertas de vehículos:", error);
      }
    });
  },

  // Alerta "siniestro_activo": una por siniestro en proceso; al resolverse se marca como leída
  _sincronizarSiniestros: async function () {
    if (!db.Siniestro) return;
    const abiertos = await db.Siniestro.findAll({
      where: { estado: "EN PROCESO" },
      include: [{ model: db.Vehiculo, as: "Vehiculo" }],
    });
    const idsAbiertos = new Set(abiertos.map((s) => s.id_siniestro));

    const existentes = await db.Alerta.findAll({ where: { tipo: "siniestro_activo", entidad_tipo: "Siniestro" } });
    const conAlerta = new Set(existentes.map((a) => a.entidad_id));

    for (const s of abiertos) {
      if (conAlerta.has(s.id_siniestro)) continue;
      const patente = s.Vehiculo ? `(${s.Vehiculo.patente})` : "";
      await db.Alerta.create({
        tipo: "siniestro_activo",
        prioridad: "alta",
        mensaje: recortar(`Siniestro en proceso no resuelto: ${s.ubicacion}`, 255),
        entidad_tipo: "Siniestro",
        entidad_id: s.id_siniestro,
        entidad_nombre: recortar(`Siniestro ${patente}${s.chofer_involucrado ? " - " + s.chofer_involucrado : ""}`.trim(), 100),
        generada_automaticamente: true,
      });
    }

    for (const a of existentes) {
      if (!idsAbiertos.has(a.entidad_id) && !a.leida) await a.update({ leida: true });
    }
  },

  generarAlertasMantenimiento: function () {
    return serializar(async () => {
      try {
        const UMBRAL_MEDIA = 5000; // "falta poco"
        const UMBRAL_ALTA = 2000; // "falta muy poco"

        const vehiculos = await db.Vehiculo.findAll({
          where: { estado_actual: { [Op.ne]: "Baja" } },
          include: [{ association: "TipoVehiculo", attributes: ["unidad"] }],
        });
        const deseadas = [];

        for (const v of vehiculos) {
          const u = v.TipoVehiculo && v.TipoVehiculo.unidad ? v.TipoVehiculo.unidad : "km";
          // Los services programados que ya quedaron superados por uno posterior se cancelan solos
          await maintenanceService.cancelarProgramadosObsoletos(v.id_vehiculo);

          // Objetivos de km: los services PROGRAMADOS y el "próximo service" del último service realizado
          const objetivos = [];

          const programados = await db.Mantenimiento.findAll({
            where: { id_vehiculo: v.id_vehiculo, estado: "Programado", proximo_km: { [Op.ne]: null } },
          });
          programados.forEach((m) => objetivos.push({ km: m.proximo_km, origen: "programado" }));

          const ultimoRealizado = await db.Mantenimiento.findOne({
            where: { id_vehiculo: v.id_vehiculo, estado: "Realizado" },
            order: [
              ["fecha_inicio", "DESC"],
              ["id_mantenimiento", "DESC"],
            ],
          });
          if (ultimoRealizado && ultimoRealizado.proximo_km) {
            objetivos.push({ km: ultimoRealizado.proximo_km, origen: "recomendado" });
          }
          if (!objetivos.length) continue;

          // Se avisa por el service más cercano (o ya vencido)
          const objetivo = objetivos.reduce((a, b) => (a.km <= b.km ? a : b));
          const kmRestantes = objetivo.km - v.km_actual;
          const palabra = objetivo.origen === "programado" ? "programado" : "recomendado";
          let tipo, prioridad, mensaje;

          if (kmRestantes <= 0) {
            tipo = "mantenimiento_vencido";
            prioridad = "alta";
            mensaje = `Service ${palabra} superado hace ${Math.abs(kmRestantes)} ${u} (${palabra} a los ${objetivo.km} ${u})`;
          } else if (kmRestantes <= UMBRAL_ALTA) {
            tipo = "mantenimiento_proximo";
            prioridad = "alta";
            mensaje = `Faltan solo ${kmRestantes} ${u} para el service ${palabra} (${objetivo.km} ${u})`;
          } else if (kmRestantes <= UMBRAL_MEDIA) {
            tipo = "mantenimiento_proximo";
            prioridad = "media";
            mensaje = `Faltan ${kmRestantes} ${u} para el service ${palabra} (${objetivo.km} ${u})`;
          } else {
            continue;
          }

          deseadas.push({
            clave: String(v.id_vehiculo),
            tipo,
            prioridad,
            mensaje,
            entidad_tipo: "Vehiculo",
            entidad_id: v.id_vehiculo,
            entidad_nombre: `${v.marca} ${v.modelo} (${v.patente})`,
          });
        }

        const existentes = await db.Alerta.findAll({
          where: { tipo: { [Op.in]: ["mantenimiento_proximo", "mantenimiento_vencido"] }, entidad_tipo: "Vehiculo" },
        });
        await sincronizarGrupo(deseadas, existentes, (a) => String(a.entidad_id));
      } catch (error) {
        console.log("Error generando alertas de mantenimiento:", error);
      }
    });
  },

  generarAlertasPrestamos: function () {
    return serializar(async () => {
      try {
        const prestamos = await db.Prestamo.findAll({
          where: { estado_prestamo: "Activo", fecha_devolucion_estimada: { [Op.ne]: null } },
          include: [{ association: "herramienta" }],
        });

        const porHerramienta = new Map();
        for (const p of prestamos) {
          const dias = diasHasta(p.fecha_devolucion_estimada);
          if (dias === null || dias >= 0 || !p.herramienta) continue;
          const actual = porHerramienta.get(p.id_herramienta);
          if (!actual || dias < actual.dias) porHerramienta.set(p.id_herramienta, { p, dias });
        }

        const deseadas = [];
        for (const [idHerramienta, { p, dias }] of porHerramienta) {
          deseadas.push({
            clave: String(idHerramienta),
            tipo: "prestamo_vencido",
            prioridad: "alta",
            mensaje: `Préstamo vencido hace ${Math.abs(dias)} días: ${p.herramienta.nombre} (${p.nombre_operario})`,
            entidad_tipo: "Herramienta",
            entidad_id: idHerramienta,
            entidad_nombre: `${p.herramienta.nombre} (${p.herramienta.codigo_activo})`,
          });
        }

        const existentes = await db.Alerta.findAll({
          where: { tipo: "prestamo_vencido", entidad_tipo: "Herramienta" },
        });
        await sincronizarGrupo(deseadas, existentes, (a) => String(a.entidad_id));
      } catch (error) {
        console.log("Error generando alertas de préstamos:", error);
      }
    });
  },

  // Las asignaciones ya no tienen fecha estimada de devolución: se marcan como devueltas a mano.
  // Esta tarea solo limpia las alertas de "asignación vencida" que pudieran quedar de versiones anteriores.
  generarAlertasAsignaciones: function () {
    return serializar(async () => {
      try {
        const existentes = await db.Alerta.findAll({ where: { tipo: "asignacion_vencida", entidad_tipo: "Vehiculo" } });
        await sincronizarGrupo([], existentes, (al) => String(al.entidad_id));
      } catch (error) {
        console.log("Error limpiando alertas de asignaciones:", error);
      }
    });
  },

  // Repuestos con stock igual o menor al mínimo configurado
  generarAlertasStock: function () {
    return serializar(async () => {
      try {
        const repuestos = await db.Repuesto.findAll();
        const deseadas = [];
        for (const r of repuestos) {
          if (r.stock > r.stock_minimo) continue;
          const sinStock = r.stock <= 0;
          deseadas.push({
            clave: String(r.id_repuesto),
            tipo: "stock_bajo",
            prioridad: sinStock ? "alta" : "media",
            mensaje: sinStock
              ? `Sin stock de repuesto: ${r.nombre} (mínimo ${r.stock_minimo})`
              : `Stock bajo de repuesto: ${r.nombre} — quedan ${r.stock} (mínimo ${r.stock_minimo})`,
            entidad_tipo: "Repuesto",
            entidad_id: r.id_repuesto,
            entidad_nombre: r.nombre,
          });
        }
        const existentes = await db.Alerta.findAll({ where: { tipo: "stock_bajo", entidad_tipo: "Repuesto" } });
        await sincronizarGrupo(deseadas, existentes, (al) => String(al.entidad_id));
      } catch (error) {
        console.log("Error generando alertas de stock:", error);
      }
    });
  },

  generarTodas: async function () {
    await alertaService.generarAlertasLicencias();
    await alertaService.generarAlertasVehiculos();
    await alertaService.generarAlertasMantenimiento();
    await alertaService.generarAlertasPrestamos();
    await alertaService.generarAlertasAsignaciones();
    await alertaService.generarAlertasStock();
  },
};

module.exports = alertaService;
