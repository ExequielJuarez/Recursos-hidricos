// Agrega el token CSRF a todos los formularios POST y a los fetch() no-GET.
(function () {
  var token = window.CSRF_TOKEN || "";
  if (!token) return;

  function preparar(form) {
    if (!form || (form.method || "").toLowerCase() !== "post") return;
    if ((form.enctype || "").toLowerCase() === "multipart/form-data") {
      if (form.action.indexOf("_csrf=") === -1) {
        form.action = form.action + (form.action.indexOf("?") === -1 ? "?" : "&") + "_csrf=" + encodeURIComponent(token);
      }
      return;
    }
    if (!form.querySelector('input[name="_csrf"]')) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = "_csrf";
      input.value = token;
      form.appendChild(input);
    }
  }

  document.addEventListener("submit", function (e) { preparar(e.target); }, true);
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("form").forEach(preparar);
  });

  var fetchOriginal = window.fetch;
  if (fetchOriginal) {
    window.fetch = function (url, opts) {
      opts = opts || {};
      var metodo = (opts.method || "GET").toUpperCase();
      if (metodo !== "GET" && metodo !== "HEAD") {
        opts.headers = new Headers(opts.headers || {});
        if (!opts.headers.has("x-csrf-token")) opts.headers.set("x-csrf-token", token);
      }
      return fetchOriginal.call(this, url, opts);
    };
  }
})();
