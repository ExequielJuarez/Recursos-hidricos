const db = require("../model/database/models");

const pad = (n) => String(n).padStart(2, "0");

// Fecha y hora locales (la zona horaria del proceso es America/Argentina/Buenos_Aires)
const fechaHoraLocal = () => {
  const d = new Date();
  return {
    fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
};

const aTexto = (valor) => {
  if (valor === undefined || valor === null) return null;
  try {
    return JSON.stringify(valor);
  } catch (e) {
    return null;
  }
};

const auditoriaService = {
  // Registra un movimiento. Nunca rompe la operación principal si falla.
  registrarAuditoria: async (id_usuario, tabla, id_registro, accion, valor_anterior, valor_nuevo, descripcion, opciones = {}) => {
    try {
      if (!id_usuario && !opciones.sinUsuario) {
        console.error("Auditoría omitida: no hay usuario asociado a la acción", tabla, accion);
        return;
      }
      const { fecha, hora } = fechaHoraLocal();
      const idRegistro = id_registro === null || id_registro === undefined || id_registro === "" ? NaN : Number(id_registro);
      await db.Auditoria.create(
        {
          id_usuario: id_usuario || null,
          tabla_afectada: tabla,
          id_registro_afectado: Number.isInteger(idRegistro) ? idRegistro : null,
          accion,
          fecha,
          hora,
          valor_anterior: aTexto(valor_anterior),
          valor_nuevo: aTexto(valor_nuevo),
          descripcion,
        },
        opciones.transaction ? { transaction: opciones.transaction } : {},
      );
    } catch (error) {
      console.error("Error: fallo al registrar la auditoría:", error.message);
    }
  },

  // Atajo para controladores: toma el usuario logueado de la request
  desdeRequest: (req, tabla, id_registro, accion, valor_anterior, valor_nuevo, descripcion, opciones) =>
    auditoriaService.registrarAuditoria(
      req.session && req.session.usuarioLogueado ? req.session.usuarioLogueado.id : null,
      tabla,
      id_registro,
      accion,
      valor_anterior,
      valor_nuevo,
      descripcion,
      opciones,
    ),
};

module.exports = auditoriaService;
