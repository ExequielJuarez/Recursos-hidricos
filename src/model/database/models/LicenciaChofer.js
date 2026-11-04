module.exports = (sequelize, DataTypes) => {
  const LicenciaChofer = sequelize.define(
    "LicenciaChofer",
    {
      id_licencia: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      id_chofer: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      numero: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      categoria: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      fecha_emision: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      fecha_vencimiento: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      imagen: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "licencia_chofer",
      timestamps: false,
    },
  );

  LicenciaChofer.associate = function (models) {
    LicenciaChofer.belongsTo(models.Chofer, {
      foreignKey: "id_chofer",
    });
  };

  return LicenciaChofer;
};
