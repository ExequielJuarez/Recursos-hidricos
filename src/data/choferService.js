const db = require("../model/database/models");
const { Op } = require("sequelize");
const documentoService = require("./documentoService");

const choferService = {
  getAll: async function (filtros = {}) {
    try {
      const where = {};

      if (filtros.buscar) {
        where[Op.or] = [
          { nombre: { [Op.like]: `%${filtros.buscar}%` } },
          { apellido: { [Op.like]: `%${filtros.buscar}%` } },
          { dni: { [Op.like]: `%${filtros.buscar}%` } },
        ];
      }

      if (filtros.estado) {
        where.estado = filtros.estado;
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

      const includeLicencias = {
        model: db.LicenciaChofer,
        as: "licencias",
        required: !!filtros.categoriaLicencia,
      };

      if (filtros.categoriaLicencia) {
        includeLicencias.where = { categoria: filtros.categoriaLicencia };
      }

      // Sólo la asignación activa (la que el listado muestra como "vehículo asignado")
      const includeAsignaciones = {
        model: db.AsignacionVehiculo,
        as: "asignaciones",
        required: false,
        where: { estado: "Activo" },
        include: [
          {
            model: db.Vehiculo,
            as: "vehiculo",
            required: false,
          },
        ],
      };

      const limite = parseInt(filtros.limite) || 8;
      const pagina = parseInt(filtros.pagina) || 1;
      const offset = (pagina - 1) * limite;

      const { count, rows } = await db.Chofer.findAndCountAll({
        where,
        include: [includeLicencias, includeAsignaciones, { model: db.DocumentoAdjunto, as: "documentos", required: false, attributes: ["id_documento", "categoria", "nombre_original", "archivo"] }],
        order: [
          ["apellido", "ASC"],
          ["nombre", "ASC"],
          [{ model: db.LicenciaChofer, as: "licencias" }, "fecha_vencimiento", "DESC"],
        ],
        limit: limite,
        offset: offset,
        distinct: true,
      });

      return {
        choferes: rows,
        totalRegistros: count,
        totalPaginas: Math.ceil(count / limite),
        paginaActual: pagina,
        limite,
      };
    } catch (error) {
      console.log(error);
      return {
        choferes: [],
        totalRegistros: 0,
        totalPaginas: 0,
        paginaActual: 1,
        limite: 8,
      };
    }
  },

  getOneConLicencia: async function (id) {
    try {
      const chofer = await db.Chofer.findByPk(id, {
        include: [
          {
            model: db.LicenciaChofer,
            as: "licencias",
          },
        ],
        order: [[{ model: db.LicenciaChofer, as: "licencias" }, "fecha_vencimiento", "DESC"]],
      });
      return chofer;
    } catch (error) {
      console.log(error);
      return null;
    }
  },

  create: async function (req) {
    const transaction = await db.sequelize.transaction();
    try {
      const body = req.body;
      const estado = body["activo-inactivo"];

      const fotoDocumento = req.files?.foto_documento?.[0]?.filename || null;
      const fotoLicencia = req.files?.foto_licencia?.[0]?.filename || null;
      const imagen = req.files?.imagen?.[0]?.filename || null;

      const newChofer = await db.Chofer.create(
        {
          nombre: body.nombre.trim(),
          apellido: body.apellido.trim(),
          dni: body.dni.trim(),
          telefono: body.telefono.trim(),
          direccion: body.direccion.trim(),
          estado: estado,
          email: body.email || null,
          fechaNacimiento: body.fechaNacimiento || null,
          fechaIngreso: body.fechaIngreso || null,
          turno: body.Turno || null,
          motivoBaja: estado === "Inactivo" ? body.motivoBaja || null : null,
          tiene_carnet_oficial: body.tiene_carnet_oficial === "si",
          foto_documento: fotoDocumento,
          imagen,
        },
        { transaction },
      );

      await db.LicenciaChofer.create(
        {
          id_chofer: newChofer.id_chofer,
          numero: body.numero_licencia,
          categoria: body.categoria,
          fecha_emision: body.fecha_emision,
          fecha_vencimiento: body.fecha_vencimiento,
          imagen: fotoLicencia,
        },
        { transaction },
      );

      await choferService.guardarDocumentos(newChofer.id_chofer, req, transaction);

      await transaction.commit();
      return newChofer;
    } catch (error) {
      await transaction.rollback();
      console.log(error);
      throw error;
    }
  },

  // Guarda el DNI (varios archivos) y, si corresponde, el frente y dorso del carnet de la provincia
  guardarDocumentos: async function (id_chofer, req, transaction) {
    const files = req.files || {};
    const idUsuario = req.session && req.session.usuarioLogueado ? req.session.usuarioLogueado.id : null;
    if ((files.dni_archivos || []).length) {
      await documentoService.guardar({ entidad: "chofer", id: id_chofer, categoria: "dni", files: files.dni_archivos, idUsuario, transaction });
    }
    if (req.body.tiene_carnet_oficial === "si") {
      const carnet = [...(files.carnet_frente || []), ...(files.carnet_dorso || [])];
      if (carnet.length) await documentoService.guardar({ entidad: "chofer", id: id_chofer, categoria: "carnet_provincia", files: carnet, idUsuario, transaction });
    } else {
      documentoService.descartar([...(files.carnet_frente || []), ...(files.carnet_dorso || [])]);
    }
  },

  update: async function (id, data) {
    const [filas] = await db.Chofer.update(data, { where: { id_chofer: id } });
    return filas > 0;
  },

  // Guarda (o crea) la licencia principal del chofer: la de vencimiento más tardío
  guardarLicencia: async function (chofer, datosLicencia) {
    const licencias = chofer.licencias || [];
    const actual = licencias.length
      ? licencias.reduce((a, b) => (String(a.fecha_vencimiento) >= String(b.fecha_vencimiento) ? a : b))
      : null;

    if (actual) {
      await db.LicenciaChofer.update(datosLicencia, { where: { id_licencia: actual.id_licencia } });
    } else {
      await db.LicenciaChofer.create({ ...datosLicencia, id_chofer: chofer.id_chofer });
    }
  },
};

module.exports = choferService;
