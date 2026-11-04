// Mensajes de una sola vez (éxito / error) que se muestran en la próxima página.
const flashMiddleware = (req, res, next) => {
  res.locals.flash = null;
  if (req.session && req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  }
  req.flash = (tipo, mensaje) => {
    if (req.session) req.session.flash = { tipo, mensaje };
  };
  next();
};

module.exports = flashMiddleware;
