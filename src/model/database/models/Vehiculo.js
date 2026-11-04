// src/model/database/models/Vehiculo.js

module.exports = (sequelize, DataTypes) => {
  const Vehiculo = sequelize.define(
    "Vehiculo",
    {
      id_vehiculo: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      patente: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },

      legajo: {
        type: DataTypes.STRING(30),
        unique: true,
      },

      marca: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },

      modelo: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },

      anio: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      id_tipo: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      num_chasis: {
        type: DataTypes.STRING(50),
        unique: true, // Bloqueo de duplicados
      },

      num_motor: {
        type: DataTypes.STRING(50),
        unique: true, // Bloqueo de duplicados
      },

      combustible: {
        type: DataTypes.STRING(30),
      },
      transmision: {
        type: DataTypes.ENUM("Manual", "Automática"),
      },

      km_actual: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      cedula_numero: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true, // Bloqueo de duplicados
      },

      cedula_titular: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      seguro_compania: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      seguro_vencimiento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      rto_vencimiento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      estado_actual: {
        type: DataTypes.ENUM(
          "Disponible",
          "En uso",
          "En mantenimiento",
          "En siniestro",
          "Baja",
        ),
        allowNull: false,
        defaultValue: "Disponible",
      },

      distrito: {
        type: DataTypes.STRING(50),
      },

      area: {
        type: DataTypes.STRING(100),
      },

      observaciones: {
        type: DataTypes.TEXT,
      },

      imagen_url: {
        type: DataTypes.STRING(255),
      },

      fecha_alta: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      fecha_baja: {
        type: DataTypes.DATEONLY,
      },

      foto_cedula: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      foto_titulo: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      foto_rto: {
        type: DataTypes.STRING(255),
        allowNull: true,
      }
    },
    {
      tableName: "vehiculo",
      timestamps: false,
    },
  );

  Vehiculo.associate = function (models) {
    Vehiculo.belongsTo(models.TipoVehiculo, {
      foreignKey: "id_tipo",
      as: "TipoVehiculo",
    });

    Vehiculo.hasMany(models.Mantenimiento, {
      foreignKey: "id_vehiculo",
      as: "mantenimientos",
    });

    Vehiculo.hasMany(models.HistorialKm, {
      foreignKey: "id_vehiculo",
      as: "historial_km",
    });
  };

  return Vehiculo;
};
