module.exports = (sequelize, dataTypes) => {
    const alias = 'Repuesto';
    const cols = {
        id_repuesto: {
            type: dataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombre: {
            type: dataTypes.STRING(150),
            allowNull: false
        },
        stock: {
            type: dataTypes.INTEGER,
            defaultValue: 0
        },
        stock_minimo: {
            type: dataTypes.INTEGER,
            allowNull: false,
            defaultValue: 3
        },
        costo_unitario: {
            type: dataTypes.DECIMAL(12, 2),
            defaultValue: 0.00
        }
    };
    const config = {
        tableName: 'repuestos',
        timestamps: false
    };

    const Repuesto = sequelize.define(alias, cols, config);
    return Repuesto;
};