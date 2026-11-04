const fs = require("fs");
const path = require("path");
const db = require("../model/database/models");
const choferService = require("../data/choferService");
const assignmentService = require("../data/assignmentService");
const auditoriaService = require("../data/auditoriaService");
const documentoService = require("../data/documentoService");
const alertaService = require("../data/alertaService");
const { validationResult } = require("express-validator");
const { aISO } = require("../utils/fechas");

const DIR_UPLOADS = path.join(__dirname, "../../public/img/licencias");

// Borra archivos recién subidos (cuando la validación falla o hay un error)
const descartarArchivos = (req) => documentoService.descartar(req.files);

// Documentación obligatoria: DNI con al menos 2 archivos al dar de alta (frente y dorso) y, si el chofer
// tiene carnet oficial de la provincia, frente y dorso del carnet (entre los ya cargados y los nuevos).
const erroresDocumentos = (req, { alta, carnetCargados = 0 }) => {
  const errores = {};
  const dni = (req.files && req.files.dni_archivos) || [];
  if (alta && dni.length < 2) {
    errores.dni_archivos = { msg: "Cargá el DNI completo: frente y dorso (mínimo 2 archivos, fotos o PDF)." };
  }
  if (req.body.tiene_carnet_oficial === "si") {
    const frente = (req.files && req.files.carnet_frente) || [];
    const dorso = (req.files && req.files.carnet_dorso) || [];
    if (carnetCargados + frente.length + dorso.length < 2) {
      if (!frente.length) errores.carnet_frente = { msg: "Si tiene carnet oficial, cargá la foto o PDF del frente." };
      if (!dorso.length) errores.carnet_dorso = { msg: "Si tiene carnet oficial, cargá la foto o PDF del dorso." };
    }
  }
  return errores;
};

// Datos para mostrar la documentación adjunta del chofer (incluye la foto de DNI de versiones anteriores)
const datosDocumentos = async (chofer) => {
  const docs = await documentoService.listar("chofer", chofer.id_chofer);
  return {
    gruposDocumentos: documentoService.agrupar("chofer", docs),
    documentosLegado: chofer.foto_documento ? [{ clave: "dni", url: `/img/licencias/${chofer.foto_documento}`, nombre: chofer.foto_documento }] : [],
    carnetCargados: docs.filter((d) => d.categoria === "carnet_provincia").length,
  };
};

// Borra una imagen anterior que fue reemplazada (nunca las de ejemplo sin timestamp)
const borrarImagenAnterior = (nombre) => {
  if (nombre && /^chofer-\d+\./.test(nombre)) fs.unlink(path.join(DIR_UPLOADS, nombre), () => {});
};

const licenciaPrincipal = (chofer) => (chofer.licencias && chofer.licencias[0]) || {};

const esBaja = (estado) => estado && estado !== "Activo";

