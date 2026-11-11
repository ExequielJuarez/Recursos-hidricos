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
        },
        // Categorías de licencia que habilitan a manejar este tipo (ej: "C,E"). Vacío = cualquier licencia vigente
        licencias: {
            type: dataTypes.STRING(60),
            allowNull: true
        }
    };
    const config = {
        tableName: 'tipo_vehiculo',
        timestamps: false
    };

    const TipoVehiculo = sequelize.define(alias, cols, config);
    return TipoVehiculo;
};