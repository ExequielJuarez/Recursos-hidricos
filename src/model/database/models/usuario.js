module.exports = (sequelize, dataTypes) => {
  let alias = "Usuario";
  let cols = {
    id_usuario: {
      type: dataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre_usuario: {
      type: dataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    contrasena: {
      type: dataTypes.STRING(255),
      allowNull: false,
    },
    nombre: {
      type: dataTypes.STRING(50),
      allowNull: false,
    },
    apellido: {
      type: dataTypes.STRING(50),
      allowNull: false,
    },
    activo: {
      type: dataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    id_rol: {
      type: dataTypes.INTEGER,
      allowNull: false,
    },
    // === NUEVA COLUMNA AGREGADA ===
    permisos: {
      type: dataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
  };
  let config = {
    tableName: "usuario",
    timestamps: false,
  };

  const Usuario = sequelize.define(alias, cols, config);

  // Relación: Un usuario pertenece a un único rol
  Usuario.associate = function (models) {
    Usuario.belongsTo(models.Rol, {
      as: "rol",
      foreignKey: "id_rol",
    });
  };

  return Usuario;
};
