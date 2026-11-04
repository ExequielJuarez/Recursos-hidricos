module.exports = (sequelize, DataTypes) => {
  const DocumentoAdjunto = sequelize.define(
    "DocumentoAdjunto",
    {
      id_documento: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      entidad: { type: DataTypes.STRING(20), allowNull: false }, // "vehiculo" | "chofer"
      id_entidad: { type: DataTypes.INTEGER, allowNull: false },
      categoria: { type: DataTypes.STRING(40), allowNull: false },
      archivo: { type: DataTypes.STRING(255), allowNull: false }, // nombre en disco (uploads/documentos)
      nombre_original: { type: DataTypes.STRING(255) },
      id_usuario: { type: DataTypes.INTEGER },
    },
    { tableName: "documento_adjunto", timestamps: true },
  );
  return DocumentoAdjunto;
};
