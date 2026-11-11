// Catálogo de tipos de servicio de mantenimiento (se eligen de una lista para no escribir el mismo servicio de dos formas)
module.exports = (sequelize, dataTypes) => {
  const alias = "TipoServicio";
  const cols = {
    id_tipo_servicio: {
      type: dataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: dataTypes.STRING(100),
      allowNull: false,
    },
  };
  const config = {
    tableName: "tipos_servicio",
    timestamps: false,
  };
  return sequelize.define(alias, cols, config);
};
