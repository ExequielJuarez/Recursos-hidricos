const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");

const vehicleService = require("../data/vehicleService");
const maintenanceService = require("../data/maintenanceService");
const db = require("../model/database/models");
const alertaService = require("../data/alertaService");
const auditoriaService = require("../data/auditoriaService");
const documentoService = require("../data/documentoService");
const { CATEGORIAS } = require("../utils/documentos");
const { ErrorNegocio } = require("../utils/errores");
const { escapeHtml } = require("../utils/html");
const { hoyISO } = require("../utils/fechas");

const DIR_VEHICULOS = path.join(__dirname, "../../public/img/vehiculos");

const descartarArchivos = (req) => documentoService.descartar(req.files);

const borrarImagenAnterior = (nombre) => {
  if (nombre && /^vehiculo-\d+\./.test(nombre)) fs.unlink(path.join(DIR_VEHICULOS, nombre), () => {});
};

const paginaErrores = (errores) =>
  `<h3>Errores:</h3><ul>${errores.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul><a href="javascript:history.back()">Volver</a>`;

const vehicleController = {
  ListVehicles: async (req, res) => {
    try {
      const vehiculos = await vehicleService.getAll();
      res.render("listadoVehiculos", {
        vehiculos,
        vehiculoSeleccionado: null,
        ultimosMantenimientos: [],
        ultimasAsignaciones: [],
        asignacionActiva: null,
        siniestrosVehiculo: [],
      });
    } catch (error) {
      console.log(error);
      res.status(500).send("Error al cargar lista de vehículos");
    }
  },

  // ================= GESTIÓN DE REPUESTOS =================
  GestionarRepuestos: async (req, res) => {
    try {
      const repuestos = await db.Repuesto.findAll({ order: [["nombre", "ASC"]] });
      res.render("GestionRepuestos", { repuestos });
    } catch (error) {
      console.log("Error cargando repuestos:", error);
      res.render("GestionRepuestos", { repuestos: [] });
    }
  },

  createRepuesto: async (req, res) => {
    try {
      const nombre = String(req.body.nombre || "").trim();
      const stockMinimo = Number(req.body.stock_minimo === "" || req.body.stock_minimo === undefined ? 3 : req.body.stock_minimo);
      const stock = Number(req.body.stock === "" || req.body.stock === undefined ? 0 : req.body.stock);
      const costo = Number(req.body.costo_unitario === "" || req.body.costo_unitario === undefined ? 0 : req.body.costo_unitario);

      if (!nombre || nombre.length > 150) throw new ErrorNegocio("Ingresá el nombre del repuesto (hasta 150 caracteres).");
      if (!Number.isInteger(stock) || stock < 0) throw new ErrorNegocio("El stock debe ser un entero mayor o igual a 0.");
      if (!Number.isFinite(costo) || costo < 0) throw new ErrorNegocio("El costo unitario no puede ser negativo.");
      if (!Number.isInteger(stockMinimo) || stockMinimo < 0) throw new ErrorNegocio("El stock mínimo debe ser un entero mayor o igual a 0.");
      if (await db.Repuesto.findOne({ where: { nombre } })) throw new ErrorNegocio(`Ya existe un repuesto llamado "${nombre}".`);

      const repuesto = await db.Repuesto.create({ nombre, stock, stock_minimo: stockMinimo, costo_unitario: costo });
      await auditoriaService.desdeRequest(req, "repuesto", repuesto.id_repuesto, "CREAR", null, { nombre, stock, stock_minimo: stockMinimo, costo_unitario: costo }, `Alta de repuesto: ${nombre}`);
      await alertaService.generarAlertasStock();
      req.flash("ok", "Repuesto agregado.");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log("Error guardando repuesto:", error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo guardar el repuesto.");
    }
    res.redirect("/Repuestos/Gestionar");
  },

  // Repone stock (suma unidades) y/o cambia el stock mínimo de aviso
  ajustarRepuesto: async (req, res) => {
    try {
      const repuesto = await db.Repuesto.findByPk(req.params.id);
      if (!repuesto) throw new ErrorNegocio("El repuesto no existe.");

      const sumar = req.body.cantidad === undefined || req.body.cantidad === "" ? 0 : Number(req.body.cantidad);
      const minimo = req.body.stock_minimo === undefined || req.body.stock_minimo === "" ? repuesto.stock_minimo : Number(req.body.stock_minimo);
      if (!Number.isInteger(sumar) || sumar < 0) throw new ErrorNegocio("La cantidad a reponer debe ser un entero mayor o igual a 0.");
      if (!Number.isInteger(minimo) || minimo < 0) throw new ErrorNegocio("El stock mínimo debe ser un entero mayor o igual a 0.");
      if (sumar === 0 && minimo === repuesto.stock_minimo) throw new ErrorNegocio("No hay cambios para guardar.");

      const anterior = { stock: repuesto.stock, stock_minimo: repuesto.stock_minimo };
      await repuesto.update({ stock: repuesto.stock + sumar, stock_minimo: minimo });
      await auditoriaService.desdeRequest(
        req,
        "repuesto",
        repuesto.id_repuesto,
        "EDITAR",
        anterior,
        { stock: repuesto.stock, stock_minimo: repuesto.stock_minimo },
        `Ajuste de repuesto ${repuesto.nombre}: ${sumar ? `se repusieron ${sumar} unidades` : "cambio de stock mínimo"}`,
      );
      await alertaService.generarAlertasStock();
      req.flash("ok", sumar ? `Se repusieron ${sumar} unidades de "${repuesto.nombre}" (stock: ${repuesto.stock}).` : "Stock mínimo actualizado.");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log("Error ajustando repuesto:", error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo ajustar el repuesto.");
    }
    res.redirect("/Repuestos/Gestionar");
  },

  deleteRepuesto: async (req, res) => {
    try {
      const repuesto = await db.Repuesto.findByPk(req.params.id);
      if (!repuesto) throw new ErrorNegocio("El repuesto no existe.");
      const usos = await db.DetalleMantenimiento.count({ where: { id_repuesto: repuesto.id_repuesto } });
      if (usos > 0) {
        throw new ErrorNegocio(`No se puede eliminar "${repuesto.nombre}": figura en ${usos} mantenimiento(s) registrado(s).`);
      }
      await repuesto.destroy();
      await db.Alerta.destroy({ where: { tipo: "stock_bajo", entidad_tipo: "Repuesto", entidad_id: repuesto.id_repuesto } });
      await auditoriaService.desdeRequest(req, "repuesto", repuesto.id_repuesto, "ELIMINAR", { nombre: repuesto.nombre, stock: repuesto.stock }, null, `Baja de repuesto: ${repuesto.nombre}`);
      req.flash("ok", "Repuesto eliminado.");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log("Error eliminando repuesto:", error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo eliminar el repuesto.");
    }
    res.redirect("/Repuestos/Gestionar");
  },

  // ================= MANTENIMIENTOS =================
  CargaVMantenimiento: async (req, res) => {
    try {
      const vehiculos = await db.Vehiculo.findAll({
        where: { estado_actual: ["Disponible", "En uso", "En mantenimiento"] },
        include: [{ association: "TipoVehiculo", attributes: ["unidad"] }],
        order: [["patente", "ASC"]],
      });
      const repuestos = await db.Repuesto.findAll({ order: [["nombre", "ASC"]] });

      res.render("cargaMantenimiento", {
        vehiculos,
        repuestos,
        id_vehiculo_preseleccionado: req.params.id_vehiculo || null,
      });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar el formulario de mantenimiento.");
      res.redirect("/Mantenimientos");
    }
  },

  Mantenimientos: async (req, res) => {
    try {
      const mantenimientos = await vehicleService.getAllMantenimientos();
      res.render("Mantenimientos", { mantenimientos });
    } catch (error) {
      console.error(error);
      res.render("Mantenimientos", { mantenimientos: [] });
    }
  },

  updateEstadoMantenimiento: async (req, res) => {
    try {
      const { mantenimiento, anterior } = await maintenanceService.cambiarEstado(req.params.id, req.body.estado, req.body.km_servicio);

      await auditoriaService.desdeRequest(
        req,
        "mantenimiento",
        mantenimiento.id_mantenimiento,
        "EDITAR",
        { estado: anterior },
        { estado: req.body.estado },
        `Cambio de estado de mantenimiento ID: ${mantenimiento.id_mantenimiento} (${anterior} → ${req.body.estado})`,
      );

      await alertaService.generarAlertasMantenimiento();
      req.flash("ok", `Orden actualizada: ${req.body.estado}.`);
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.error(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo actualizar la orden.");
    }
    res.redirect("/Mantenimientos");
  },

  processMaintenance: async (req, res) => {
    try {
      const { mantenimiento, lineas } = await maintenanceService.crear(req.body, req.session.usuarioLogueado.id);

      await auditoriaService.desdeRequest(
        req,
        "mantenimiento",
        mantenimiento.id_mantenimiento,
        "CREAR",
        null,
        { ...mantenimiento.toJSON(), repuestos: lineas },
        `Alta de mantenimiento (${mantenimiento.tipo_servicio}) para vehículo ID: ${mantenimiento.id_vehiculo}`,
      );

      await alertaService.generarAlertasMantenimiento();
      await alertaService.generarAlertasStock();
      req.flash("ok", "Orden de mantenimiento guardada.");
      res.redirect("/Mantenimientos");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.error("Error al guardar mantenimiento:", error);
      const mensaje = error instanceof ErrorNegocio ? error.message : "Ocurrió un error al guardar la orden de mantenimiento.";
      res.status(400).send(`
      <div style="font-family:sans-serif; padding:40px; text-align:center;">
        <h2 style="color:#dc2626;">Error al guardar la orden de mantenimiento</h2>
        <p style="background:#fef2f2; padding:15px; border:1px solid #fecaca; border-radius:8px; display:inline-block;">${escapeHtml(mensaje)}</p>
        <br><br>
        <button onclick="history.back()" style="padding:10px 20px; cursor:pointer;">Volver e intentar nuevamente</button>
      </div>
    `);
    }
  },

  // ================= FICHA DE VEHÍCULOS =================
  getVehicleById: async (req, res) => {
    try {
      const id = req.params.id;
      const vehiculo = await vehicleService.getOne(id);
      if (!vehiculo) {
        req.flash("error", "El vehículo no existe.");
        return res.redirect("/Vehicles");
      }
      const vehiculos = await vehicleService.getAll();
      const ultimosMantenimientos = await vehicleService.getLastMantenimientos(id);
      const totalMantenimientos = await db.Mantenimiento.count({ where: { id_vehiculo: id } });
      const ultimasAsignaciones = await vehicleService.getLastAsignaciones(id);
      const asignacionActiva = await vehicleService.getAsignacionActiva(id);

      const siniestrosVehiculo = await db.Siniestro.findAll({
        where: { id_vehiculo: id },
        order: [["fecha_siniestro", "DESC"]],
      });

      // Alertas propias del vehículo: documentación, service, asignación vencida y sus siniestros abiertos
      const idsSiniestros = siniestrosVehiculo.map((s) => s.id_siniestro);
      const condiciones = [{ entidad_tipo: "Vehiculo", entidad_id: vehiculo.id_vehiculo }];
      if (idsSiniestros.length) condiciones.push({ entidad_tipo: "Siniestro", entidad_id: idsSiniestros, leida: false });
      const orden = { alta: 0, media: 1, baja: 2 };
      const alertasVehiculo = (await db.Alerta.findAll({ where: { [Op.or]: condiciones } })).sort(
        (a, b) => (orden[a.prioridad] ?? 3) - (orden[b.prioridad] ?? 3) || b.id_alerta - a.id_alerta,
      );

      const gruposDocumentos = documentoService.agrupar("vehiculo", await documentoService.listar("vehiculo", vehiculo.id_vehiculo));

      res.render("listadoVehiculos", {
        vehiculos,
        vehiculoSeleccionado: vehiculo,
        gruposDocumentos,
        alertasVehiculo,
        ultimosMantenimientos,
        totalMantenimientos,
        ultimasAsignaciones,
        asignacionActiva: asignacionActiva || null,
        siniestrosVehiculo,
      });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al obtener el vehículo.");
      res.redirect("/Vehicles");
    }
  },

  // Todos los mantenimientos de un vehículo, en lista desplegable
  MantenimientosDeVehiculo: async (req, res) => {
    try {
      const vehiculo = await vehicleService.getOne(req.params.id);
      if (!vehiculo) {
        req.flash("error", "El vehículo no existe.");
        return res.redirect("/Vehicles");
      }
      const mantenimientos = await vehicleService.getMantenimientosCompletos(vehiculo.id_vehiculo);
      res.render("MantenimientosVehiculo", { vehiculo, mantenimientos });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar los mantenimientos del vehículo.");
      res.redirect("/Vehicles");
    }
  },

  // Todos los siniestros de un vehículo, en lista desplegable
  SiniestrosDeVehiculo: async (req, res) => {
    try {
      const vehiculo = await vehicleService.getOne(req.params.id);
      if (!vehiculo) {
        req.flash("error", "El vehículo no existe.");
        return res.redirect("/Vehicles");
      }
      const siniestros = await db.Siniestro.findAll({
        where: { id_vehiculo: vehiculo.id_vehiculo },
        include: [{ model: db.Chofer, as: "Chofer" }],
        order: [
          ["fecha_siniestro", "DESC"],
          ["id_siniestro", "DESC"],
        ],
      });
      res.render("SiniestrosVehiculo", { vehiculo, siniestros });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar los siniestros del vehículo.");
      res.redirect("/Vehicles");
    }
  },

  Ajustes: async (req, res) => {
    try {
      const distritos = await db.Distrito.findAll({ order: [["nombre", "ASC"]] });
      const tiposVehiculo = await db.TipoVehiculo.findAll({ order: [["descripcion", "ASC"]] });
      res.render("AjustesVehiculos", { distritos, tiposVehiculo });
    } catch (error) {
      console.log(error);
      res.render("AjustesVehiculos", { distritos: [], tiposVehiculo: [] });
    }
  },

  createDistrito: async (req, res) => {
    try {
      const nombre = String(req.body.nombre || "").trim();
      if (!nombre || nombre.length > 100) throw new ErrorNegocio("Ingresá el nombre del distrito (hasta 100 caracteres).");
      if (await db.Distrito.findOne({ where: { nombre } })) throw new ErrorNegocio(`El distrito "${nombre}" ya existe.`);
      const distrito = await db.Distrito.create({ nombre });
      await auditoriaService.desdeRequest(req, "distrito", distrito.id_distrito, "CREAR", null, { nombre }, `Alta de distrito: ${nombre}`);
      req.flash("ok", "Distrito agregado.");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo agregar el distrito.");
    }
    res.redirect("/Vehicles/Ajustes");
  },

  // Renombra un distrito y actualiza los vehículos que lo usan (se guardan por nombre)
  renombrarDistrito: async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
      const nuevo = String(req.body.nombre || "").trim();
      if (!nuevo || nuevo.length > 100) throw new ErrorNegocio("Ingresá el nuevo nombre (hasta 100 caracteres).");
      const distrito = await db.Distrito.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!distrito) throw new ErrorNegocio("El distrito no existe.");
      if (nuevo === distrito.nombre) throw new ErrorNegocio("El nombre es el mismo que el actual.");
      const repetido = await db.Distrito.findOne({ where: { nombre: nuevo, id_distrito: { [db.Sequelize.Op.ne]: distrito.id_distrito } }, transaction });
      if (repetido) throw new ErrorNegocio(`Ya existe un distrito llamado "${nuevo}".`);

      const anterior = distrito.nombre;
      const [vehiculos] = await db.Vehiculo.update({ distrito: nuevo }, { where: { distrito: anterior }, transaction });
      await distrito.update({ nombre: nuevo }, { transaction });
      await transaction.commit();
      await auditoriaService.desdeRequest(req, "distrito", distrito.id_distrito, "EDITAR", { nombre: anterior }, { nombre: nuevo }, `Distrito renombrado: "${anterior}" → "${nuevo}" (${vehiculos} vehículo(s) actualizados)`);
      req.flash("ok", `Distrito renombrado. Se actualizaron ${vehiculos} vehículo(s).`);
    } catch (error) {
      await transaction.rollback().catch(() => {});
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo renombrar el distrito.");
    }
    res.redirect("/Vehicles/Ajustes");
  },

  deleteDistrito: async (req, res) => {
    try {
      const distrito = await db.Distrito.findByPk(req.params.id);
      if (!distrito) throw new ErrorNegocio("El distrito no existe.");
      const usos = await db.Vehiculo.count({ where: { distrito: distrito.nombre } });
      if (usos > 0) throw new ErrorNegocio(`No se puede eliminar "${distrito.nombre}": lo usan ${usos} vehículo(s).`);
      await distrito.destroy();
      await auditoriaService.desdeRequest(req, "distrito", distrito.id_distrito, "ELIMINAR", { nombre: distrito.nombre }, null, `Baja de distrito: ${distrito.nombre}`);
      req.flash("ok", "Distrito eliminado.");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo eliminar el distrito.");
    }
    res.redirect("/Vehicles/Ajustes");
  },

  createTipo: async (req, res) => {
    try {
      const descripcion = String(req.body.descripcion || "").trim();
      if (!descripcion || descripcion.length > 100) throw new ErrorNegocio("Ingresá la descripción del tipo (hasta 100 caracteres).");
      if (await db.TipoVehiculo.findOne({ where: { descripcion } })) throw new ErrorNegocio(`El tipo "${descripcion}" ya existe.`);
      const unidad = req.body.unidad === "hs" ? "hs" : "km";
      const tipo = await db.TipoVehiculo.create({ descripcion, unidad });
      await auditoriaService.desdeRequest(req, "tipo_vehiculo", tipo.id_tipo, "CREAR", null, { descripcion }, `Alta de tipo de vehículo: ${descripcion}`);
      req.flash("ok", "Tipo de vehículo agregado.");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo agregar el tipo de vehículo.");
    }
    res.redirect("/Vehicles/Ajustes");
  },

  // Cambia el nombre y/o la unidad de medida (km u horas) de un tipo de vehículo
  editarTipo: async (req, res) => {
    try {
      const tipo = await db.TipoVehiculo.findByPk(req.params.id);
      if (!tipo) throw new ErrorNegocio("El tipo de vehículo no existe.");
      const descripcion = req.body.descripcion === undefined ? tipo.descripcion : String(req.body.descripcion).trim();
      const unidad = req.body.unidad === undefined ? tipo.unidad : req.body.unidad === "hs" ? "hs" : "km";
      if (!descripcion || descripcion.length > 100) throw new ErrorNegocio("Ingresá la descripción del tipo (hasta 100 caracteres).");
      if (descripcion !== tipo.descripcion && (await db.TipoVehiculo.findOne({ where: { descripcion } }))) throw new ErrorNegocio(`El tipo "${descripcion}" ya existe.`);
      if (descripcion === tipo.descripcion && unidad === tipo.unidad) throw new ErrorNegocio("No hay cambios para guardar.");

      const anterior = { descripcion: tipo.descripcion, unidad: tipo.unidad };
      await tipo.update({ descripcion, unidad });
      await auditoriaService.desdeRequest(req, "tipo_vehiculo", tipo.id_tipo, "EDITAR", anterior, { descripcion, unidad }, `Tipo de vehículo editado: "${anterior.descripcion}" → "${descripcion}" (${unidad})`);
      await alertaService.generarAlertasMantenimiento();
      req.flash("ok", "Tipo de vehículo actualizado.");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo actualizar el tipo de vehículo.");
    }
    res.redirect("/Vehicles/Ajustes");
  },

  deleteTipo: async (req, res) => {
    try {
      const tipo = await db.TipoVehiculo.findByPk(req.params.id);
      if (!tipo) throw new ErrorNegocio("El tipo de vehículo no existe.");
      const usos = await db.Vehiculo.count({ where: { id_tipo: tipo.id_tipo } });
      if (usos > 0) throw new ErrorNegocio(`No se puede eliminar "${tipo.descripcion}": lo usan ${usos} vehículo(s).`);
      await tipo.destroy();
      await auditoriaService.desdeRequest(req, "tipo_vehiculo", tipo.id_tipo, "ELIMINAR", { descripcion: tipo.descripcion }, null, `Baja de tipo de vehículo: ${tipo.descripcion}`);
      req.flash("ok", "Tipo de vehículo eliminado.");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo eliminar el tipo de vehículo.");
    }
    res.redirect("/Vehicles/Ajustes");
  },

  CargaVehiculo: async (req, res) => {
    try {
      const distritos = await db.Distrito.findAll({ order: [["nombre", "ASC"]] });
      const tiposVehiculo = await db.TipoVehiculo.findAll({ order: [["descripcion", "ASC"]] });
      res.render("CargaFichaVehiculo", { distritos, tiposVehiculo });
    } catch (error) {
      console.log(error);
      res.render("CargaFichaVehiculo", { distritos: [], tiposVehiculo: [] });
    }
  },

  processVehicle: async (req, res) => {
    try {
      const errores = await vehicleService.validarAlta(req.body);
      // Documentación adjunta (comodato, actas...): campos doc_<categoria>
      const documentos = Object.keys(CATEGORIAS.vehiculo)
        .map((categoria) => ({ categoria, files: (req.files && req.files[`doc_${categoria}`]) || [] }))
        .filter((d) => d.files.length > 0);
      if (req.body.tiene_documentacion === "si" && documentos.length === 0) {
        errores.push('Indicaste que tenés documentación para cargar, pero no elegiste ningún archivo. Elegí los archivos o marcá "No".');
      }
      if (errores.length > 0) {
        descartarArchivos(req);
        return res.status(400).send(paginaErrores(errores));
      }

      const nuevoVehiculo = await vehicleService.create(req);

      let avisoDocumentos = "";
      if (documentos.length) {
        try {
          let total = 0;
          for (const d of documentos) {
            const creados = await documentoService.guardar({ entidad: "vehiculo", id: nuevoVehiculo.id_vehiculo, categoria: d.categoria, files: d.files, idUsuario: req.session.usuarioLogueado.id });
            total += creados.length;
          }
          avisoDocumentos = ` Se cargaron ${total} documento(s).`;
        } catch (e) {
          console.log("Error guardando documentación del vehículo:", e);
          documentoService.descartar(documentos.flatMap((d) => d.files));
          avisoDocumentos = " Atención: no se pudo guardar la documentación adjunta; cargala desde la ficha.";
        }
      }

      await auditoriaService.desdeRequest(
        req,
        "vehiculo",
        nuevoVehiculo.id_vehiculo,
        "CREAR",
        null,
        nuevoVehiculo.toJSON(),
        `Alta vehículo: ${nuevoVehiculo.marca} ${nuevoVehiculo.modelo} (${nuevoVehiculo.patente})`,
      );

      await alertaService.generarAlertasVehiculos();
      req.flash("ok", "Vehículo registrado correctamente." + avisoDocumentos);
      res.redirect("/Vehicles/" + nuevoVehiculo.id_vehiculo);
    } catch (error) {
      descartarArchivos(req);
      if (error instanceof ErrorNegocio) return res.status(400).send(paginaErrores([error.message]));
      console.log(error);
      res.status(500).send(paginaErrores(["No se pudo guardar el vehículo. Intentá nuevamente."]));
    }
  },

  EditVehiculo: async (req, res) => {
    try {
      const vehiculo = await vehicleService.getOne(req.params.id);
      if (!vehiculo) {
        req.flash("error", "El vehículo no existe.");
        return res.redirect("/Vehicles");
      }
      const distritos = await db.Distrito.findAll({ order: [["nombre", "ASC"]] });
      res.render("EditarFichaVehiculo", { vehiculo, distritos });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar el vehículo.");
      res.redirect("/Vehicles");
    }
  },

  processEditVehiculo: async (req, res) => {
    try {
      const resultado = await vehicleService.update(req.params.id, req.body, req.files || {});

      await auditoriaService.desdeRequest(
        req,
        "vehiculo",
        req.params.id,
        "EDITAR",
        resultado.valorAnterior,
        resultado.valorNuevo,
        `Edición de vehículo ID: ${req.params.id}`,
      );

      // Se borran las fotos reemplazadas
      if (req.files?.foto_cedula) borrarImagenAnterior(resultado.fotosAnteriores.foto_cedula);
      if (req.files?.foto_titulo) borrarImagenAnterior(resultado.fotosAnteriores.foto_titulo);
      if (req.files?.foto_rto) borrarImagenAnterior(resultado.fotosAnteriores.foto_rto);

      await alertaService.generarAlertasVehiculos();
      await alertaService.generarAlertasMantenimiento();
      req.flash("ok", "Vehículo actualizado correctamente.");
      res.redirect(`/Vehicles/${req.params.id}`);
    } catch (error) {
      descartarArchivos(req);
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo actualizar el vehículo.");
      res.redirect(`/Vehicles/Editar/${req.params.id}`);
    }
  },

  CargaActualizarKm: async (req, res) => {
    try {
      const asignaciones = await db.Vehiculo.findAll({
        where: { estado_actual: "En uso" },
        attributes: ["id_vehiculo", "patente", "marca", "modelo", "km_actual"],
        include: [{ association: "TipoVehiculo", attributes: ["unidad"] }],
        order: [["patente", "ASC"]],
      });
      const historial = await vehicleService.getHistorialKm();
      const vehiculosConHistorial = await vehicleService.getVehiculosConHistorial();
      const todosVehiculos = await db.Vehiculo.findAll({
        attributes: ["id_vehiculo", "patente", "marca", "modelo", "km_actual"],
        include: [{ association: "TipoVehiculo", attributes: ["unidad"] }],
        order: [["patente", "ASC"]],
      });
      res.render("ActualizarKm", { asignaciones, historial, vehiculosConHistorial, todosVehiculos });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar la vista de kilometraje.");
      res.redirect("/Vehicles");
    }
  },

  processActualizarKm: async (req, res) => {
    try {
      const { id_vehiculo, km_nuevo, fecha_actualizacion, observaciones } = req.body;
      const errores = [];

      if (!id_vehiculo) errores.push("Seleccioná un vehículo.");
      if (km_nuevo === "" || km_nuevo === undefined || !/^\d+$/.test(String(km_nuevo))) errores.push("Ingresá un kilometraje entero válido (mayor o igual a 0).");
      if (!fecha_actualizacion) errores.push("La fecha de actualización es obligatoria.");

      if (errores.length > 0) return res.status(400).send(paginaErrores(errores));

      const { vehiculo, km_anterior } = await vehicleService.actualizarKm(Number(id_vehiculo), Number(km_nuevo), fecha_actualizacion, observaciones);

      await auditoriaService.desdeRequest(
        req,
        "vehiculo",
        id_vehiculo,
        "EDITAR",
        { km_actual: km_anterior },
        { km_actual: Number(km_nuevo) },
        `Actualización de kilometraje de ${vehiculo.patente}: ${km_anterior} → ${km_nuevo} km`,
      );

      await alertaService.generarAlertasMantenimiento();
      req.flash("ok", "Kilometraje actualizado.");
      res.redirect("/Vehicles");
    } catch (error) {
      if (error instanceof ErrorNegocio) return res.status(400).send(paginaErrores([error.message]));
      console.log(error);
      res.status(500).send(paginaErrores(["No se pudo actualizar el kilometraje."]));
    }
  },
};

module.exports = vehicleController;
