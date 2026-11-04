module.exports = (sequelize, DataTypes) => {
  const alias = "Siniestro";
  const cols = {
    id_siniestro: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_vehiculo: { type: DataTypes.INTEGER, allowNull: false },
    id_chofer: { type: DataTypes.INTEGER, allowNull: true },       // ← FK al chofer
    chofer_involucrado: { type: DataTypes.STRING(100) },           // ← mantener por compatibilidad
    fecha_siniestro: { type: DataTypes.DATEONLY, allowNull: false },
    ubicacion: { type: DataTypes.STRING(255), allowNull: false },
    relato: { type: DataTypes.TEXT },
    danos_vehiculo: { type: DataTypes.TEXT },                      // ← nuevo
    tercero_vehiculo: { type: DataTypes.STRING(100) },             // ← renombrado
    tercero_seguro: { type: DataTypes.STRING(100) },               // ← renombrado
    tercero_conductor: { type: DataTypes.STRING(100) },            // ← renombrado
    tercero_contacto: { type: DataTypes.STRING(100) },             // ← renombrado
    estado: { type: DataTypes.STRING(50), defaultValue: 'EN PROCESO' },
    archivos_adjuntos: { type: DataTypes.TEXT }
  };
  const config = {
    tableName: "siniestro",
    timestamps: true
  };
  const Siniestro = sequelize.define(alias, cols, config);

  Siniestro.associate = function(models) {
    Siniestro.belongsTo(models.Vehiculo, {
      as: "Vehiculo",       // ← mayúscula para que la vista lo lea como s.Vehiculo
      foreignKey: "id_vehiculo"
    });
    Siniestro.belongsTo(models.Chofer, {
      as: "Chofer",         // ← nueva asociación
      foreignKey: "id_chofer"
    });
  };
  return Siniestro;
};