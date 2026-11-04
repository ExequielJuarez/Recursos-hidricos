// Documentación adjunta (PDF y fotos) de vehículos y choferes.
// Los archivos se guardan FUERA de la carpeta pública (uploads/documentos) y se sirven
// únicamente a usuarios con sesión y permiso, a través de /Documentos/:id.
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const DIR_DOCUMENTOS = process.env.UPLOADS_DIR
  ? path.join(process.env.UPLOADS_DIR, "documentos")
  : path.join(__dirname, "../../uploads/documentos");

const EXT_IMAGEN = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const EXT_DOCUMENTO = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

const CATEGORIAS = {
  vehiculo: {
    comodato: "Comodato",
    acta_afectacion: "Acta de afectación",
    acta_entrega: "Acta de entrega",
    acta_desafectacion: "Acta de desafectación temporal",
    otro: "Otra documentación",
  },
  chofer: {
    dni: "DNI (frente y dorso)",
    carnet_provincia: "Carnet de la provincia",
  },
};

// Campos de formulario → categoría. Los de vehículo son "doc_<categoria>".
const camposVehiculo = () => Object.keys(CATEGORIAS.vehiculo).map((c) => ({ name: `doc_${c}`, maxCount: 10 }));

// Fotos de documentos que se guardan junto a las imágenes de cada módulo (cédula, título, seguro, licencia): aceptan también PDF
const CAMPOS_FOTO_DOCUMENTO = ["foto_cedula", "foto_titulo", "foto_rto", "foto_licencia", "foto_documento"];

const PERMISO_POR_ENTIDAD = { vehiculo: "Vehicles", chofer: "Choferes" };

const esCampoDocumento = (campo) => /^(doc_|dni_archivos$|carnet_frente$|carnet_dorso$)/.test(campo);

const MIME = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

// Subida mixta: las fotos "de siempre" van a la carpeta pública de cada módulo (solo imágenes) y
// los documentos (imagen o PDF) a la carpeta privada.
const crearUploadMixto = ({ carpetaImagenes, prefijoImagen, campos }) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = esCampoDocumento(file.fieldname) ? DIR_DOCUMENTOS : carpetaImagenes;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const sufijo = Math.round(Math.random() * 1e6);
      const prefijo = esCampoDocumento(file.fieldname) ? "doc" : prefijoImagen;
      cb(null, `${prefijo}-${Date.now()}${sufijo}${path.extname(file.originalname).toLowerCase()}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024, files: 40 },
    fileFilter: (req, file, cb) => {
      const permitidas = esCampoDocumento(file.fieldname) || CAMPOS_FOTO_DOCUMENTO.includes(file.fieldname) ? EXT_DOCUMENTO : EXT_IMAGEN;
      const ext = path.extname(file.originalname).toLowerCase();
      if (!permitidas.includes(ext)) {
        const error = new Error("Formato de archivo no permitido. Usá " + permitidas.join(", ") + ".");
        error.codigoSubida = true;
        return cb(error);
      }
      cb(null, true);
    },
  });
  return upload.fields(campos);
};

// Subida solo de documentos (para agregar más archivos desde la ficha)
const uploadSoloDocumentos = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(DIR_DOCUMENTOS)) fs.mkdirSync(DIR_DOCUMENTOS, { recursive: true });
      cb(null, DIR_DOCUMENTOS);
    },
    filename: (req, file, cb) => cb(null, `doc-${Date.now()}${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!EXT_DOCUMENTO.includes(ext)) {
      const error = new Error("Formato de archivo no permitido. Usá " + EXT_DOCUMENTO.join(", ") + ".");
      error.codigoSubida = true;
      return cb(error);
    }
    cb(null, true);
  },
}).array("archivos", 10);

module.exports = { DIR_DOCUMENTOS, CATEGORIAS, EXT_DOCUMENTO, MIME, PERMISO_POR_ENTIDAD, camposVehiculo, crearUploadMixto, uploadSoloDocumentos };
