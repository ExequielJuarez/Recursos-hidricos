const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { crearUploadMixto, camposVehiculo, uploadSoloDocumentos } = require("../utils/documentos");

// ───────── Subida de archivos (solo imágenes / PDF, máx. 5 MB por archivo) ─────────
const EXTENSIONES_IMAGEN = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const EXTENSIONES_ADJUNTO = [...EXTENSIONES_IMAGEN, ".pdf"];

const crearUpload = (carpeta, prefijo, extensionesPermitidas) => {
  const directorio = path.join(__dirname, "../../public/img", carpeta);
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(directorio)) fs.mkdirSync(directorio, { recursive: true });
      cb(null, directorio);
    },
    filename: function (req, file, cb) {
      const sufijo = Math.round(Math.random() * 1e6);
      cb(null, `${prefijo}-${Date.now()}${sufijo}${path.extname(file.originalname).toLowerCase()}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 6 },
    fileFilter: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!extensionesPermitidas.includes(ext)) {
        const error = new Error("Formato de archivo no permitido. Usá " + extensionesPermitidas.join(", ") + ".");
        error.codigoSubida = true;
        return cb(error);
      }
      cb(null, true);
    },
  });
};

// Cédula, título y seguro del vehículo: foto o PDF
const uploadVehiculo = crearUpload("vehiculos", "vehiculo", EXTENSIONES_ADJUNTO);

// Alta/edición con documentación adjunta (PDF o foto) además de las fotos habituales
const DIR_IMG = path.join(__dirname, "../../public/img");
const subidaVehiculoAlta = crearUploadMixto({
  carpetaImagenes: path.join(DIR_IMG, "vehiculos"),
  prefijoImagen: "vehiculo",
  campos: [{ name: "foto_cedula", maxCount: 1 }, { name: "foto_titulo", maxCount: 1 }, { name: "foto_rto", maxCount: 1 }, ...camposVehiculo()],
});
const camposChofer = [
  { name: "imagen", maxCount: 1 },
  { name: "foto_documento", maxCount: 1 },
  { name: "foto_licencia", maxCount: 1 },
  { name: "dni_archivos", maxCount: 6 },
  { name: "carnet_frente", maxCount: 1 },
  { name: "carnet_dorso", maxCount: 1 },
];
const subidaChofer = crearUploadMixto({ carpetaImagenes: path.join(DIR_IMG, "licencias"), prefijoImagen: "chofer", campos: camposChofer });
const uploadSiniestro = crearUpload("siniestros", "siniestro", EXTENSIONES_ADJUNTO);

const auditoriaController = require("../controllers/auditoriaController");
const vehicleController = require("../controllers/vehicleController");
const userController = require("../controllers/userController");
const choferController = require("../controllers/choferController");
const toolController = require("../controllers/toolController");
const assignmentController = require("../controllers/assignmentController");
const authMiddleware = require("../middlewares/authMiddleware");
const { choferVAlidation, choferEditValidation } = require("../validations/choferValidation");
const alertaController = require("../controllers/alertaController");
const reporteController = require("../controllers/reporteController");
const siniestroController = require("../controllers/siniestroController");
const documentoController = require("../controllers/documentoController");
const historialController = require("../controllers/historialController");

router.use((req, res, next) => {
  if (req.session && req.session.usuarioLogueado) {
    res.locals.usuarioLogueado = req.session.usuarioLogueado;
  } else {
    res.locals.usuarioLogueado = null;
  }
  next();
});

router.get("/InicioSesion", userController.InicioSesion);
router.post("/InicioSesion", userController.ProcesoIniciarSesion);
router.get("/CerrarSesion", userController.CerrarSesion);

router.get("/Usuarios", authMiddleware, userController.ListarUsuarios);
router.get("/Usuarios/Roles", authMiddleware, userController.ListarRoles);
router.get("/Usuarios/Carga", authMiddleware, userController.CargaUsuario);
router.post("/Usuarios/Carga", authMiddleware, userController.ProcesoCargaUsuario);
router.get("/Usuarios/Editar/:id", authMiddleware, userController.EditarUsuario);
router.post("/Usuarios/Editar/:id", authMiddleware, userController.ProcesoEditarUsuario);
router.get("/Usuarios/Roles/Editar/:id", authMiddleware, userController.EditarRol);
router.post("/Usuarios/Roles/Editar/:id", authMiddleware, userController.ProcesoEditarRol);

router.get("/Vehicles/Ajustes", authMiddleware, vehicleController.Ajustes);
router.post("/Vehicles/Ajustes/Distritos", authMiddleware, vehicleController.createDistrito);
router.post("/Vehicles/Ajustes/Distritos/Eliminar/:id", authMiddleware, vehicleController.deleteDistrito);
router.post("/Vehicles/Ajustes/Distritos/Renombrar/:id", authMiddleware, vehicleController.renombrarDistrito);
router.post("/Vehicles/Ajustes/Tipos", authMiddleware, vehicleController.createTipo);
router.post("/Vehicles/Ajustes/Tipos/Editar/:id", authMiddleware, vehicleController.editarTipo);
router.post("/Vehicles/Ajustes/Tipos/Eliminar/:id", authMiddleware, vehicleController.deleteTipo);

router.get("/Vehicles/Editar/:id", authMiddleware, vehicleController.EditVehiculo);
router.post("/Vehicles/Editar/:id", authMiddleware, uploadVehiculo.fields([{ name: "foto_cedula", maxCount: 1 },{ name: "foto_titulo", maxCount: 1 },{ name: "foto_rto",    maxCount: 1 }]), vehicleController.processEditVehiculo);
router.get("/Vehicles", authMiddleware, vehicleController.ListVehicles);
router.get("/Vehicles/:id/mantenimientos", authMiddleware, vehicleController.MantenimientosDeVehiculo);
router.get("/Vehicles/:id/siniestros", authMiddleware, vehicleController.SiniestrosDeVehiculo);
router.get("/Vehicles/Carga", authMiddleware, (req, res) => res.redirect("/CargaVehiculo"));
router.get("/Vehicles/:id", authMiddleware, vehicleController.getVehicleById);
router.post("/Vehicles/:id/documentos", authMiddleware, uploadSoloDocumentos, documentoController.agregar("vehiculo"));
router.get("/Documentos/:id", authMiddleware, documentoController.ver);
router.post("/Documentos/:id/eliminar", authMiddleware, documentoController.eliminar);
router.get("/CargaVehiculo", authMiddleware, vehicleController.CargaVehiculo);
router.post("/CargaVehiculo", authMiddleware, subidaVehiculoAlta, vehicleController.processVehicle);
router.get("/ActualizarKm", authMiddleware, vehicleController.CargaActualizarKm);
router.post("/ActualizarKm", authMiddleware, vehicleController.processActualizarKm);

// ================= RUTAS NUEVAS: REPUESTOS =================
router.get("/Repuestos/Gestionar", authMiddleware, vehicleController.GestionarRepuestos);
router.post("/Repuestos/Agregar", authMiddleware, vehicleController.createRepuesto);
router.post("/Repuestos/Ajustar/:id", authMiddleware, vehicleController.ajustarRepuesto);
router.post("/Repuestos/Eliminar/:id", authMiddleware, vehicleController.deleteRepuesto);
// =========================================================

router.get("/Mantenimientos", authMiddleware, vehicleController.Mantenimientos);
router.get("/Mantenimientos/Historial", authMiddleware, historialController.ver);
router.get("/Mantenimientos/Historial/exportar", authMiddleware, historialController.exportar);
router.post("/Mantenimientos/Historial/importar", authMiddleware, historialController.uploadExcel, historialController.importar);
router.post("/Mantenimientos/Historial/:id", authMiddleware, historialController.editar);
router.post("/Mantenimientos/:id/estado", authMiddleware, vehicleController.updateEstadoMantenimiento);
router.get("/Mantenimientos/carga/:id_vehiculo", authMiddleware, vehicleController.CargaVMantenimiento);
router.get("/Mantenimientos/carga", authMiddleware, vehicleController.CargaVMantenimiento);
router.post("/CargaMantenimiento", authMiddleware, vehicleController.processMaintenance);


router.get("/Choferes", authMiddleware, choferController.ListChoferes);
router.get("/Choferes/Carga", authMiddleware, choferController.createChofer);
router.post("/Choferes/Carga", authMiddleware, subidaChofer, choferVAlidation(), choferController.processChofer);
router.get("/Choferes/:id/editar", authMiddleware, choferController.editChofer);
router.post("/Choferes/:id/editar", authMiddleware, subidaChofer, choferEditValidation(), choferController.processEdit);
router.post("/Choferes/:id/documentos", authMiddleware, uploadSoloDocumentos, documentoController.agregar("chofer"));
router.post("/Choferes/:id/desactivar", authMiddleware, choferController.desactivarChofer);
router.post("/Choferes/:id/activar", authMiddleware, choferController.activarChofer);
router.get("/Choferes/api/todos", authMiddleware, choferController.getTodosJSON);
router.get("/Choferes/:id", authMiddleware, choferController.verChofer);

router.get("/asignaciones", authMiddleware, assignmentController.showForm);
router.post("/asignaciones", authMiddleware, assignmentController.create);
router.post("/asignaciones/:id/finalizar", authMiddleware, assignmentController.finalize);

router.get("/Tools", authMiddleware, toolController.ListTools);
router.get("/Tools/Carga", authMiddleware, toolController.CargaHerramienta);
router.post("/Tools/Carga", authMiddleware, toolController.processTool);
router.post("/Tools/ProcessCarga", authMiddleware, toolController.processTool);
router.get("/Tools/Editar/:id", authMiddleware, toolController.EditHerramienta);
router.post("/Tools/Editar/:id", authMiddleware, toolController.processEditTool);
router.post("/Tools/Eliminar/:id", authMiddleware, toolController.deleteTool);
router.get("/Tools/Prestamos", authMiddleware, toolController.ListPrestamos);
router.get("/Tools/Prestamo/:id", authMiddleware, toolController.CargaPrestamo);
router.post("/Tools/Prestamo", authMiddleware, toolController.processPrestamo);
router.post("/Tools/Devolucion", authMiddleware, toolController.processDevolucion);
router.get("/Tools/Ajustes", authMiddleware, toolController.Ajustes);
router.post("/Tools/Ajustes/Sectores", authMiddleware, toolController.createSector);
router.post("/Tools/Ajustes/Sectores/Renombrar/:id", authMiddleware, toolController.renombrarSector);
router.post("/Tools/Ajustes/Sectores/Eliminar/:id", authMiddleware, toolController.deleteSector);
router.post("/Tools/Ajustes/Operarios", authMiddleware, toolController.createOperario);
router.post("/Tools/Ajustes/Operarios/Renombrar/:id", authMiddleware, toolController.renombrarOperario);
router.post("/Tools/Ajustes/Operarios/Eliminar/:id", authMiddleware, toolController.deleteOperario);
router.get("/Tools/:id", authMiddleware, toolController.getToolById);

router.get("/", (req, res) => res.redirect("/InicioSesion"));

router.get("/Alertas", authMiddleware, alertaController.ListAlertas);
router.get("/Alertas/recientes", authMiddleware, alertaController.getRecientes);
router.post("/Alertas/leer-todas", authMiddleware, alertaController.marcarTodasLeidas);
router.post("/Alertas/:id/leer", authMiddleware, alertaController.marcarLeida);
router.get("/Alertas/:id", authMiddleware, alertaController.detalleAlerta);

router.get("/Auditoria", authMiddleware, auditoriaController.ListarAuditoria);

router.get("/Reportes", authMiddleware, reporteController.vistaReportes);

router.get("/Siniestros", authMiddleware, siniestroController.ListarSiniestros);
router.get("/Siniestros/Carga", authMiddleware, siniestroController.CargaSiniestro); // antes del :id
router.get("/Siniestros/:id", authMiddleware, siniestroController.DetalleSiniestro);
router.post("/Siniestros/Carga", authMiddleware, uploadSiniestro.array("archivos", 5), siniestroController.ProcesoCarga);
router.post("/Siniestros/:id/Estado", authMiddleware, siniestroController.CambiarEstado);
router.post("/Siniestros/:id/resolver", authMiddleware, siniestroController.CambiarEstado);
router.post("/Siniestros/Eliminar/:id", authMiddleware, siniestroController.Eliminar);

module.exports = router;