"use strict";

// Agregamos dotenv al inicio para que lea el archivo .env antes de configurar nada
require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const process = require("process");
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const db = {};

// La conexión se configura SIEMPRE por variables de entorno (.env). Ver .env.example
// Si faltan, se usa la configuración local de desarrollo de database.json.
const config = require(__dirname + "/../config/database.json").development;

const opcionesComunes = {
  dialect: "mysql",
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
};

let sequelize;
if (process.env.DB_NAME && process.env.DB_USER) {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD || null,
    {
      ...opcionesComunes,
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT) || 3306,
    },
  );
} else if (env === "production") {
  throw new Error(
    "Faltan las variables de entorno de la base de datos (DB_NAME, DB_USER, DB_PASSWORD, DB_HOST).",
  );
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, {
    ...opcionesComunes,
    host: config.host,
  });
}

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 &&
      file !== basename &&
      file.slice(-3) === ".js" &&
      file.indexOf(".test.js") === -1
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes,
    );
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
