module.exports = (sequelize, dataTypes) => {
    const alias = 'Distrito';
    const cols = {
        id_distrito: {
            type: dataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombre: {
            type: dataTypes.STRING(100),
            allowNull: false
        }
    };
    const config = {
        tableName: 'distritos',
        timestamps: false
    };

    const Distrito = sequelize.define(alias, cols, config);
    return Distrito;
};