const choferController = {
  ListChoferes: async (req, res) => {
    try {
      const filtros = req.query;

      const { choferes, totalRegistros, totalPaginas, paginaActual, limite } = await choferService.getAll(filtros);

      const queryFiltros = { ...req.query };
      delete queryFiltros.pagina;
      const queryString = new URLSearchParams(queryFiltros).toString();

      res.render("listadoChofer", {
        choferes,
        totalRegistros,
        totalPaginas,
        paginaActual,
        limite,
        queryString,
      });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar el listado de choferes.");
      res.redirect("/Vehicles");
    }
  },

  // Enlace desde las alertas: /Choferes/:id -> listado filtrado por el DNI del chofer
  verChofer: async (req, res) => {
    try {
      const chofer = await db.Chofer.findByPk(req.params.id);
      if (!chofer) {
        req.flash("error", "El chofer no existe.");
        return res.redirect("/Choferes");
      }
      res.redirect("/Choferes?buscar=" + encodeURIComponent(chofer.dni));
    } catch (error) {
      console.log(error);
      res.redirect("/Choferes");
    }
  },

  createChofer: (req, res) => {
    res.render("cargaChofer", {
      errors: {},
      old: {},
      chofer: {},
    });
  },

  processChofer: async (req, res) => {
    try {
      const errors = validationResult(req);
      const mapeados = { ...errors.mapped(), ...erroresDocumentos(req, { alta: true }) };

      if (Object.keys(mapeados).length > 0) {
        descartarArchivos(req);
        return res.status(400).render("cargaChofer", {
          errors: mapeados,
          old: req.body,
          chofer: {},
        });
      }

      const newChofer = await choferService.create(req);

      await auditoriaService.desdeRequest(
        req,
        "chofer",
        newChofer.id_chofer,
        "CREAR",
        null,
        { nombre: req.body.nombre, apellido: req.body.apellido, dni: req.body.dni },
        `Alta de chofer: ${req.body.nombre} ${req.body.apellido}`,
      );

      await alertaService.generarAlertasLicencias();
      req.flash("ok", "Chofer registrado correctamente.");
      return res.redirect("/Choferes");
    } catch (error) {
      console.log(error);
      descartarArchivos(req);
      req.flash("error", "No se pudo guardar el chofer. Verificá los datos e intentá nuevamente.");
      return res.redirect("/Choferes/Carga");
    }
  },

  editChofer: async (req, res) => {
    try {
      const chofer = await choferService.getOneConLicencia(req.params.id);

      if (!chofer) {
        req.flash("error", "El chofer no existe.");
        return res.redirect("/Choferes");
      }

      const licencia = licenciaPrincipal(chofer);

      res.render("EditarChofer", {
        errors: {},
        old: {
          nombre: chofer.nombre,
          apellido: chofer.apellido,
          dni: chofer.dni,
          fechaNacimiento: aISO(chofer.fechaNacimiento),
          telefono: chofer.telefono,
          email: chofer.email,
          direccion: chofer.direccion,
          fechaIngreso: aISO(chofer.fechaIngreso),
          "activo-inactivo": chofer.estado,
          Turno: chofer.turno,
          motivoBaja: chofer.motivoBaja || "",
          numero_licencia: licencia.numero || "",
          categoria: licencia.categoria || "",
          fecha_emision: aISO(licencia.fecha_emision),
          fecha_vencimiento: aISO(licencia.fecha_vencimiento),
          tiene_carnet_oficial: chofer.tiene_carnet_oficial ? "si" : "no",
        },
        chofer,
        ...(await datosDocumentos(chofer)),
      });
    } catch (error) {
      console.log(error);
      req.flash("error", "Error al cargar el chofer.");
      res.redirect("/Choferes");
    }
  },

  processEdit: async (req, res) => {
    try {
      const errors = validationResult(req);
      const chofer = await choferService.getOneConLicencia(req.params.id);

      if (!chofer) {
        descartarArchivos(req);
        req.flash("error", "El chofer no existe.");
        return res.redirect("/Choferes");
      }

      const datosDocs = await datosDocumentos(chofer);
      const tieneCarnet = req.body.tiene_carnet_oficial === "si";
      const mapeados = { ...errors.mapped(), ...erroresDocumentos(req, { alta: false, carnetCargados: datosDocs.carnetCargados }) };

      if (Object.keys(mapeados).length > 0) {
        descartarArchivos(req);
        return res.status(400).render("EditarChofer", {
          errors: mapeados,
          chofer,
          old: req.body,
          ...datosDocs,
        });
      }

      const body = req.body;
      const fotoDocumento = req.files?.foto_documento?.[0]?.filename || undefined;
      const fotoLicencia = req.files?.foto_licencia?.[0]?.filename || undefined;
      const fotoPerfil = req.files?.imagen?.[0]?.filename || undefined;
      const nuevoEstado = body["activo-inactivo"];
      const estadoAnterior = chofer.estado;

      // Si deja de estar activo, se cierran sus asignaciones para no dejar un vehículo trabado
      let asignacionesCerradas = 0;
      if (esBaja(nuevoEstado) && !esBaja(estadoAnterior)) {
        asignacionesCerradas = await assignmentService.finalizarActivasDeChofer(
          chofer.id_chofer,
          `Cierre automático: el chofer pasó a estado "${nuevoEstado}"`,
        );
      }

      await choferService.update(req.params.id, {
        nombre: body.nombre.trim(),
        apellido: body.apellido.trim(),
        dni: body.dni,
        telefono: body.telefono.trim(),
        direccion: body.direccion.trim(),
        estado: nuevoEstado,
        email: body.email || null,
        fechaNacimiento: body.fechaNacimiento || null,
        fechaIngreso: body.fechaIngreso || null,
        turno: body.Turno || null,
        tiene_carnet_oficial: tieneCarnet,
        ...(fotoDocumento && { foto_documento: fotoDocumento }),
        ...(fotoPerfil && { imagen: fotoPerfil }),
        motivoBaja: nuevoEstado === "Inactivo" ? body.motivoBaja || null : null,
      });
      if (fotoDocumento) borrarImagenAnterior(chofer.foto_documento);
      // Documentación: DNI adicional y carnet de la provincia
      await choferService.guardarDocumentos(chofer.id_chofer, req);
      if (!tieneCarnet) await documentoService.eliminarDeEntidad("chofer", chofer.id_chofer, "carnet_provincia");
      if (fotoPerfil) borrarImagenAnterior(chofer.imagen);

      const datosLicencia = {
        numero: body.numero_licencia,
        categoria: body.categoria,
        fecha_emision: body.fecha_emision,
        fecha_vencimiento: body.fecha_vencimiento,
      };
      if (fotoLicencia) datosLicencia.imagen = fotoLicencia;
      await choferService.guardarLicencia(chofer, datosLicencia);
      if (fotoLicencia) borrarImagenAnterior(licenciaPrincipal(chofer).imagen);

      // Aviso informativo cuando se da de baja
      if (nuevoEstado === "Inactivo" && estadoAnterior !== "Inactivo") {
        await db.Alerta.create({
          tipo: "informativa",
          prioridad: "media",
          mensaje: `Chofer ${chofer.nombre} ${chofer.apellido} dado de baja. Motivo: ${body.motivoBaja}`.slice(0, 255),
          entidad_tipo: "Chofer",
          entidad_id: chofer.id_chofer,
          entidad_nombre: `${chofer.nombre} ${chofer.apellido}`.slice(0, 100),
          generada_automaticamente: false,
        });
      }

      await auditoriaService.desdeRequest(
        req,
        "chofer",
        req.params.id,
        "EDITAR",
        { nombre: chofer.nombre, apellido: chofer.apellido, estado: estadoAnterior },
        { nombre: body.nombre, apellido: body.apellido, estado: nuevoEstado },
        `Edición de chofer ID: ${req.params.id} (${body.nombre} ${body.apellido})` +
          (asignacionesCerradas ? ` — se cerró ${asignacionesCerradas} asignación(es) activa(s)` : ""),
      );

      await alertaService.generarAlertasLicencias();
      req.flash("ok", "Chofer actualizado correctamente.");
      return res.redirect("/Choferes");
    } catch (error) {
      console.log(error);
      descartarArchivos(req);
      req.flash("error", "No se pudo actualizar el chofer. Intentá nuevamente.");
      return res.redirect("/Choferes");
    }
  },

  desactivarChofer: async (req, res) => {
    try {
      const chofer = await db.Chofer.findByPk(req.params.id);
      if (!chofer) {
        req.flash("error", "El chofer no existe.");
        return res.redirect("/Choferes");
      }
      if (chofer.estado === "Inactivo") return res.redirect("/Choferes");

      const cerradas = await assignmentService.finalizarActivasDeChofer(
        chofer.id_chofer,
        'Cierre automático: el chofer fue desactivado',
      );
      await choferService.update(chofer.id_chofer, {
        estado: "Inactivo",
        motivoBaja: chofer.motivoBaja || "Desactivado desde el listado",
      });

      await auditoriaService.desdeRequest(
        req,
        "chofer",
        chofer.id_chofer,
        "EDITAR",
        { estado: chofer.estado },
        { estado: "Inactivo" },
        `Desactivación de chofer ID: ${chofer.id_chofer}` + (cerradas ? ` — se cerró ${cerradas} asignación(es) activa(s)` : ""),
      );

      await alertaService.generarAlertasLicencias();
      req.flash("ok", "Chofer desactivado.");
      return res.redirect("/Choferes");
    } catch (error) {
      console.log(error);
      req.flash("error", "No se pudo desactivar el chofer.");
      return res.redirect("/Choferes");
    }
  },

  activarChofer: async (req, res) => {
    try {
      const chofer = await db.Chofer.findByPk(req.params.id);
      if (!chofer) {
        req.flash("error", "El chofer no existe.");
        return res.redirect("/Choferes");
      }

      await choferService.update(chofer.id_chofer, { estado: "Activo", motivoBaja: null });

      await auditoriaService.desdeRequest(
        req,
        "chofer",
        chofer.id_chofer,
        "EDITAR",
        { estado: chofer.estado },
        { estado: "Activo" },
        `Activación de chofer ID: ${chofer.id_chofer}`,
      );

      await alertaService.generarAlertasLicencias();
      req.flash("ok", "Chofer activado.");
      return res.redirect("/Choferes");
    } catch (error) {
      console.log(error);
      req.flash("error", "No se pudo activar el chofer.");
      return res.redirect("/Choferes");
    }
  },

  getTodosJSON: async (req, res) => {
    try {
      const buscar = String(req.query.buscar || "").trim();
      const where = {};
      if (buscar) {
        where[db.Sequelize.Op.or] = [
          { nombre: { [db.Sequelize.Op.like]: `%${buscar}%` } },
          { apellido: { [db.Sequelize.Op.like]: `%${buscar}%` } },
          { dni: { [db.Sequelize.Op.like]: `%${buscar}%` } },
        ];
      }
      const choferes = await db.Chofer.findAll({
        where,
        include: [
          { model: db.LicenciaChofer, as: "licencias" },
          { model: db.AsignacionVehiculo, as: "asignaciones", required: false, where: { estado: "Activo" }, include: [{ model: db.Vehiculo, as: "vehiculo", required: false }] },
          { model: db.DocumentoAdjunto, as: "documentos", required: false, attributes: ["id_documento", "categoria", "nombre_original", "archivo"] },
        ],
        order: [
          ["apellido", "ASC"],
          ["nombre", "ASC"],
          [{ model: db.LicenciaChofer, as: "licencias" }, "fecha_vencimiento", "DESC"],
        ],
      });
      res.json(choferes);
    } catch (error) {
      console.log(error);
      res.status(500).json([]);
    }
  },
};

module.exports = choferController;
