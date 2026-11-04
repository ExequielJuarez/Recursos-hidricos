// Qué categorías de licencia habilitan a conducir cada tipo de vehículo (Argentina).
// Los tipos son editables por el usuario: un tipo que no figura acá no se restringe.
//   A  motos · B/B1 autos y camionetas · B2 utilitarios · C camiones sin acoplado
//   D  transporte de pasajeros · E camiones con acoplado · G maquinaria especial
const CATEGORIAS_POR_TIPO = [
  { patron: /moto/i, categorias: ["A"] },
  { patron: /aquinaria/i, categorias: ["G"] },
  { patron: /\bcami[oó]n(es)?\b/i, categorias: ["C", "E"] },
  { patron: /utilitario|ambulancia|furg[oó]n|combi/i, categorias: ["B", "B2", "C", "D", "E"] },
  { patron: /auto|camioneta|pick/i, categorias: ["B", "B1", "B2", "C", "D", "E"] },
];

const categoriasPermitidas = (descripcionTipo) => {
  if (!descripcionTipo) return null;
  const regla = CATEGORIAS_POR_TIPO.find((r) => r.patron.test(descripcionTipo));
  return regla ? regla.categorias : null;
};

// Mapa { "Camión": ["C","E"], ... } para los tipos dados (se usa también en el navegador)
const mapaPorTipo = (tipos) => {
  const mapa = {};
  tipos.forEach((t) => {
    const c = categoriasPermitidas(t);
    if (c) mapa[t] = c;
  });
  return mapa;
};

module.exports = { categoriasPermitidas, mapaPorTipo };
