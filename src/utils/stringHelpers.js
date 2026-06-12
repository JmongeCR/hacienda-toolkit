/* ─────────────────────────────────────────────
   STRING HELPERS — validaciones y normalización
───────────────────────────────────────────── */

/** Deja solo dígitos en una cadena */
export function onlyDigits(s) { return (s || "").replace(/\D+/g, "") }

/** Valida identificación CR: 9–12 dígitos */
export function isValidAeId(s) { const v = onlyDigits(s); return v.length >= 9 && v.length <= 12 }

/* ─── Mapa de palabras sin acento → con acento ─── */
const ACCENT_MAP = {
  // terminaciones -ería
  papeleria:"papelería",ferreteria:"ferretería",carniceria:"carnicería",
  panaderia:"panadería",libreria:"librería",zapateria:"zapatería",
  joyeria:"joyería",perfumeria:"perfumería",carpinteria:"carpintería",
  relojeria:"relojería",tortilleria:"tortillería",verduleria:"verdulería",
  fruteria:"frutería",licoreria:"licorería",merceria:"mercería",
  barberia:"barbería",peluqueria:"peluquería",
  // terminaciones -ción
  construccion:"construcción",comunicacion:"comunicación",
  administracion:"administración",educacion:"educación",
  informacion:"información",programacion:"programación",
  produccion:"producción",distribucion:"distribución",
  comercializacion:"comercialización",reparacion:"reparación",
  instalacion:"instalación",importacion:"importación",
  exportacion:"exportación",elaboracion:"elaboración",
  fabricacion:"fabricación",inspeccion:"inspección",
  recoleccion:"recolección",investigacion:"investigación",
  operacion:"operación",aplicacion:"aplicación",
  generacion:"generación",contaminacion:"contaminación",
  renovacion:"renovación",prestacion:"prestación",
  recepcion:"recepción",intervencion:"intervención",
  conexion:"conexión",gestion:"gestión",
  revision:"revisión",emision:"emisión",
  transmision:"transmisión",inversion:"inversión",
  provision:"provisión",television:"televisión",
  region:"región",pension:"pensión",
  sesion:"sesión",profesion:"profesión",
  ampliacion:"ampliación",fundacion:"fundación",
  traduccion:"traducción",proteccion:"protección",
  reduccion:"reducción",conduccion:"conducción",
  destruccion:"destrucción",reproduccion:"reproducción",
  // terminaciones -ía / técnico / orgánico
  consultoria:"consultoría",auditoria:"auditoría",
  farmacia:"farmacia",
  juridico:"jurídico",juridica:"jurídica",
  medico:"médico",medica:"médica",
  tecnico:"técnico",tecnica:"técnica",tecnicas:"técnicas",tecnicos:"técnicos",
  electronico:"electrónico",electronica:"electrónica",
  quimico:"químico",quimica:"química",
  organico:"orgánico",organica:"orgánica",
  plastico:"plástico",plastica:"plástica",plasticos:"plásticos",
  ceramica:"cerámica",mecanica:"mecánica",mecanico:"mecánico",
  economico:"económico",economica:"económica",
  agricola:"agrícola",maritimo:"marítimo",
  energetico:"energético",energetica:"energética",
  fotografico:"fotográfico",grafico:"gráfico",
  acustico:"acústico",optico:"óptico",optica:"óptica",
  estetico:"estético",estetica:"estética",
  ortopedico:"ortopédico",farmaceutico:"farmacéutico",farmaceutica:"farmacéutica",
  // artículos / sustantivos comunes
  articulo:"artículo",articulos:"artículos",
  maquina:"máquina",maquinas:"máquinas",
  catalogo:"catálogo",catalogos:"catálogos",
  calculo:"cálculo",calculos:"cálculos",
  cafe:"café",salmon:"salmón",
  jabon:"jabón",carbon:"carbón",
  salon:"salón",camion:"camión",
  limon:"limón",melon:"melón",
  avion:"avión",boton:"botón",
  corazon:"corazón",pinon:"piñón",
  // otros frecuentes en CABYS
  polimero:"polímero",polimeros:"polímeros",
  oxigeno:"oxígeno",hidrogeno:"hidrógeno",
  petroleo:"petróleo",
  acido:"ácido",acidos:"ácidos",
  electrico:"eléctrico",electrica:"eléctrica",
  opcion:"opción",codigo:"código",codigos:"códigos",
  publico:"público",publica:"pública",
  automatico:"automático",automatica:"automática",
  basico:"básico",basica:"básica",
  logistica:"logística",logistico:"logístico",
  informatica:"informática",informatico:"informático",
}

/** Restaura tildes en una query de búsqueda */
export function restoreAccents(query) {
  return query.toLowerCase().trim()
    .split(/\s+/)
    .map(w => ACCENT_MAP[w] || w)
    .join(" ")
}

const STOP_WORDS = new Set([
  "de","del","la","las","los","el","y","e","en","con","para","por",
  "a","al","o","u","se","que","como","su","sus","un","una","unos","unas",
  "este","esta","estos","estas","no","ni","si","otras","otros","otro","otra",
  "ncp","nep","n.c.p","n.e.p","mediante","través","tipo","tipos","clase",
  "clases","actividad","actividades","servicio","servicios","excepto",
  "salvo","incluye","incluido","incluidos","incluida","incluidas",
])

/** Extrae palabras clave de una descripción de actividad económica */
export function extractAeTerms(desc) {
  return desc.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z\s]/g," ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, 5)
    .join(" ")
}

/** Coincide descripción AE contra mapa de palabras clave */
export function matchAe(desc, AE_MAP) {
  const d = desc.toLowerCase()
  let best = null, bestScore = 0
  for (const ae of AE_MAP) {
    const score = ae.kw.filter(k => d.includes(k)).length
    if (score > bestScore) { best = ae; bestScore = score }
  }
  return best
}

/** Puntaje de coincidencia entre query y descripción */
export function scoreMatch(query, descripcion) {
  const qWords = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
    .split(/\s+/).filter(w => w.length > 2)
  if (!qWords.length) return 0
  const desc = descripcion.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
  const matches = qWords.filter(w => desc.includes(w)).length
  return Math.round((matches / qWords.length) * 100)
}
