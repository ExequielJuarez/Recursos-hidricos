const db = require("../model/database/models");
const bcrypt = require("bcryptjs");
const auditoriaService = require("../data/auditoriaService");
const { PERMISOS_DISPONIBLES, ROL_ADMIN, normalizarVistas, resolverPermisos, listaDesdeTexto } = require("../utils/permisos");

// Permisos que sólo un Administrador puede otorgar
const PERMISOS_RESTRINGIDOS = ["Usuarios", "Roles", "Auditoria"];
const MIN_LARGO_CLAVE = 8;

// ───────── Límite de intentos de login (en memoria) ─────────
const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const intentosFallidos = new Map();

const claveIntento = (req, usuario) => `${req.ip}|${String(usuario || "").toLowerCase()}`;

const estaBloqueado = (clave) => {
  const registro = intentosFallidos.get(clave);
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA_MS) {
    intentosFallidos.delete(clave);
    return false;
  }
  return registro.cantidad >= MAX_INTENTOS;
};

// Devuelve la cantidad de fallos acumulados
const registrarFallo = (clave) => {
  const registro = intentosFallidos.get(clave);
  if (!registro || Date.now() - registro.desde > VENTANA_MS) {
    intentosFallidos.set(clave, { cantidad: 1, desde: Date.now() });
    return 1;
  }
  registro.cantidad += 1;
  return registro.cantidad;
};

// Todo intento de ingreso fallido queda en la auditoría (con o sin usuario conocido)
const auditarIntento = (accion, usuarioDB, nombreIngresado, req, detalle) =>
  auditoriaService.registrarAuditoria(
    usuarioDB ? usuarioDB.id_usuario : null,
    "usuario",
    usuarioDB ? usuarioDB.id_usuario : null,
    accion,
    null,
    null,
    `${detalle} — usuario ingresado: "${String(nombreIngresado).slice(0, 50)}" (IP ${req.ip})`,
    { sinUsuario: true },
  );

// Hash de relleno para que el tiempo de respuesta no revele si el usuario existe
const HASH_RELLENO = bcrypt.hashSync("relleno-no-usar", 10);

const destinoSegunPermisos = (rol, permisos) => {
  if (rol === ROL_ADMIN) return "/Vehicles";
  const orden = [
    ["Vehicles", "/Vehicles"],
    ["Choferes", "/Choferes"],
    ["Mantenimientos", "/Mantenimientos"],
    ["Tools", "/Tools"],
    ["Alertas", "/Alertas"],
    ["Reportes", "/Reportes"],
    ["Usuarios", "/Usuarios"],
    ["Siniestros", "/Siniestros"],
    ["Auditoria", "/Auditoria"],
  ];
  const encontrado = orden.find(([permiso]) => permisos.includes(permiso));
  return encontrado ? encontrado[1] : null;
};

// Si los permisos elegidos son exactamente los del rol, no se guardan: el usuario HEREDA los del rol
// (así, cuando se edite el rol, el cambio le llega). Si difieren, quedan como permisos propios.
const permisosParaGuardar = (rol, permisos) => {
  if (rol.nombre === ROL_ADMIN) return null;
  const delRol = listaDesdeTexto(rol.permisos);
  const mismos = permisos.length === delRol.length && permisos.every((p) => delRol.includes(p));
  return mismos ? null : permisos.join(",");
};

const esAdminSesion = (req) => req.session.usuarioLogueado.rol === ROL_ADMIN;

const contarAdminsActivos = async (excluirId = null) => {
  const rolAdmin = await db.Rol.findOne({ where: { nombre: ROL_ADMIN } });
  if (!rolAdmin) return 0;
  const where = { id_rol: rolAdmin.id_rol, activo: true };
  if (excluirId) where.id_usuario = { [db.Sequelize.Op.ne]: excluirId };
  return db.Usuario.count({ where });
};

