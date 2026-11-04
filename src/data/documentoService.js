const fs = require("fs");
const path = require("path");
const db = require("../model/database/models");
const { DIR_DOCUMENTOS, CATEGORIAS } = require("../utils/documentos");

const documentoService = {
  // Lista de archivos subidos por multer (cualquier carpeta) → se borran del disco
  descartar: (files) => {
    const lista = Array.isArray(files) ? files : Object.values(files || {}).flat();
    lista.forEach((f) => f && f.path && fs.unlink(f.path, () => {}));
  },

  // Guarda en la base los archivos ya subidos a disco. Si algo falla, borra los archivos.
  guardar: async function ({ entidad, id, categoria, files, idUsuario = null, transaction }) {
    if (!CATEGORIAS[entidad] || !CATEGORIAS[entidad][categoria]) throw new Error("Categoría de documento inválida");
    const creados = [];
    for (const f of files || []) {
      creados.push(
        await db.DocumentoAdjunto.create(
          { entidad, id_entidad: id, categoria, archivo: f.filename, nombre_original: String(f.originalname || f.filename).slice(0, 255), id_usuario: idUsuario },
          { transaction },
        ),
      );
    }
    return creados;
  },

  listar: (entidad, id) => db.DocumentoAdjunto.findAll({ where: { entidad, id_entidad: id }, order: [["categoria", "ASC"], ["id_documento", "ASC"]] }),

  // Agrupa por categoría respetando el orden definido (incluye las categorías vacías)
  agrupar: (entidad, documentos) =>
    Object.entries(CATEGORIAS[entidad]).map(([clave, etiqueta]) => ({
      clave,
      etiqueta,
      archivos: documentos.filter((d) => d.categoria === clave),
    })),

  contar: (entidad, id, categoria) => db.DocumentoAdjunto.count({ where: { entidad, id_entidad: id, ...(categoria && { categoria }) } }),

  eliminar: async function (doc) {
    await doc.destroy();
    fs.unlink(path.join(DIR_DOCUMENTOS, doc.archivo), () => {});
  },

  eliminarDeEntidad: async function (entidad, id, categoria) {
    const docs = await db.DocumentoAdjunto.findAll({ where: { entidad, id_entidad: id, ...(categoria && { categoria }) } });
    for (const d of docs) await documentoService.eliminar(d);
    return docs.length;
  },
};

module.exports = documentoService;
