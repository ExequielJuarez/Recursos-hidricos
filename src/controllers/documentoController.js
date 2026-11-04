const path = require("path");
const fs = require("fs");
const db = require("../model/database/models");
const documentoService = require("../data/documentoService");
const auditoriaService = require("../data/auditoriaService");
const { DIR_DOCUMENTOS, CATEGORIAS, MIME, PERMISO_POR_ENTIDAD } = require("../utils/documentos");
const { ROL_ADMIN } = require("../utils/permisos");
const { ErrorNegocio } = require("../utils/errores");

const puede = (req, entidad) => {
  const u = req.session.usuarioLogueado;
  return u.rol === ROL_ADMIN || (u.permisos || []).includes(PERMISO_POR_ENTIDAD[entidad]);
};

const NOMBRES = { vehiculo: "vehículo", chofer: "chofer" };
const volver = (entidad, id) => (entidad === "vehiculo" ? `/Vehicles/${id}` : `/Choferes/${id}/editar`);

const documentoController = {
  // Muestra (o descarga) un archivo: solo con sesión y permiso sobre el módulo al que pertenece
  ver: async (req, res) => {
    try {
      const doc = await db.DocumentoAdjunto.findByPk(Number(req.params.id) || 0);
      if (!doc) return res.status(404).send("El documento no existe.");
      if (!puede(req, doc.entidad)) return res.status(403).send("No tenés permiso para ver este documento.");
      const ruta = path.join(DIR_DOCUMENTOS, path.basename(doc.archivo));
      if (!fs.existsSync(ruta)) return res.status(404).send("El archivo ya no está disponible en el servidor.");
      const ext = path.extname(doc.archivo).toLowerCase();
      const nombre = encodeURIComponent(doc.nombre_original || doc.archivo);
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      res.setHeader("Content-Disposition", `${req.query.descargar ? "attachment" : "inline"}; filename*=UTF-8''${nombre}`);
      res.sendFile(ruta);
    } catch (error) {
      console.log(error);
      res.status(500).send("No se pudo abrir el documento.");
    }
  },

  // Agrega archivos a un vehículo o a un chofer ya existente
  agregar: (entidad) => async (req, res) => {
    const id = Number(req.params.id);
    try {
      const modelo = entidad === "vehiculo" ? db.Vehiculo : db.Chofer;
      if (!(await modelo.findByPk(id))) throw new ErrorNegocio(`El ${NOMBRES[entidad]} no existe.`);
      const categoria = String(req.body.categoria || "");
      if (!CATEGORIAS[entidad][categoria]) throw new ErrorNegocio("Elegí el tipo de documento.");
      if (!req.files || req.files.length === 0) throw new ErrorNegocio("Elegí al menos un archivo (PDF o foto).");
      const creados = await documentoService.guardar({ entidad, id, categoria, files: req.files, idUsuario: req.session.usuarioLogueado.id });
      await auditoriaService.desdeRequest(req, entidad, id, "EDITAR", null, { documentos: creados.map((d) => d.nombre_original), categoria }, `Se cargaron ${creados.length} archivo(s) de "${CATEGORIAS[entidad][categoria]}" al ${NOMBRES[entidad]} ID ${id}`);
      req.flash("ok", `${creados.length} archivo(s) cargado(s) en "${CATEGORIAS[entidad][categoria]}".`);
    } catch (error) {
      documentoService.descartar(req.files);
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudieron guardar los archivos.");
    }
    res.redirect(volver(entidad, id));
  },

  eliminar: async (req, res) => {
    let destino = "/Vehicles";
    try {
      const doc = await db.DocumentoAdjunto.findByPk(Number(req.params.id) || 0);
      if (!doc) throw new ErrorNegocio("El documento no existe.");
      destino = volver(doc.entidad, doc.id_entidad);
      if (!puede(req, doc.entidad)) return res.status(403).send("No tenés permiso para eliminar este documento.");
      await documentoService.eliminar(doc);
      await auditoriaService.desdeRequest(req, doc.entidad, doc.id_entidad, "EDITAR", { documento: doc.nombre_original, categoria: doc.categoria }, null, `Se eliminó el documento "${doc.nombre_original}" (${CATEGORIAS[doc.entidad][doc.categoria] || doc.categoria}) del ${NOMBRES[doc.entidad]} ID ${doc.id_entidad}`);
      req.flash("ok", "Documento eliminado.");
    } catch (error) {
      if (!(error instanceof ErrorNegocio)) console.log(error);
      req.flash("error", error instanceof ErrorNegocio ? error.message : "No se pudo eliminar el documento.");
    }
    res.redirect(destino);
  },
};

module.exports = documentoController;
