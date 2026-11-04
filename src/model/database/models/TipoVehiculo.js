module.exports = (sequelize, dataTypes) => {
    const alias = 'TipoVehiculo';
    const cols = {
        id_tipo: {
            type: dataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        descripcion: {
            type: dataTypes.STRING(100),
            allowNull: false
        },
        unidad: {
            type: dataTypes.STRING(10),
            allowNull: false,
            defaultValue: 'km'
        }
    };
    const config = {
        tableName: 'tipo_vehiculo',
        timestamps: false
    };

    const TipoVehiculo = sequelize.define(alias, cols, config);
    return TipoVehiculo;
};