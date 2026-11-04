// src/middlewares/authMiddleware.js
const db = require("../model/database/models");
const { resolverPermisos, ROL_ADMIN } = require("../utils/permisos");
const { escapeHtml } = require("../utils/html");

// Prefijos en minúsculas: la comparación NO distingue mayúsculas (Express tampoco las distingue)
const reglasDeAcceso = [
  { prefijo: "/usuarios/roles", permisoRequerido: "Roles" },
  { prefijo: "/usuarios", permisoRequerido: "Usuarios" },
  { prefijo: "/vehicles", permisoRequerido: "Vehicles" },
  { prefijo: "/cargavehiculo", permisoRequerido: "Vehicles" },
  { prefijo: "/actualizarkm", permisoRequerido: "Vehicles" },
  { prefijo: "/asignaciones", permisoRequerido: "Vehicles" },
  { prefijo: "/choferes", permisoRequerido: "Choferes" },
  { prefijo: "/mantenimientos", permisoRequerido: "Mantenimientos" },
  { prefijo: "/cargamantenimiento", permisoRequerido: "Mantenimientos" },
  { prefijo: "/repuestos", permisoRequerido: "Mantenimientos" },
  { prefijo: "/tools", permisoRequerido: "Tools" },
  { prefijo: "/alertas", permisoRequerido: "Alertas" },
  { prefijo: "/reportes", permisoRequerido: "Reportes" },
  { prefijo: "/auditoria", permisoRequerido: "Auditoria" },
  { prefijo: "/siniestros", permisoRequerido: "Siniestros" },
];

const normalizarRuta = (ruta) => {
  let r = String(ruta || "/");
  try {
    r = decodeURIComponent(r);
  } catch (e) {
    /* ruta con codificación inválida: se usa tal cual */
  }
  return r.replace(/\/{2,}/g, "/").toLowerCase();
};

const permisoParaRuta = (ruta) => {
  const r = normalizarRuta(ruta);
  for (const regla of reglasDeAcceso) {
    if (r === regla.prefijo || r.startsWith(regla.prefijo + "/")) return regla.permisoRequerido;
  }
  return null;
};

const pantallaDenegada = (mensaje) => `
  <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; max-width: 500px; border-top: 5px solid #ef4444;">
          <svg style="width: 60px; height: 60px; color: #ef4444; margin: 0 auto 15px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <h2 style="color: #0f172a; margin-top: 0; font-size: 24px;">Acceso Denegado</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
              ${escapeHtml(mensaje)}
          </p>
          <a href="javascript:history.back()" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; transition: background 0.3s;">
              Volver a mi área segura
          </a>
      </div>
  </div>
`;

async function authMiddleware(req, res, next) {
  try {
    if (!req.session || !req.session.usuarioLogueado) {
      return res.redirect("/InicioSesion");
    }

    // Se revalida contra la base en cada request: si el usuario fue desactivado,
    // borrado o le cambiaron los permisos, el cambio se aplica de inmediato.
    const usuarioDB = await db.Usuario.findByPk(req.session.usuarioLogueado.id, {
      include: [{ association: "rol" }],
    });

    if (!usuarioDB || !usuarioDB.activo) {
      return req.session.destroy(() => res.redirect("/InicioSesion"));
    }

    const user = req.session.usuarioLogueado;
    user.nombre = usuarioDB.nombre;
    user.apellido = usuarioDB.apellido;
    user.rol = usuarioDB.rol ? usuarioDB.rol.nombre : "Usuario";
    user.permisos = resolverPermisos(usuarioDB);

    if (user.rol === ROL_ADMIN) return next();

    const permisoNecesario = permisoParaRuta(req.path);
    if (permisoNecesario && !user.permisos.includes(permisoNecesario)) {
      return res.status(403).send(pantallaDenegada("No tienes los privilegios necesarios para acceder a esta sección."));
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

authMiddleware.permisoParaRuta = permisoParaRuta;
authMiddleware.pantallaDenegada = pantallaDenegada;

module.exports = authMiddleware;
