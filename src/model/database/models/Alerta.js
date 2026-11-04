// src/model/database/models/Alerta.js


module.exports = (sequelize, DataTypes) => {
  const Alerta = sequelize.define('Alerta', {

    id_alerta: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    // Tipo de evento que generó la alerta
    tipo: {
      type: DataTypes.ENUM(
        'licencia_vencida',
        'licencia_proxima',
        'mantenimiento_pendiente',
        'mantenimiento_finalizado',
        'mantenimiento_proximo',
        'mantenimiento_vencido',
        'documentacion_vencida',
        'vehiculo_fuera_servicio',
        'vehiculo_en_mantenimiento',
        'herramienta_devuelta',
        'prestamo_vencido',
        'asignacion_vencida',
        'stock_bajo',
        'siniestro_activo',
        'critica',
        'informativa'
      ),
      allowNull: false
    },

    // Prioridad visual
    prioridad: {
      type: DataTypes.ENUM('alta', 'media', 'baja'),
      allowNull: false,
      defaultValue: 'media'
    },

    // Mensaje legible para el usuario
    mensaje: {
      type: DataTypes.STRING(255),
      allowNull: false
    },

    // Entidad relacionada: "Chofer", "Vehiculo", "Herramienta", etc.
    entidad_tipo: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    // ID del registro relacionado en su tabla
    entidad_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    // Nombre legible de la entidad (ej: "Juan Pérez", "AB123CD")
    entidad_nombre: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    leida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },

    // Para alertas automáticas generadas por el sistema
    generada_automaticamente: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }

  }, {
    tableName: 'alerta',
    timestamps: true   // createdAt = fecha de la alerta
  });

  return Alerta;
};