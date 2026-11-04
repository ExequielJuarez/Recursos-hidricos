module.exports = (sequelize, DataTypes) => {
  const Prestamo = sequelize.define(
    "Prestamo",
    {
      id_prestamo: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      id_herramienta: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      nombre_operario: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      fecha_salida: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      fecha_devolucion_estimada: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      fecha_devolucion_real: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      sector_destino: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      estado_prestamo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Activo", // Activo, Finalizado, Atrasado
      },
    },
    {
      tableName: "prestamo",
      timestamps: false,
    },
  );

  // =========================
  // RELACIONES (Asociaciones)
  // =========================
  Prestamo.associate = (models) => {
    // Un préstamo pertenece a una herramienta
    Prestamo.belongsTo(models.Herramienta, {
      as: "herramienta",
      foreignKey: "id_herramienta",
    });
  };

  return Prestamo;
};
