module.exports = (sequelize, dataTypes) => {
  let alias = "Rol";
  let cols = {
    id_rol: {
      type: dataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: dataTypes.STRING(50),
      allowNull: false,
    },
    descripcion: {
      type: dataTypes.STRING(255),
    },
    // === NUEVA COLUMNA AGREGADA ===
    permisos: {
      type: dataTypes.STRING(255),
      allowNull: true,
      defaultValue: "Vehicles",
    },
  };
  let config = {
    tableName: "rol",
    timestamps: false,
  };

  const Rol = sequelize.define(alias, cols, config);

  // Relación: Un rol puede tener muchos usuarios (ej. muchos choferes)
  Rol.associate = function (models) {
    Rol.hasMany(models.Usuario, {
      as: "usuarios",
      foreignKey: "id_rol",
    });
  };

  return Rol;
};
