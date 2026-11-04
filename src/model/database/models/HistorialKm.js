module.exports = (sequelize, DataTypes) => {
    const HistorialKm = sequelize.define('HistorialKm', {

        id_historial: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },

        id_vehiculo: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        km_anterior: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        km_nuevo: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        fecha: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },

        observaciones: {
            type: DataTypes.TEXT
        }

    }, {
        tableName: 'historial_km',
        timestamps: false
    });

    HistorialKm.associate = function(models) {
        HistorialKm.belongsTo(models.Vehiculo, {
            foreignKey: 'id_vehiculo',
            as: 'vehiculo'
        });
    };

    return HistorialKm;
};