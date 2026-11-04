// Muestra un aviso flotante (éxito / error) sin alterar el diseño de la página.
(function () {
  window.mostrarAviso = function (tipo, mensaje) {
    var color = tipo === "error" ? { bg: "#fef2f2", bd: "#fecaca", tx: "#991b1b" } : { bg: "#ecfdf5", bd: "#a7f3d0", tx: "#065f46" };
    var div = document.createElement("div");
    div.setAttribute("role", "alert");
    div.textContent = mensaje;
    div.style.cssText =
      "position:fixed;top:80px;right:20px;z-index:99999;max-width:380px;padding:12px 16px;border-radius:8px;font:600 13px 'DM Sans',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.12);cursor:pointer;border:1px solid " +
      color.bd + ";background:" + color.bg + ";color:" + color.tx;
    div.onclick = function () { div.remove(); };
    document.body.appendChild(div);
    setTimeout(function () { if (div.parentNode) div.remove(); }, 6500);
  };
})();
