// Pide un nuevo nombre y lo envía por POST (con token CSRF) para renombrar un elemento de un catálogo.
function renombrarCatalogo(url, valorActual, titulo) {
  var nuevo = window.prompt(titulo || 'Nuevo nombre:', valorActual);
  if (nuevo === null) return;
  nuevo = nuevo.trim();
  if (!nuevo || nuevo === valorActual) return;
  var form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  [['nombre', nuevo], ['_csrf', window.CSRF_TOKEN || '']].forEach(function (par) {
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = par[0];
    input.value = par[1];
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}
