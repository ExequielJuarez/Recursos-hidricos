module.exports = (sequelize, DataTypes) => {
  const DetalleMantenimiento = sequelize.define(
    "DetalleMantenimiento",
    {
      id_detalle: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      id_mantenimiento: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      id_repuesto: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      cantidad: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      costo_unitario: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "detalle_mantenimiento",
      timestamps: false,
    },
  );

  DetalleMantenimiento.associate = function (models) {
    // Relación con el Mantenimiento Padre
    DetalleMantenimiento.belongsTo(models.Mantenimiento, {
      foreignKey: "id_mantenimiento",
      as: "mantenimiento",
    });

    // Relación con el Repuesto Catálogo
    DetalleMantenimiento.belongsTo(models.Repuesto, {
      foreignKey: "id_repuesto",
      as: "repuesto",
    });
  };

  return DetalleMantenimiento;
};
