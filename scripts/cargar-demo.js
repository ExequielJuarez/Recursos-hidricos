// Recrea la base con el esquema y los datos de ejemplo (BORRA lo que haya en la base configurada).
//   npm run db:demo -- --confirmar
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

(async () => {
  const base = process.env.DB_NAME || "vehiculos_db";
  if (!process.argv.includes("--confirmar")) {
    console.log(`Esto BORRA y recrea la base "${base}" con los datos de ejemplo.`);
    console.log("Para continuar ejecutá:  npm run db:demo -- --confirmar");
    process.exit(1);
  }
  const dev = require("../src/model/database/config/database.json").development;
  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || dev.host,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || dev.username,
    password: process.env.DB_PASSWORD || dev.password || undefined,
    multipleStatements: true,
  });
  const sql = fs
    .readFileSync(path.join(__dirname, "../pruebasdb/copiaseguridad.sql"), "utf8")
    .replace(/`vehiculos_db`/g, "`" + base.replace(/[^A-Za-z0-9_]/g, "") + "`");
  await conexion.query(sql);
  await conexion.end();
  const { generarDocumentosDemo } = require("./documentos-demo");
  const pdfs = generarDocumentosDemo();
  console.log(`✅ Base "${base}" recreada con los datos de ejemplo (${pdfs} documentos PDF de muestra en uploads/documentos). Usuario: admin · contraseña: Ficha2026!`);
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
