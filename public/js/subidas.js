// Cajas de subida de archivos (.upload-box): toda la caja abre el selector de archivos
// (antes solo respondía el texto "Haga clic aquí...") y también se pueden arrastrar archivos encima.
(function () {
  function cajaDe(el) {
    return el && el.closest ? el.closest(".upload-box") : null;
  }
  function inputDe(caja) {
    return caja.querySelector('input[type="file"]');
  }
  function resaltar(caja, si) {
    caja.style.borderColor = si ? "var(--color-blue, #2563eb)" : "";
    caja.style.backgroundColor = si ? "#eff6ff" : "";
  }

  // Clic en cualquier parte de la caja → abre el selector. El texto (label) ya lo hace solo: no se duplica.
  document.addEventListener("click", function (e) {
    var caja = cajaDe(e.target);
    if (!caja) return;
    if (e.target.closest("label") || e.target.tagName === "INPUT") return;
    var input = inputDe(caja);
    if (input && !input.disabled) input.click();
  });

  // Arrastrar y soltar
  ["dragenter", "dragover"].forEach(function (nombre) {
    document.addEventListener(nombre, function (e) {
      var caja = cajaDe(e.target);
      if (!caja) return;
      e.preventDefault();
      resaltar(caja, true);
    });
  });
  document.addEventListener("dragleave", function (e) {
    var caja = cajaDe(e.target);
    if (caja && !caja.contains(e.relatedTarget)) resaltar(caja, false);
  });
  document.addEventListener("drop", function (e) {
    var caja = cajaDe(e.target);
    if (!caja) return;
    e.preventDefault();
    resaltar(caja, false);
    var input = inputDe(caja);
    var archivos = e.dataTransfer && e.dataTransfer.files;
    if (!input || input.disabled || !archivos || !archivos.length) return;
    var lista = new DataTransfer();
    var cantidad = input.multiple ? archivos.length : 1;
    for (var i = 0; i < cantidad; i++) lista.items.add(archivos[i]);
    input.files = lista.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
})();
