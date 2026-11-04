module.exports = (sequelize, dataTypes) => {
  let alias = "Operario";
  let cols = {
    id_operario: {
      type: dataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: dataTypes.STRING(100),
      allowNull: false,
    },
    estado: {
      type: dataTypes.STRING(50),
      defaultValue: "Activo",
    },
  };
  let config = {
    tableName: "operarios",
    timestamps: false,
  };

  const Operario = sequelize.define(alias, cols, config);
  return Operario;
};