const userController = {
  InicioSesion: async (req, res) => {
    if (req.session && req.session.usuarioLogueado) return res.redirect("/Vehicles");
    res.render("Inicio_Sesion", { error: null });
  },

  ProcesoIniciarSesion: async (req, res) => {
    const mostrarError = (mensaje, estado = 401) => res.status(estado).render("Inicio_Sesion", { error: mensaje });

    try {
      const usuarioIngresado = String(req.body.usuario || req.body.Usuario || "").trim();
      const contrasenaIngresada = String(req.body.contrasena || req.body.Contrasena || "");

      if (!usuarioIngresado || !contrasenaIngresada) {
        return mostrarError("Ingresá tu usuario y contraseña.", 400);
      }

      const clave = claveIntento(req, usuarioIngresado);
      if (estaBloqueado(clave)) {
        await auditarIntento("LOGIN_BLOQUEADO", null, usuarioIngresado, req, "Intento de ingreso rechazado por exceso de intentos fallidos");
        return mostrarError("Demasiados intentos fallidos. Esperá 15 minutos e intentá nuevamente.", 429);
      }

      const usuarioDB = await db.Usuario.findOne({
        where: { nombre_usuario: usuarioIngresado },
        include: [{ association: "rol" }],
      });

      const contrasenaValida = bcrypt.compareSync(contrasenaIngresada, usuarioDB ? usuarioDB.contrasena : HASH_RELLENO);

      if (!usuarioDB || !contrasenaValida) {
        const fallos = registrarFallo(clave);
        await auditarIntento(
          "LOGIN_FALLIDO",
          usuarioDB,
          usuarioIngresado,
          req,
          usuarioDB ? "Contraseña incorrecta" : "Usuario inexistente",
        );
        if (fallos === MAX_INTENTOS) {
          await auditarIntento("LOGIN_BLOQUEADO", usuarioDB, usuarioIngresado, req, `Se alcanzó el máximo de ${MAX_INTENTOS} intentos fallidos: bloqueo de 15 minutos`);
        }
        return mostrarError("Usuario o contraseña incorrectos.");
      }

      if (!usuarioDB.activo) {
        await auditarIntento("LOGIN_RECHAZADO", usuarioDB, usuarioIngresado, req, "Intento de ingreso de un usuario desactivado");
        return mostrarError("Tu usuario ha sido bloqueado o desactivado. Contactá al administrador.", 403);
      }

      const permisosFinales = resolverPermisos(usuarioDB);
      const rol = usuarioDB.rol ? usuarioDB.rol.nombre : "Usuario";
      const destino = destinoSegunPermisos(rol, permisosFinales);

      if (!destino) {
        return mostrarError("Tu usuario no tiene ningún módulo habilitado. Contactá al administrador.", 403);
      }

      intentosFallidos.delete(clave);

      // Se regenera la sesión al loguearse (evita fijación de sesión)
      req.session.regenerate((err) => {
        if (err) {
          console.error(err);
          return mostrarError("No se pudo iniciar la sesión. Intentá nuevamente.", 500);
        }
        req.session.usuarioLogueado = {
          id: usuarioDB.id_usuario,
          nombre: usuarioDB.nombre,
          apellido: usuarioDB.apellido,
          rol,
          permisos: permisosFinales,
        };
        auditoriaService.registrarAuditoria(
          usuarioDB.id_usuario,
          "usuario",
          usuarioDB.id_usuario,
          "LOGIN",
          null,
          null,
          `Inicio de sesión de ${usuarioDB.nombre_usuario}`,
        );
        req.session.save(() => res.redirect(destino));
      });
    } catch (error) {
      console.error(error);
      return mostrarError("Error interno durante el inicio de sesión.", 500);
    }
  },

  CerrarSesion: async (req, res) => {
    const usuario = req.session && req.session.usuarioLogueado;
    if (usuario) {
      await auditoriaService.registrarAuditoria(usuario.id, "usuario", usuario.id, "LOGOUT", null, null, "Cierre de sesión");
    }
    req.session.destroy(() => res.redirect("/InicioSesion"));
  },

  ListarUsuarios: async (req, res) => {
    try {
      const usuariosDB = await db.Usuario.findAll({
        include: [{ association: "rol" }],
        order: [["nombre", "ASC"]],
      });
      res.render("listadoUsuarios", { usuarios: usuariosDB });
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al cargar la lista de usuarios.");
      res.redirect("/Vehicles");
    }
  },

  CargaUsuario: async (req, res) => {
    try {
      const rolesDB = await db.Rol.findAll();
      res.render("CargaUsuario", {
        roles: rolesDB,
        usuario: {},
        permisosUser: [],
      });
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al cargar el formulario.");
      res.redirect("/Usuarios");
    }
  },

  ProcesoCargaUsuario: async (req, res) => {
    const rolesDB = await db.Rol.findAll();
    const volverConError = (mensaje, datos = {}, vistas = []) => {
      res.locals.flash = { tipo: "error", mensaje };
      return res.status(400).render("CargaUsuario", {
        roles: rolesDB,
        usuario: datos,
        permisosUser: vistas,
      });
    };

    try {
      const nombre = String(req.body.nombre || "").trim();
      const apellido = String(req.body.apellido || "").trim();
      const nombre_usuario = String(req.body.nombre_usuario || "").trim();
      const contrasena = String(req.body.contrasena || "");
      const id_rol = Number(req.body.id_rol);
      const vistasPedidas = normalizarVistas(req.body.vistas);
      const datosPrevios = { nombre, apellido, nombre_usuario, id_rol };

      if (!nombre || !apellido || nombre.length > 50 || apellido.length > 50) {
        return volverConError("Ingresá nombre y apellido (hasta 50 caracteres).", datosPrevios, vistasPedidas);
      }
      if (!/^[A-Za-z0-9_.-]{3,50}$/.test(nombre_usuario)) {
        return volverConError(
          "El usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion y guion bajo.",
          datosPrevios,
          vistasPedidas,
        );
      }
      if (contrasena.length < MIN_LARGO_CLAVE) {
        return volverConError(`La contraseña debe tener al menos ${MIN_LARGO_CLAVE} caracteres.`, datosPrevios, vistasPedidas);
      }

      const rol = rolesDB.find((r) => r.id_rol === id_rol);
      if (!rol) return volverConError("Seleccioná un rol válido.", datosPrevios, vistasPedidas);

      const admin = esAdminSesion(req);
      if (rol.nombre === ROL_ADMIN && !admin) {
        return res
          .status(403)
          .send(
            "<div style='padding:20px; color:#721c24; background:#f8d7da; border-radius:5px;'><h2>🛑 Acceso Denegado</h2><p>No tienes permiso para crear un Administrador.</p><a href='/Usuarios'>Volver</a></div>",
          );
      }

      let permisos = vistasPedidas;
      if (rol.nombre === ROL_ADMIN) {
        permisos = [...PERMISOS_DISPONIBLES];
      } else if (!admin) {
        const propios = req.session.usuarioLogueado.permisos;
        const noPermitidos = permisos.filter((p) => PERMISOS_RESTRINGIDOS.includes(p) || !propios.includes(p));
        if (noPermitidos.length) {
          return volverConError(
            `No podés otorgar permisos que no tenés o que sólo puede dar un Administrador: ${noPermitidos.join(", ")}.`,
            datosPrevios,
            vistasPedidas,
          );
        }
      }

      const existente = await db.Usuario.findOne({ where: { nombre_usuario } });
      if (existente) return volverConError(`El usuario "${nombre_usuario}" ya existe.`, datosPrevios, vistasPedidas);

      const nuevoUsuario = await db.Usuario.create({
        nombre,
        apellido,
        nombre_usuario,
        contrasena: bcrypt.hashSync(contrasena, 10),
        id_rol,
        permisos: permisosParaGuardar(rol, permisos),
        activo: true,
      });

      await auditoriaService.desdeRequest(
        req,
        "usuario",
        nuevoUsuario.id_usuario,
        "CREAR",
        null,
        { nombre, apellido, nombre_usuario, id_rol, permisos: permisos.join(","), hereda_del_rol: permisosParaGuardar(rol, permisos) === null, activo: true },
        `Alta usuario: ${nombre} ${apellido} (${nombre_usuario})`,
      );

      req.flash("ok", "Usuario creado correctamente.");
      res.redirect("/Usuarios");
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al guardar el usuario en la base de datos.");
      res.redirect("/Usuarios/Carga");
    }
  },

  EditarUsuario: async (req, res) => {
    try {
      const usuarioAEditar = await db.Usuario.findByPk(req.params.id, { include: [{ association: "rol" }] });
      if (!usuarioAEditar) {
        req.flash("error", "El usuario no existe.");
        return res.redirect("/Usuarios");
      }

      if (usuarioAEditar.rol && usuarioAEditar.rol.nombre === ROL_ADMIN && !esAdminSesion(req)) {
        return res
          .status(403)
          .send(
            "<div style='padding:20px; color:#721c24; background:#f8d7da; border-radius:5px;'><h2>🛑 Acceso Denegado</h2><p>No puedes ver ni modificar el perfil de un Administrador.</p><a href='/Usuarios'>Volver</a></div>",
          );
      }

      const rolesDB = await db.Rol.findAll();
      res.render("EditarUsuario", {
        usuario: usuarioAEditar,
        roles: rolesDB,
        permisosUser: resolverPermisos(usuarioAEditar),
      });
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al buscar el usuario.");
      res.redirect("/Usuarios");
    }
  },

  ProcesoEditarUsuario: async (req, res) => {
    try {
      const idUsuario = Number(req.params.id);
      const usuarioViejo = await db.Usuario.findByPk(idUsuario, { include: [{ association: "rol" }] });
      if (!usuarioViejo) {
        req.flash("error", "El usuario no existe.");
        return res.redirect("/Usuarios");
      }

      const rolesDB = await db.Rol.findAll();
      const admin = esAdminSesion(req);
      const esYoMismo = req.session.usuarioLogueado.id === idUsuario;
      const viejoEsAdmin = usuarioViejo.rol && usuarioViejo.rol.nombre === ROL_ADMIN;

      const volverConError = (mensaje) => {
        res.locals.flash = { tipo: "error", mensaje };
        return res.status(400).render("EditarUsuario", {
          usuario: {
            id_usuario: idUsuario,
            nombre: req.body.nombre,
            apellido: req.body.apellido,
            nombre_usuario: req.body.nombre_usuario,
            activo: req.body.estado === "1",
            id_rol: Number(req.body.id_rol) || usuarioViejo.id_rol,
          },
          roles: rolesDB,
          permisosUser: normalizarVistas(req.body.vistas),
        });
      };

      if (viejoEsAdmin && !admin) {
        return res
          .status(403)
          .send(
            "<div style='padding:20px; color:#721c24; background:#f8d7da; border-radius:5px;'><h2>🛑 Acceso Denegado</h2><p>No tienes permisos para alterar a un Administrador.</p><a href='/Usuarios'>Volver</a></div>",
          );
      }

      const nombre = String(req.body.nombre || "").trim();
      const apellido = String(req.body.apellido || "").trim();
      const nombre_usuario = String(req.body.nombre_usuario || "").trim();
      const contrasenaNueva = String(req.body.contrasena || "");

      if (!nombre || !apellido || nombre.length > 50 || apellido.length > 50) {
        return volverConError("Ingresá nombre y apellido (hasta 50 caracteres).");
      }
      if (!/^[A-Za-z0-9_.-]{3,50}$/.test(nombre_usuario)) {
        return volverConError("El usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion y guion bajo.");
      }
      if (contrasenaNueva && contrasenaNueva.length < MIN_LARGO_CLAVE) {
        return volverConError(`La nueva contraseña debe tener al menos ${MIN_LARGO_CLAVE} caracteres.`);
      }

      const duplicado = await db.Usuario.findOne({
        where: { nombre_usuario, id_usuario: { [db.Sequelize.Op.ne]: idUsuario } },
      });
      if (duplicado) return volverConError(`El usuario "${nombre_usuario}" ya existe.`);

      // Cada uno puede editar sus datos personales, pero no su propio rol, estado ni permisos
      let id_rol = usuarioViejo.id_rol;
      let activo = usuarioViejo.activo;
      let permisosStr = usuarioViejo.permisos;
      let rolNuevo = usuarioViejo.rol;

      if (!esYoMismo) {
        id_rol = Number(req.body.id_rol);
        rolNuevo = rolesDB.find((r) => r.id_rol === id_rol);
        if (!rolNuevo) return volverConError("Seleccioná un rol válido.");
        if (rolNuevo.nombre === ROL_ADMIN && !admin) {
          return res
            .status(403)
            .send(
              "<div style='padding:20px; color:#721c24; background:#f8d7da; border-radius:5px;'><h2>🛑 Acceso Denegado</h2><p>No puedes asignar el rol de Administrador.</p><a href='/Usuarios'>Volver</a></div>",
            );
        }
        activo = req.body.estado === "1";

        const pedidos = normalizarVistas(req.body.vistas);
        const existentes = resolverPermisos(usuarioViejo);
        let permisos;
        if (rolNuevo.nombre === ROL_ADMIN) {
          permisos = [...PERMISOS_DISPONIBLES];
        } else if (admin) {
          permisos = pedidos;
        } else {
          const propios = req.session.usuarioLogueado.permisos;
          const noPermitidos = pedidos.filter(
            (p) => !existentes.includes(p) && (PERMISOS_RESTRINGIDOS.includes(p) || !propios.includes(p)),
          );
          if (noPermitidos.length) {
            return volverConError(
              `No podés otorgar permisos que no tenés o que sólo puede dar un Administrador: ${noPermitidos.join(", ")}.`,
            );
          }
          // Los permisos restringidos que ya tenía no se tocan (el formulario no los muestra)
          permisos = [...new Set([...pedidos, ...existentes.filter((p) => PERMISOS_RESTRINGIDOS.includes(p))])];
        }
        permisosStr = permisosParaGuardar(rolNuevo, permisos);

        // Nunca puede quedar el sistema sin un Administrador activo
        if (viejoEsAdmin && (rolNuevo.nombre !== ROL_ADMIN || !activo)) {
          if ((await contarAdminsActivos(idUsuario)) === 0) {
            return volverConError("No se puede quitar o desactivar al único Administrador activo del sistema.");
          }
        }
      }

      const cambios = { nombre, apellido, nombre_usuario, id_rol, permisos: permisosStr, activo };
      if (contrasenaNueva) cambios.contrasena = bcrypt.hashSync(contrasenaNueva, 10);

      await db.Usuario.update(cambios, { where: { id_usuario: idUsuario } });

      await auditoriaService.desdeRequest(
        req,
        "usuario",
        idUsuario,
        "EDITAR",
        {
          nombre: usuarioViejo.nombre,
          apellido: usuarioViejo.apellido,
          nombre_usuario: usuarioViejo.nombre_usuario,
          id_rol: usuarioViejo.id_rol,
          permisos: usuarioViejo.permisos,
          activo: usuarioViejo.activo,
        },
        { nombre, apellido, nombre_usuario, id_rol, permisos: permisosStr === null ? "(hereda del rol)" : permisosStr, activo, contrasena_modificada: !!contrasenaNueva },
        `Edición de usuario ID: ${idUsuario} (${nombre_usuario})${contrasenaNueva ? " — se cambió la contraseña" : ""}.`,
      );

      req.flash("ok", "Usuario actualizado correctamente.");
      res.redirect("/Usuarios");
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al actualizar el usuario.");
      res.redirect("/Usuarios");
    }
  },

  EditarRol: async (req, res) => {
    try {
      if (!esAdminSesion(req)) {
        return res
          .status(403)
          .send(
            "<div style='padding:20px; color:#721c24; background:#f8d7da; border-radius:5px;'><h2>🛑 Acceso Denegado</h2><p>Solo el Administrador del sistema puede ver la estructura de Roles.</p><a href='/Usuarios'>Volver</a></div>",
          );
      }
      const rol = await db.Rol.findByPk(req.params.id);
      if (!rol) {
        req.flash("error", "El rol no existe.");
        return res.redirect("/Usuarios/Roles");
      }
      const permisosActuales = rol.permisos ? rol.permisos.split(",").map((p) => p.trim()) : [];
      res.render("EditarRol", { rol, permisosActuales });
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al buscar el rol.");
      res.redirect("/Usuarios/Roles");
    }
  },

  ProcesoEditarRol: async (req, res) => {
    try {
      if (!esAdminSesion(req)) {
        return res
          .status(403)
          .send(
            "<div style='padding:20px; color:#721c24; background:#f8d7da; border-radius:5px;'><h2>🛑 Acceso Denegado</h2><p>Solo el Administrador puede modificar Roles.</p><a href='/Usuarios'>Volver</a></div>",
          );
      }

      const rolViejo = await db.Rol.findByPk(req.params.id);
      if (!rolViejo) {
        req.flash("error", "El rol no existe.");
        return res.redirect("/Usuarios/Roles");
      }
      // El Administrador siempre tiene acceso total; sus permisos no se editan
      if (rolViejo.nombre === ROL_ADMIN) {
        req.flash("error", "El rol Administrador tiene acceso total y no se puede modificar.");
        return res.redirect("/Usuarios/Roles");
      }

      const permisosString = normalizarVistas(req.body.vistas).join(",");
      await db.Rol.update({ permisos: permisosString }, { where: { id_rol: rolViejo.id_rol } });

      await auditoriaService.desdeRequest(
        req,
        "rol",
        rolViejo.id_rol,
        "EDITAR_PERMISOS",
        { permisos: rolViejo.permisos },
        { permisos: permisosString },
        `Modificación de permisos del rol ${rolViejo.nombre} (ID: ${rolViejo.id_rol})`,
      );

      const heredan = await db.Usuario.count({
        where: { id_rol: rolViejo.id_rol, [db.Sequelize.Op.or]: [{ permisos: null }, { permisos: "" }] },
      });
      const propios = await db.Usuario.count({
        where: { id_rol: rolViejo.id_rol, permisos: { [db.Sequelize.Op.and]: [{ [db.Sequelize.Op.ne]: null }, { [db.Sequelize.Op.ne]: "" }] } },
      });
      req.flash(
        "ok",
        `Permisos del rol actualizados. Se aplican a ${heredan} usuario(s) que heredan del rol` + (propios ? `; ${propios} usuario(s) con permisos propios no cambian.` : "."),
      );
      res.redirect("/Usuarios/Roles");
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al actualizar permisos.");
      res.redirect("/Usuarios/Roles");
    }
  },

  ListarRoles: async (req, res) => {
    try {
      const roles = await db.Rol.findAll();
      res.render("ListadoRoles", { roles });
    } catch (error) {
      console.error(error);
      req.flash("error", "Error al listar roles.");
      res.redirect("/Usuarios");
    }
  },
};

module.exports = userController;
