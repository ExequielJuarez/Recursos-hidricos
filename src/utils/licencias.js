// Qué categorías de licencia habilitan a conducir cada tipo de vehículo (Argentina).
//   A  motos · B/B1 autos y camionetas · B2 utilitarios · C camiones sin acoplado
//   D  transporte de pasajeros · E camiones con acoplado · G maquinaria especial
// Cada tipo de vehículo guarda sus licencias en la base (Vehículos → Ajustes → Tipos de Vehículos).
// La tabla de abajo sólo se usa como valor inicial para tipos que todavía no las tienen cargadas.
const CATEGORIAS = ["A", "B", "B1", "B2", "C", "D", "E", "G"];

const CATEGORIAS_POR_TIPO = [
  { patron: /moto/i, categorias: ["A"] },
  { patron: /aquinaria/i, categorias: ["G"] },
  { patron: /\bcami[oó]n(es)?\b/i, categorias: ["C", "E"] },
  { patron: /utilitario|ambulancia|furg[oó]n|combi/i, categorias: ["B", "B2", "C", "D", "E"] },
  { patron: /auto|camioneta|pick/i, categorias: ["B", "B1", "B2", "C", "D", "E"] },
];

// Valor inicial sugerido según el nombre del tipo (null = sin sugerencia)
const categoriasPermitidas = (descripcionTipo) => {
  if (!descripcionTipo) return null;
  const regla = CATEGORIAS_POR_TIPO.find((r) => r.patron.test(descripcionTipo));
  return regla ? regla.categorias : null;
};

// Licencias que habilitan a manejar un tipo de vehículo (objeto TipoVehiculo).
// Devuelve null si no hay restricción (cualquier licencia vigente sirve).
const licenciasDeTipo = (tipo) => {
  if (!tipo) return null;
  if (tipo.licencias === null || tipo.licencias === undefined) return categoriasPermitidas(tipo.descripcion);
  const lista = String(tipo.licencias).split(",").map((c) => c.trim()).filter((c) => CATEGORIAS.includes(c));
  return lista.length ? lista : null;
};

// Normaliza lo que llega de un formulario (uno o varios checkboxes) a "C,E" ("" si no se marcó ninguna)
const normalizarLicencias = (valor) => {
  const lista = (Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]).map((c) => String(c).trim());
  return CATEGORIAS.filter((c) => lista.includes(c)).join(",");
};

// Mapa { "Camión": ["C","E"], ... } para los tipos dados (objetos TipoVehiculo; se usa también en el navegador)
const mapaPorTipo = (tipos) => {
  const mapa = {};
  tipos.forEach((t) => {
    const c = licenciasDeTipo(t);
    if (c) mapa[t.descripcion] = c;
  });
  return mapa;
};

module.exports = { CATEGORIAS, categoriasPermitidas, licenciasDeTipo, normalizarLicencias, mapaPorTipo };
