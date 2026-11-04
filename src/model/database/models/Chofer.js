module.exports = (sequelize, DataTypes) => {
  const Chofer = sequelize.define('Chofer', {
    id_chofer: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    apellido: {
      type: DataTypes.STRING(50),
    },
    dni: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    direccion: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    fechaNacimiento: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    fechaIngreso: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    turno: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    foto_documento: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    imagen: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    motivoBaja: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    estado: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Activo'
    },
    tiene_carnet_oficial: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
  }, {
    tableName: 'chofer',
    timestamps: true
  });

  Chofer.associate = function(models) {
    Chofer.hasMany(models.LicenciaChofer, {
      foreignKey: 'id_chofer',
      as: 'licencias'
    });
    Chofer.hasMany(models.DocumentoAdjunto, {
      foreignKey: 'id_entidad',
      constraints: false,
      scope: { entidad: 'chofer' },
      as: 'documentos'
    });
    Chofer.hasMany(models.AsignacionVehiculo, {
      foreignKey: 'id_chofer',
      as: 'asignaciones'
    });
  };

  return Chofer;
};