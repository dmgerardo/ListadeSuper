// Categorías/pasillos y unidades por defecto para listas nuevas. Confirmadas con el usuario
// en la Fase 2 (2026-10-06): son las secciones de su lista de Notas del iPhone, en el mismo
// orden. "Especiales" (compras de única ocasión) hace de cajón para lo que no encaje: no hay
// "Otros" aparte, por decisión del usuario.
const CATEGORIA_DEFECTO = "especiales";

const CATEGORIAS_ORDEN_DEFECTO = [
  "especiales",
  "frutas_temporada",
  "frutas",
  "verduras",
  "carniceria",
  "salchichoneria",
  "refris",
  "condimentos_aceites",
  "abarrotes",
  "botanas_semillas",
  "panaderia",
  "limpieza",
  "personal",
  "farmacia"
];

const CATEGORIAS_NOMBRES = {
  especiales: "Especiales",
  frutas_temporada: "Frutas de temporada",
  frutas: "Frutas",
  verduras: "Verduras",
  carniceria: "Carnicería",
  salchichoneria: "Salchichonería",
  refris: "Refris",
  condimentos_aceites: "Condimentos y aceites",
  abarrotes: "Abarrotes",
  botanas_semillas: "Botanas y semillas",
  panaderia: "Panadería",
  limpieza: "Limpieza",
  personal: "Personal",
  farmacia: "Farmacia"
};

// Otros nombres con los que puede venir un encabezado al importar una nota (ya
// normalizados: minúsculas, sin acentos). El nombre propio de cada categoría se reconoce
// solo, no hace falta repetirlo aquí.
const CATEGORIAS_ALIAS = {
  "frutas y verduras": "verduras",
  "carnes": "carniceria",
  "carnes y pescados": "carniceria",
  "salchichoneria y cremeria": "salchichoneria",
  "cremeria": "salchichoneria",
  "refrigerados": "refris",
  "lacteos": "refris",
  "condimentos": "condimentos_aceites",
  "botanas": "botanas_semillas",
  "semillas": "botanas_semillas",
  "pan": "panaderia",
  "cuidado personal": "personal",
  "especial": "especiales",
  "otros": "especiales"
};

// "pieza" es la unidad por defecto. lata/botella/docena: confirmadas con el usuario.
const UNIDADES_DEFECTO = ["pieza", "kg", "g", "l", "ml", "paquete", "caja", "bolsa", "lata", "botella", "docena"];
