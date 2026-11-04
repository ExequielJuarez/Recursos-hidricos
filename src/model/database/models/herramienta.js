module.exports = (sequelize, DataTypes) => {
  const Herramienta = sequelize.define(
    "Herramienta",
    {
      id_herramienta: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      codigo_activo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      sector: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      estado: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Disponible", // Disponible, Reparación, Baja
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      combustible_energia: {
        type: DataTypes.STRING(50),
        allowNull: true, // Ej: "85%", "Crítica", "Eléctrico"
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imagen_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      fecha_alta: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: "herramienta",
      timestamps: false,
    },
  );

  // =========================
  // RELACIONES (Asociaciones)
  // =========================
  Herramienta.associate = (models) => {
    // Una herramienta puede tener muchos préstamos
    Herramienta.hasMany(models.Prestamo, {
      as: "prestamos",
      foreignKey: "id_herramienta",
    });
  };

  return Herramienta;
};
