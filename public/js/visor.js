// Visor de documentos (imágenes y PDF) en una ventana superpuesta.
(function () {
  var visor = document.getElementById("visor");
  if (!visor) return;
  var contenido = document.getElementById("visor-contenido");
  var nombre = document.getElementById("visor-nombre");
  var abrir = document.getElementById("visor-abrir");
  var descargar = document.getElementById("visor-descargar");

  function cerrar() {
    visor.classList.remove("visor--abierto");
    visor.setAttribute("aria-hidden", "true");
    contenido.innerHTML = "";
  }

  function abrirVisor(url, titulo) {
    contenido.innerHTML = "";
    var esPdf = /\.pdf($|\?)/i.test(titulo || "") || /\.pdf($|\?)/i.test(url);
    var el;
    if (esPdf) {
      el = document.createElement("iframe");
      el.src = url;
      el.title = titulo || "Documento";
    } else {
      el = document.createElement("img");
      el.src = url;
      el.alt = titulo || "Documento";
    }
    contenido.appendChild(el);
    nombre.textContent = titulo || "Documento";
    abrir.href = url;
    descargar.href = url + (url.indexOf("?") === -1 ? "?" : "&") + "descargar=1";
    visor.classList.add("visor--abierto");
    visor.setAttribute("aria-hidden", "false");
  }

  document.addEventListener("click", function (e) {
    var disparador = e.target.closest("[data-visor]");
    if (disparador) {
      e.preventDefault();
      abrirVisor(disparador.getAttribute("data-visor"), disparador.getAttribute("data-nombre"));
      return;
    }
    if (e.target === visor || e.target.id === "visor-cerrar") cerrar();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") cerrar();
  });
})();
