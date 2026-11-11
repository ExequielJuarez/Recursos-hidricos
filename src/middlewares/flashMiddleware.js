// Mensajes de una sola vez (éxito / error) que se muestran en la próxima página.
const flashMiddleware = (req, res, next) => {
  res.locals.flash = null;
  req.flash = (tipo, mensaje) => {
    if (req.session) req.session.flash = { tipo, mensaje };
  };

  // express-session envía la redirección ANTES de terminar de guardar la sesión en la base: si el navegador
  // pide la página siguiente muy rápido, el aviso todavía no está guardado y aparece recién una página después.
  // Por eso, antes de redirigir, se espera a que la sesión (con el aviso) quede guardada.
  const redirigir = res.redirect.bind(res);
  res.redirect = (...args) => {
    if (!req.session || typeof req.session.save !== "function") return redirigir(...args);
    req.session.save((error) => {
      if (error) console.log("No se pudo guardar la sesión antes de redirigir:", error.message);
      redirigir(...args);
    });
  };

  // El aviso se muestra una sola vez: se quita de la sesión y se guarda ANTES de seguir,
  // así una página pedida enseguida no lo vuelve a mostrar.
  if (req.session && req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
    return req.session.save((error) => {
      if (error) console.log("No se pudo guardar la sesión al mostrar el aviso:", error.message);
      next();
    });
  }
  next();
};

module.exports = flashMiddleware;
