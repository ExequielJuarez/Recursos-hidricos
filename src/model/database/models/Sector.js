module.exports = (sequelize, dataTypes) => {
  let alias = "Sector";
  let cols = {
    id_sector: {
      type: dataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: dataTypes.STRING(100),
      allowNull: false,
    },
  };
  let config = {
    tableName: "sectores",
    timestamps: false, // Falso porque no le pusimos columnas de createdAt/updatedAt
  };

  const Sector = sequelize.define(alias, cols, config);
  return Sector;
};
