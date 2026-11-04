const btn = document.getElementById("btn");
const btn2 = document.getElementById("btn2");
const contOptions2 = document.getElementById("contOptions2");

btn.addEventListener("click", () => {
  contOptions2.classList.toggle("activo");
});

btn2.addEventListener("click", () => {
  contOptions2.classList.remove("activo");
});