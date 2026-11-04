module.exports = (sequelize, DataTypes) => {
  const AsignacionVehiculo = sequelize.define('AsignacionVehiculo', {
    id_asignacion: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    id_vehiculo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_chofer: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    fecha_salida: {
      type: DataTypes.DATE,
      allowNull: false
    },
    fecha_estimada_devolucion: {
      type: DataTypes.DATE
    },
    fecha_devolucion: {
      type: DataTypes.DATE
    },
    destino_area: {
      type: DataTypes.STRING(100)
    },
    observaciones: {
      type: DataTypes.TEXT
    },
    estado: {
      type: DataTypes.STRING(20),
      defaultValue: 'Activo'
    }
  }, {
    tableName: 'asignacion_vehiculo',
    timestamps: false
  });

  AsignacionVehiculo.associate = function(models) {
    AsignacionVehiculo.belongsTo(models.Chofer, {
      foreignKey: 'id_chofer'
    });

    AsignacionVehiculo.belongsTo(models.Vehiculo, {
      foreignKey: 'id_vehiculo',
      as: 'vehiculo'
    });
  };

  return AsignacionVehiculo;
};