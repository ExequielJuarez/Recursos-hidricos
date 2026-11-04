// Publica el sistema desde TU PC con un link https que se puede pasar a otras personas (túnel de Cloudflare, gratis y sin cuenta).
//   npm run compartir                    → arranca el sistema y el túnel, y muestra el link
//
// Todo se ejecuta en tu PC: la base de datos y los archivos subidos quedan en tu PC. El túnel solo "pasa" el tráfico.
// Si tu PC se apaga, se duerme o cerrás esta ventana, el link deja de funcionar. El link cambia cada vez que lo volvés a iniciar.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const ES_WIN = process.platform === "win32";

// Link que muestra cloudflared en su salida, por ejemplo https://palabra-otra-palabra.trycloudflare.com
const extraerUrl = (texto) => {
  const m = String(texto).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return m ? m[0] : null;
};

// Contraseña aleatoria de 12 caracteres (letras, números, "-" y "_")
const generarClave = () => crypto.randomBytes(9).toString("base64url");

// Busca cloudflared: variable CLOUDFLARED_PATH, carpeta herramientas/ del proyecto, o el PATH del sistema
const buscarCloudflared = () => {
  const candidatos = [process.env.CLOUDFLARED_PATH, path.join(RAIZ, "herramientas", ES_WIN ? "cloudflared.exe" : "cloudflared")].filter(Boolean);
  for (const c of candidatos) if (fs.existsSync(c)) return c;
  const r = spawnSync(ES_WIN ? "where" : "which", ["cloudflared"], { encoding: "utf8" });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.split(/\r?\n/)[0].trim();
  return null;
};

const linea = (t = "") => console.log(t);
const caja = (titulo) => {
  linea();
  linea("  " + "=".repeat(62));
  linea("   " + titulo);
  linea("  " + "=".repeat(62));
};

async function principal() {
  require("dotenv").config({ quiet: true });

  // Modo "público": cookies seguras cuando llegan por el link https, y confianza en el túnel que está delante
  process.env.NODE_ENV = "production";
  process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || "auto"; // segura por el link https; http://localhost también funciona
  process.env.DB_NAME = process.env.DB_NAME || "vehiculos_db";
  process.env.DB_USER = process.env.DB_USER || "root";
  const PUERTO = Number(process.env.PORT) || 3000;
  process.env.PORT = String(PUERTO);

  // Clave de sesiones propia de esta PC (se crea una vez y se guarda; no se sube a git)
  if (!process.env.SESSION_SECRET) {
    const archivo = path.join(RAIZ, ".sesion-secreto");
    if (!fs.existsSync(archivo)) fs.writeFileSync(archivo, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
    process.env.SESSION_SECRET = fs.readFileSync(archivo, "utf8").trim();
  }

  const { prepararBaseDeDatos } = require("../src/model/database/preparar");
  const { asegurarUsuarios } = require("../src/model/database/usuariosBase");
  const { CLAVE_ADMIN, CLAVE_EMPLEADO } = require("../src/model/database/datosBase");

  // Las contraseñas no se cambian: son las de siempre (o las de .env si las definiste)
  const claveAdmin = process.env.ADMIN_PASSWORD || CLAVE_ADMIN;
  const claveEmpleado = process.env.EMPLEADO_PASSWORD || CLAVE_EMPLEADO;

  try {
    await prepararBaseDeDatos();
    await asegurarUsuarios({ adminPassword: claveAdmin, empleadoPassword: claveEmpleado });
  } catch (e) {
    console.error("\n  [ERROR] No se pudo preparar la base de datos: " + e.message);
    console.error("  Verificá que MySQL esté encendido y que los datos DB_* del archivo .env sean correctos.\n");
    process.exit(1);
  }

  // Arranca el sistema (es el mismo de siempre)
  await require("../src/app").iniciar();

  caja("SISTEMA FUNCIONANDO EN ESTA PC:  http://localhost:" + PUERTO);

  const mostrarUsuarios = () => {
    linea("  Usuarios para pasar a quienes van a probar:");
    linea(`    empleado ->  clave: ${claveEmpleado}   (sin reportes, control de acceso ni auditoría)`);
    linea(`    admin    ->  clave: ${claveAdmin}   (ve TODO: no se la pases a cualquiera)`);
    linea();
  };

  const cloudflared = buscarCloudflared();
  if (!cloudflared) {
    linea();
    linea("  Para generar el link público falta instalar cloudflared (gratis, ~40 MB):");
    linea("    Windows:  winget install --id Cloudflare.cloudflared   (y abrir una terminal nueva)");
    linea("    o bajar cloudflared-windows-amd64.exe de https://github.com/cloudflare/cloudflared/releases");
    linea("    y guardarlo como  herramientas\\cloudflared.exe  dentro del proyecto.");
    linea("  Después volvé a ejecutar:  npm run compartir");
    linea("  (Mientras tanto el sistema sigue funcionando solo en esta PC.)");
    linea();
    mostrarUsuarios();
    return;
  }

  linea();
  linea("  Creando el link público...");
  const hijo = spawn(cloudflared, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PUERTO}`], { stdio: ["ignore", "pipe", "pipe"] });
  let mostrado = false;
  const alSalida = (dato) => {
    if (mostrado) return;
    const url = extraerUrl(dato.toString());
    if (!url) return;
    mostrado = true;
    caja("LINK PARA COMPARTIR (válido mientras esta ventana siga abierta)");
    linea();
    linea("    " + url);
    linea();
    mostrarUsuarios();
    linea("  IMPORTANTE: tu PC debe quedar encendida, con internet y sin suspenderse. Para cortar el acceso: Ctrl + C.");
    linea("  Los archivos que suban se guardan en ESTA PC (carpetas uploads/ y public/img/).");
    linea();
  };
  hijo.stdout.on("data", alSalida);
  hijo.stderr.on("data", alSalida);
  hijo.on("exit", (codigo) => {
    console.log(`\n  El túnel se cerró (código ${codigo}). El link dejó de funcionar. Volvé a ejecutar: npm run compartir`);
    process.exit(codigo || 0);
  });
  const cerrar = () => {
    try {
      hijo.kill();
    } catch (e) {
      /* ya cerrado */
    }
    process.exit(0);
  };
  process.on("SIGINT", cerrar);
  process.on("SIGTERM", cerrar);
}

if (require.main === module) {
  principal().catch((e) => {
    console.error("\n  [ERROR] " + e.message + "\n");
    process.exit(1);
  });
}

module.exports = { extraerUrl, generarClave, buscarCloudflared };
