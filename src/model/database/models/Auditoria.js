module.exports = (sequelize, dataTypes) => {
  let alias = "Auditoria";

  let cols = {
    id_auditoria: {
      type: dataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: dataTypes.INTEGER,
      allowNull: true,
    },
    tabla_afectada: {
      type: dataTypes.STRING(100),
      allowNull: false,
    },
    id_registro_afectado: {
      type: dataTypes.INTEGER,
      allowNull: true,
    },
    accion: {
      type: dataTypes.STRING(20),
      allowNull: false,
    },
    fecha: {
      type: dataTypes.DATEONLY,
      allowNull: false,
    },
    hora: {
      type: dataTypes.TIME,
      allowNull: false,
    },
    valor_anterior: {
      type: dataTypes.TEXT,
      allowNull: true,
    },
    valor_nuevo: {
      type: dataTypes.TEXT,
      allowNull: true,
    },
    descripcion: {
      type: dataTypes.TEXT,
      allowNull: true,
    },
  };

  let config = {
    tableName: "auditoria",
    timestamps: false, // No usamos createdAt ni updatedAt
  };

  const Auditoria = sequelize.define(alias, cols, config);

  Auditoria.associate = function (models) {
    Auditoria.belongsTo(models.Usuario, {
      as: "usuario",
      foreignKey: "id_usuario",
    });
  };
  return Auditoria;
};
