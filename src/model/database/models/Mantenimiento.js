module.exports = (sequelize, DataTypes) => {
  const Mantenimiento = sequelize.define(
    "Mantenimiento",
    {
      id_mantenimiento: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_vehiculo: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tipo_servicio: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      fecha_fin: {
        type: DataTypes.DATEONLY,
      },
      km_servicio: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      // Columnas Financieras Clave
      costo_repuestos: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.00,
      },
      mano_obra: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.00,
      },
      costo_total: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.00,
      },
      descripcion: {
        type: DataTypes.TEXT,
      },
      observaciones: {
        type: DataTypes.TEXT,
      },
      proximo_km: {
        type: DataTypes.INTEGER,
      },
      proxima_fecha: {
        type: DataTypes.DATEONLY,
      },
      estado: {
        type: DataTypes.STRING(20),
        defaultValue: "Realizado",
      },
      // Datos administrativos (historial de mantenimiento)
      nro_remito: { type: DataTypes.STRING(50) },
      nro_factura: { type: DataTypes.STRING(50) },
      proveedor: { type: DataTypes.STRING(150) },
      nro_pedido: { type: DataTypes.STRING(50) },
      nro_expediente: { type: DataTypes.STRING(50) },
    },
    {
      tableName: "mantenimiento",
      timestamps: false,
    }
  );

  Mantenimiento.associate = function (models) {
    Mantenimiento.belongsTo(models.Vehiculo, {
      foreignKey: "id_vehiculo",
      as: "vehiculo",
    });

    Mantenimiento.belongsTo(models.Usuario, {
      foreignKey: "id_usuario",
      as: "usuario",
    });

    // ¡NUEVO! Conectamos el mantenimiento con la tabla detalle_mantenimiento
    if (models.DetalleMantenimiento) {
      Mantenimiento.hasMany(models.DetalleMantenimiento, {
        foreignKey: "id_mantenimiento",
        as: "detalles",
      });
    }
  };

  return Mantenimiento;
};