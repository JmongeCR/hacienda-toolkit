import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import "./App.css"

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
async function checkApiStatus() {
  const start = performance.now()
  const res = await fetch("/hacienda/fe/ae?identificacion=110220294", { cache: "no-store" })
  const ms = Math.round(performance.now() - start)
  if (!res.ok) throw new Error("API down")
  return ms
}

function formatFechaCR(fecha) {
  if (!fecha) return ""
  const d = new Date(fecha)
  if (isNaN(d)) return fecha
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })
}

function relTime(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return "ahora"
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(ts).toLocaleDateString("es-CR", { day: "numeric", month: "short" })
}

function onlyDigits(s) { return (s || "").replace(/\D+/g, "") }
function isValidAeId(s) { const v = onlyDigits(s); return v.length === 9 || v.length === 10 || v.length === 11 }
function taxClass(imp) { const n = Number(imp); return `t${n === 0 ? 0 : n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 8 ? 8 : n <= 13 ? 13 : 15}` }
function nameInitials(name) { return (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() }
function saludo() { const h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches" }

/* ─── Tildes: mapa de palabras sin acento → con acento ─── */
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

function restoreAccents(query) {
  return query.toLowerCase().trim()
    .split(/\s+/)
    .map(w => ACCENT_MAP[w] || w)
    .join(" ")
}

/* ─── Extrae palabras clave de una descripción de AE ─── */
const STOP_WORDS = new Set([
  "de","del","la","las","los","el","y","e","en","con","para","por",
  "a","al","o","u","se","que","como","su","sus","un","una","unos","unas",
  "este","esta","estos","estas","no","ni","si","otras","otros","otro","otra",
  "ncp","nep","n.c.p","n.e.p","mediante","través","tipo","tipos","clase",
  "clases","actividad","actividades","servicio","servicios","excepto",
  "salvo","incluye","incluido","incluidos","incluida","incluidas",
])
function extractAeTerms(desc) {
  return desc.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z\s]/g," ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, 5)
    .join(" ")
}

/* ─── AE → CABYS bridge: mapa de actividades económicas comunes ─── */
const AE_MAP = [
  { kw:["restaurante","soda","comida","almuerzo","cena","cafeteria","cafetería"],        ciiu:"5610", label:"Restaurantes y servicio móvil de comidas",         q:"servicios restaurante comidas alimentacion" },
  { kw:["pulperia","pulpería","abarrotes","tienda","minisuper","colmado"],               ciiu:"4711", label:"Comercio al por menor en almacenes no especializados", q:"comercio minorista abarrotes productos" },
  { kw:["software","programacion","programación","desarrollo","sistemas","informatica"], ciiu:"6201", label:"Actividades de programación informática",             q:"servicios software programacion tecnologia" },
  { kw:["contabilidad","contador","auditoria","auditoría","fiscal","financiero"],        ciiu:"6920", label:"Actividades de contabilidad y auditoría",              q:"servicios contables auditoria contabilidad" },
  { kw:["abogado","juridico","jurídico","legal","notario","derecho"],                   ciiu:"6910", label:"Actividades jurídicas",                                q:"servicios juridicos legales abogado" },
  { kw:["construccion","construcción","obra","edificacion","contratista"],               ciiu:"4100", label:"Construcción de edificios",                           q:"servicios construccion obra edificacion" },
  { kw:["transporte","taxi","uber","carga","flete","logistica","logística"],             ciiu:"4921", label:"Transporte de pasajeros",                             q:"transporte pasajeros carga flete" },
  { kw:["medico","médico","clinica","clínica","salud","doctor","enfermeria"],            ciiu:"8621", label:"Actividades de médicos y odontólogos",                q:"servicios medicos salud clinica" },
  { kw:["farmacia","medicamento","drogueria","droguería"],                               ciiu:"4773", label:"Comercio al por menor de productos farmacéuticos",    q:"medicamentos farmacia salud" },
  { kw:["ferreteria","ferretería","herramienta","pintura","materiales"],                 ciiu:"4752", label:"Comercio de artículos de ferretería",                 q:"materiales ferreteria herramientas" },
  { kw:["ropa","vestir","calzado","moda","textil","confeccion","confección"],            ciiu:"4771", label:"Comercio al por menor de prendas de vestir",          q:"prendas vestir ropa calzado moda" },
  { kw:["agricultura","agricola","agrícola","cultivo","cosecha","finca"],               ciiu:"0111", label:"Cultivo de cereales y otros cultivos",                q:"productos agricolas cultivos cosecha" },
  { kw:["educacion","educación","escuela","academia","colegio","enseñanza","tutoria"],   ciiu:"8542", label:"Enseñanza superior y técnica",                       q:"servicios educacion ensenanza capacitacion" },
  { kw:["hotel","hospedaje","hostal","alquiler","airbnb","turismo"],                     ciiu:"5510", label:"Actividades de alojamiento",                         q:"hospedaje alojamiento hotel turismo" },
  { kw:["publicidad","marketing","diseño","grafico","gráfico","agencia","branding"],    ciiu:"7311", label:"Agencias de publicidad",                              q:"servicios publicidad marketing diseno" },
  { kw:["limpieza","aseo","conserje","janitorial","mantenimiento"],                      ciiu:"8121", label:"Limpieza general de edificios",                       q:"servicios limpieza aseo mantenimiento" },
  { kw:["mecanica","mecánica","taller","automovil","automóvil","vehiculo","vehículo"],  ciiu:"4520", label:"Mantenimiento y reparación de vehículos",             q:"reparacion mantenimiento vehiculos taller" },
  { kw:["electricista","electrico","eléctrico","instalacion","instalación"],             ciiu:"4321", label:"Instalaciones eléctricas",                           q:"instalacion electrica servicios electricos" },
  { kw:["peluqueria","peluquería","barberia","barbería","salon","salón","estetica"],    ciiu:"9602", label:"Peluquería y tratamientos de belleza",                q:"servicios peluqueria estetica belleza" },
  { kw:["veterinario","veterinaria","mascota","animal","clinica veterinaria"],           ciiu:"7500", label:"Actividades veterinarias",                           q:"servicios veterinarios animales mascotas" },
  { kw:["supermercado","autoservicio","hipermercado","maxi"],                            ciiu:"4711", label:"Comercio al por menor en supermercados",             q:"supermercado productos consumo" },
  { kw:["panaderia","panadería","reposteria","repostería","pasteleria","pastelería"],   ciiu:"1071", label:"Elaboración de pan y productos de panadería",        q:"pan panaderia reposteria productos horneados" },
  { kw:["importacion","importación","exportacion","exportación","comercio","aduanas"],  ciiu:"4690", label:"Comercio al por mayor no especializado",              q:"comercio importacion exportacion productos" },
  { kw:["fotografia","fotografía","video","audiovisual","produccion audiovisual"],       ciiu:"7420", label:"Actividades de fotografía",                          q:"servicios fotografia video audiovisual" },
  { kw:["seguridad","vigilancia","guardia","custodia"],                                  ciiu:"8010", label:"Actividades de seguridad privada",                   q:"servicios seguridad vigilancia" },
]

function matchAe(desc) {
  const d = desc.toLowerCase()
  let best = null, bestScore = 0
  for (const ae of AE_MAP) {
    const score = ae.kw.filter(k => d.includes(k)).length
    if (score > bestScore) { best = ae; bestScore = score }
  }
  return best
}

function scoreMatch(query, descripcion) {
  const qWords = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
    .split(/\s+/).filter(w => w.length > 2)
  if (!qWords.length) return 0
  const desc = descripcion.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
  const matches = qWords.filter(w => desc.includes(w)).length
  return Math.round((matches / qWords.length) * 100)
}

/* ─── Favoritos localStorage ─── */
const FAV_KEY = "hk_favs"
const loadFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]") } catch { return [] } }
const saveFavs = (items) => localStorage.setItem(FAV_KEY, JSON.stringify(items.slice(0, 30)))

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {}
  try {
    const ta = document.createElement("textarea")
    ta.value = text; document.body.appendChild(ta); ta.select()
    document.execCommand("copy"); document.body.removeChild(ta); return true
  } catch { return false }
}

function toCsv(rows, headers) {
  const esc = (v) => { const s = String(v ?? ""); const t = s.replace(/"/g, '""'); return /[",\n]/.test(t) ? `"${t}"` : t }
  return `${headers.map(esc).join(",")}\n${rows.map(r => r.map(esc).join(",")).join("\n")}\n`
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

function downloadXlsx(filename, sheetName, rows, headerOrder) {
  const data = rows.map(r => { const o = {}; headerOrder.forEach(h => (o[h] = r[h] ?? "")); return o })
  const ws = XLSX.utils.json_to_sheet(data, { header: headerOrder })
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  downloadBlob(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
}

async function fetchJsonSafe(url) {
  const res = await fetch(url, { cache: "no-store" })
  const ct = (res.headers.get("content-type") || "").toLowerCase()
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (!ct.includes("application/json")) throw new Error(`Respuesta no es JSON: ${text.slice(0, 100)}`)
  try { return JSON.parse(text) } catch { throw new Error(`JSON inválido: ${text.slice(0, 100)}`) }
}

function normalizeGometa(json) {
  if (!json) return []
  const arr = Array.isArray(json?.results) ? json.results : Array.isArray(json) ? json : [json]
  return arr.map((x, i) => ({
    id: x?.cedula || x?.rawcedula || x?.id || String(i),
    cedula: x?.cedula || x?.rawcedula || "",
    nombre: x?.fullname || x?.nombre || x?.name || "",
    tipo: x?.guess_type || x?.tipo || x?.type || "",
  })).filter(x => x.cedula || x.nombre)
}

/* ─── Historial localStorage ─── */
const H = 5
const loadH = k => { try { return JSON.parse(localStorage.getItem(k) || "[]") } catch { return [] } }
const saveH = (k, v) => { if (!v?.trim()) return; const p = loadH(k); localStorage.setItem(k, JSON.stringify([v, ...p.filter(x => x !== v)].slice(0, H))) }

/* ─── Activity log ─── */
const ACT_KEY = "hk_activity"
const loadActs = () => { try { return JSON.parse(localStorage.getItem(ACT_KEY) || "[]") } catch { return [] } }
function appendAct(type, q) {
  const acts = loadActs()
  acts.unshift({ type, q, ts: new Date().toISOString() })
  localStorage.setItem(ACT_KEY, JSON.stringify(acts.slice(0, 30)))
}

/* ─── Copy flash hook ─── */
function useCopyFlash() {
  const [fl, setFl] = useState(null)
  const t = useRef({})
  const flash = useCallback(async (id, fn) => {
    const text = typeof fn === "function" ? await fn() : fn
    if (!await copyText(text)) return
    clearTimeout(t.current[id]); setFl(id)
    t.current[id] = setTimeout(() => setFl(f => f === id ? null : f), 1500)
  }, [])
  return { fl, flash }
}

/* ─── SVG Icons ─── */
const IC = {
  dashboard:    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="6" height="6" rx="1.5"/><rect x="10" y="2" width="6" height="6" rx="1.5"/><rect x="2" y="10" width="6" height="6" rx="1.5"/><rect x="10" y="10" width="6" height="6" rx="1.5"/></svg>,
  search:       <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="5.5"/><path d="m13 13 3.5 3.5"/></svg>,
  user:         <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="6" r="3"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>,
  id:           <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="1.5" y="4.5" width="15" height="10" rx="1.5"/><circle cx="6" cy="9.5" r="1.8"/><path d="M10 7.5h5M10 11h4"/></svg>,
  currency:     <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="9" r="7.5"/><path d="M9 5v8M6.5 7c0-1.1.9-2 2.5-2s2.5.9 2.5 2-2 1.7-2.5 1.7S6.5 9.9 6.5 11s1.1 2 2.5 2 2.5-.9 2.5-2"/></svg>,
  receipt:      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h12v15l-2.5-2-2.5 2-2.5-2L5 17V2"/><path d="M7 6.5h4M7 9.5h4M7 12.5h2"/></svg>,
  chevronLeft:  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m9 3-4 4 4 4"/></svg>,
  chevronRight: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m5 3 4 4-4 4"/></svg>,
  refresh:      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 7A5 5 0 1 1 9.5 2.5L12 2"/><path d="M12 2v3.5H8.5"/></svg>,
  warning:      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7.5 2L14 13H1L7.5 2z"/><path d="M7.5 6v3.5"/><circle cx="7.5" cy="11" r=".6" fill="currentColor" stroke="none"/></svg>,
  empty:        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="9" r="7.5"/><path d="M6 9h6M9 6v6"/></svg>,
  bolt:         <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 1L3 9.5h5L5.5 15 13 6.5H8L9.5 1z"/></svg>,
  collapseLeft: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 3 5 7l4 4M1 7h4"/></svg>,
  expandRight:  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 3l4 4-4 4M9 7H5"/></svg>,
  sortUp:       <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 2l4 6H1z"/></svg>,
  sortDown:     <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 8l4-6H1z"/></svg>,
  sortBoth:     <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" opacity=".3"><path d="M5 1l4 5H1zM5 11l4-5H1z"/></svg>,
  clock:        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3l2 1.5"/></svg>,
  table:        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="12" height="12" rx="1"/><path d="M1 5h12M5 5v8"/></svg>,
  grid:         <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/><rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/></svg>,
  external:     <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1h4v4M11 1 6 6"/><path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8"/></svg>,
  shield:       <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2L3 5v5c0 3.3 2.5 6.4 6 7.3 3.5-.9 6-4 6-7.3V5L9 2z"/><path d="M6.5 9l2 2 3-3.5"/></svg>,
  star:         <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 1l1.8 3.6L13 5.4l-3 2.9.7 4.1L7 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z"/></svg>,
  starOff:      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7 1l1.8 3.6L13 5.4l-3 2.9.7 4.1L7 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z"/></svg>,
  cmd:          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 1a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4H3zM3 7a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4H3z"/><path d="M3 5v2M9 5v2"/></svg>,
  arrowRight:   <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m5 2 5 4-5 4M2 6h8"/></svg>,
  x:            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m3 3 8 8M11 3 3 11"/></svg>,
}

const ACT_ICONS  = { cabys: IC.search, contribuyente: IC.user, cedulas: IC.id, factura: IC.receipt, tipocambio: IC.currency, exoneraciones: IC.shield }
const ACT_LABELS = { cabys: "CABYS", contribuyente: "Contribuyente", cedulas: "Cédula TSE", factura: "Factura", tipocambio: "Tipo de Cambio", exoneraciones: "Exoneraciones" }

/* ─── Hub cards config ─── */
const HUB_CARDS = [
  { id: "cabys",          icon: IC.search,   color: "blue",    title: "Asistente CABYS",        desc: "Encontrá el código correcto para tus productos y servicios" },
  { id: "contribuyente",  icon: IC.user,     color: "green",   title: "Verificar Contribuyente", desc: "Estado fiscal, régimen y actividades económicas de cualquier contribuyente" },
  { id: "cedulas",        icon: IC.id,       color: "amber",   title: "Búsqueda de Cédulas",     desc: "Personas físicas y jurídicas registradas en el TSE" },
  { id: "tipocambio",     icon: IC.currency, color: "slate",   title: "Tipo de Cambio",          desc: "BCCR en tiempo real, histórico y conversor USD/CRC" },
  { id: "factura",        icon: IC.receipt,  color: "violet",  title: "Factura Electrónica",     desc: "Validá si un comprobante fue aceptado o rechazado por Hacienda" },
  { id: "exoneraciones",  icon: IC.shield,   color: "purple",  title: "Exoneraciones",           desc: "Verificá si una entidad tiene exoneración de impuestos en Hacienda" },
]

/* ─── CABYS suggested searches ─── */
const CABYS_SUGERENCIAS = [
  { label: "Restaurante / Soda",    q: "servicio comidas restaurante" },
  { label: "Software / TI",        q: "servicios software tecnologia informatica" },
  { label: "Contabilidad",          q: "servicios contables auditoria" },
  { label: "Transporte",            q: "transporte pasajeros" },
  { label: "Construcción",          q: "servicios construccion" },
  { label: "Farmacia / Salud",      q: "medicamentos farmacia salud" },
  { label: "Ferretería",            q: "materiales ferreteria herramientas" },
  { label: "Ropa / Calzado",        q: "prendas vestir ropa calzado" },
  { label: "Agricultura",           q: "productos agricolas cultivos" },
  { label: "Legal / Asesoría",      q: "servicios juridicos legales asesoria" },
]

/* ─────────────────────────────────────────────
   COMPONENTS
───────────────────────────────────────────── */
function Skeleton({ h = 16, w = "100%", rounded = false }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: rounded ? 999 : 4, display: "block" }} />
}

function ChipStatus({ label, value }) {
  if (!value) return null
  const v = String(value).toUpperCase()
  const cls = v === "NO" ? "chipOk" : (v === "SI" || v === "NO INSCRITO") ? "chipBad" : v === "INSCRITO" ? "chipOk" : ""
  return <span className={`chip ${cls}`}>{label}: {value}</span>
}

function CopyBtn({ id, label, getText, disabled, fl, flash }) {
  const active = fl === id
  return (
    <button className={`btn btnGhost${active ? " btnFlashed" : ""}`} onClick={() => flash(id, getText)}
      disabled={disabled || active} type="button">
      {active ? "✓ Copiado" : label}
    </button>
  )
}

function HistoryRow({ items, onSelect }) {
  if (!items.length) return null
  return (
    <div className="histRow">
      <span className="histLabel">Recientes:</span>
      {items.map(h => (
        <button key={h} type="button" className="histChip" onClick={() => onSelect(h)}>{h}</button>
      ))}
    </div>
  )
}

function EmptyState({ msg }) {
  return (
    <div className="emptyState">
      <div className="emptyIconBox">{IC.empty}</div>
      <span className="emptyText">{msg}</span>
    </div>
  )
}

function PageHeader({ icon, title, description }) {
  return (
    <div className="pageHeader">
      <div className="pageHeaderTop">
        <div className="pageHeaderIcon">{icon}</div>
        <h1 className="pageTitle">{title}</h1>
      </div>
      {description && <p className="pageDesc">{description}</p>}
    </div>
  )
}

function SortableTH({ col, sort, onSort, children, right }) {
  const active = sort.col === col
  return (
    <th className={`thSortable${right ? " thR" : ""}`} onClick={() => onSort(col)}>
      {children}
      <span className={`sortArrow${active ? " sortActive" : ""}`}>
        {active ? (sort.dir === "asc" ? IC.sortUp : IC.sortDown) : IC.sortBoth}
      </span>
    </th>
  )
}

/* ─── CABYS result card (enriched) ─── */
function CabysCard({ item, score, fl, flash, favs, onToggleFav }) {
  const isFav = favs?.some(f => f.codigo === item.codigo)
  const idCode = `cc-${item.codigo}`, idDesc = `cd-${item.codigo}`, idBoth = `cb-${item.codigo}`
  return (
    <div className={`cabysCard${isFav ? " cabysCardFav" : ""}`}>
      <div className="cabysCardHead">
        <span className="cabysCardCode">{item.codigo}</span>
        <div className="cabysCardHeadRight">
          {score != null && score > 0 && (
            <span className={`scoreBar score${score >= 80 ? "Hi" : score >= 50 ? "Mid" : "Lo"}`}>
              {score}%
            </span>
          )}
          <button className={`favBtn${isFav ? " favBtnOn" : ""}`} type="button"
            title={isFav ? "Quitar favorito" : "Guardar favorito"}
            onClick={() => onToggleFav(item)}>
            {isFav ? IC.star : IC.starOff}
          </button>
        </div>
      </div>
      <div className="cabysCardName">{item.descripcion}</div>
      <div className="cabysCardFoot">
        <span className={`taxBadgeV2 ${taxClass(item.impuesto)}`}>{item.impuesto}% IVA</span>
        <div className="cabysCardCopyGroup">
          <button className={`copyBtn${fl === idCode ? " copied" : ""}`} type="button"
            title="Copiar código" onClick={() => flash(idCode, String(item.codigo))}>
            {fl === idCode ? "✓" : "# Código"}
          </button>
          <button className={`copyBtn${fl === idDesc ? " copied" : ""}`} type="button"
            title="Copiar descripción" onClick={() => flash(idDesc, item.descripcion)}>
            {fl === idDesc ? "✓" : "T Descripción"}
          </button>
          <button className={`copyBtn copyBtnBoth${fl === idBoth ? " copied" : ""}`} type="button"
            title="Copiar código y descripción"
            onClick={() => flash(idBoth, `${item.codigo} — ${item.descripcion}`)}>
            {fl === idBoth ? "✓ Copiado" : "Copiar ambos"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Command Palette ─── */
function CommandPalette({ open, onClose, activities, navigate, setCabysQ, consultarCabysRef, setAeId, consultarAE, setCedQ, consultarCed }) {
  const [q, setQ] = useState("")
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  const actions = [
    { id:"cabys",         icon: IC.search,   label: "Asistente CABYS",         desc: "Buscá códigos por actividad o producto" },
    { id:"contribuyente", icon: IC.user,     label: "Verificar Contribuyente",  desc: "Estado fiscal y actividades económicas" },
    { id:"cedulas",       icon: IC.id,       label: "Búsqueda de Cédulas TSE",  desc: "Personas físicas y jurídicas" },
    { id:"tipocambio",    icon: IC.currency, label: "Tipo de Cambio",           desc: "USD/CRC en tiempo real" },
    { id:"factura",       icon: IC.receipt,  label: "Validar Factura",          desc: "Verificá si fue aceptada por Hacienda" },
    { id:"exoneraciones", icon: IC.shield,   label: "Exoneraciones",            desc: "Verificá exoneraciones de impuestos" },
  ]

  const isLikelyCedula = (s) => /^\d{9,11}$/.test(s.replace(/[-\s]/g,""))
  const isLikelyFe     = (s) => /^\d{30,50}$/.test(s.replace(/\s/g,""))

  const smartActions = useMemo(() => {
    const t = q.trim()
    if (!t) return []
    const results = []
    if (isLikelyCedula(t)) {
      results.push({ type:"smart", icon: IC.user,   label: `Consultar contribuyente: ${t}`, action: () => { setAeId(t); navigate("contribuyente"); setTimeout(() => consultarAE(t), 50) } })
      results.push({ type:"smart", icon: IC.id,     label: `Buscar cédula TSE: ${t}`,       action: () => { setCedQ(t); navigate("cedulas");        setTimeout(() => consultarCed(t), 50) } })
    } else if (isLikelyFe(t)) {
      results.push({ type:"smart", icon: IC.receipt, label: `Validar factura electrónica`, action: () => navigate("factura") })
    } else {
      results.push({ type:"smart", icon: IC.search,  label: `Buscar CABYS: "${t}"`, action: () => { navigate("cabys"); setTimeout(() => { setCabysQ(t); consultarCabysRef.current?.({ reset:true, q:t }) }, 50) } })
    }
    return results
  }, [q])

  const filteredActions = useMemo(() => {
    if (!q.trim()) return actions
    const low = q.toLowerCase()
    return actions.filter(a => a.label.toLowerCase().includes(low) || a.desc.toLowerCase().includes(low))
  }, [q])

  const recentItems = useMemo(() => {
    if (!activities?.length) return []
    return activities.slice(0, 5)
  }, [activities])

  const handleAction = (fn) => { fn(); onClose() }

  if (!open) return null
  return (
    <div className="cmdOverlay" onClick={onClose}>
      <div className="cmdModal" onClick={e => e.stopPropagation()}>
        <div className="cmdSearch">
          <span className="cmdSearchIcon">{IC.search}</span>
          <input ref={inputRef} className="cmdInput" value={q}
            placeholder="Buscar empresa, CABYS, factura…"
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") onClose()
              if (e.key === "Enter" && smartActions.length) handleAction(smartActions[0].action)
            }} />
          <button className="cmdClose" type="button" onClick={onClose}>{IC.x}</button>
        </div>

        <div className="cmdBody">
          {smartActions.length > 0 && (
            <div className="cmdSection">
              <div className="cmdSectionLabel">Acción directa</div>
              {smartActions.map((a, i) => (
                <button key={i} className="cmdItem cmdItemSmart" type="button" onClick={() => handleAction(a.action)}>
                  <span className="cmdItemIcon">{a.icon}</span>
                  <span className="cmdItemLabel">{a.label}</span>
                  <span className="cmdItemHint">{IC.arrowRight}</span>
                </button>
              ))}
            </div>
          )}

          {filteredActions.length > 0 && (
            <div className="cmdSection">
              <div className="cmdSectionLabel">{q.trim() ? "Herramientas" : "Acciones rápidas"}</div>
              {filteredActions.map(a => (
                <button key={a.id} className="cmdItem" type="button" onClick={() => handleAction(() => navigate(a.id))}>
                  <span className="cmdItemIcon">{a.icon}</span>
                  <div className="cmdItemText">
                    <span className="cmdItemLabel">{a.label}</span>
                    <span className="cmdItemDesc">{a.desc}</span>
                  </div>
                  <span className="cmdItemHint">{IC.arrowRight}</span>
                </button>
              ))}
            </div>
          )}

          {!q.trim() && recentItems.length > 0 && (
            <div className="cmdSection">
              <div className="cmdSectionLabel">Recientes</div>
              {recentItems.map((a, i) => (
                <button key={i} className="cmdItem" type="button" onClick={() => handleAction(() => {
                  if (a.type === "cabys") { setCabysQ(a.q); navigate("cabys"); setTimeout(() => consultarCabysRef.current?.({ reset:true, q:a.q }), 50) }
                  else if (a.type === "contribuyente") { setAeId(a.q); navigate("contribuyente"); setTimeout(() => consultarAE(a.q), 50) }
                  else if (a.type === "cedulas") { setCedQ(a.q); navigate("cedulas"); setTimeout(() => consultarCed(a.q), 50) }
                  else navigate(a.type)
                })}>
                  <span className="cmdItemIcon">{ACT_ICONS[a.type] || IC.search}</span>
                  <div className="cmdItemText">
                    <span className="cmdItemLabel">{a.q}</span>
                    <span className="cmdItemDesc">{ACT_LABELS[a.type]} · {relTime(a.ts)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cmdFooter">
          <span>↵ ejecutar</span>
          <span>Esc cerrar</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Ficha CRM de Contribuyente ─── */
function FichaContribuyente({ data, aeJsonId, onBuscarCabys, fl, flash, aeResumen, aeActCsv, downloadActs }) {
  const sit  = data?.situacion || {}
  const initials = nameInitials(data.nombre)
  const digits   = onlyDigits(String(aeJsonId || ""))
  const personType = digits.length === 9 ? "Física" : digits.length === 10 ? "Jurídica" : digits.length === 11 ? "DIMEX/NITE" : "—"
  const avatarColor = digits.length === 9 ? "avatarBlue" : digits.length === 10 ? "avatarGreen" : "avatarAmber"
  const estadoOk = (sit.estado || "").toUpperCase() === "INSCRITO"
  const moroso   = (sit.moroso || "NO").toUpperCase() !== "NO"
  const omiso    = (sit.omiso  || "NO").toUpperCase() !== "NO"

  return (
    <div className="crmCard">
      {/* Header perfil */}
      <div className="crmHeader">
        <div className={`crmAvatar ${avatarColor}`}>{initials}</div>
        <div className="crmHeaderInfo">
          <div className="crmName">{data.nombre}</div>
          <div className="crmMeta">
            <span className="crmMetaChip">{personType}</span>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>{aeJsonId}</span>
            {data.regimen?.descripcion && <span className="crmMetaChip crmMetaChipGray">{data.regimen.descripcion}</span>}
          </div>
        </div>
        <div className="crmHeaderActions">
          <span className={`crmEstadoBadge ${estadoOk ? "crmEstadoOk" : "crmEstadoBad"}`}>
            {sit.estado || "—"}
          </span>
          <a href="https://ovitribucr.hacienda.go.cr/ConsultaPublica/" target="_blank" rel="noopener noreferrer"
            className="btn btnGhost btnSm">{IC.external}</a>
        </div>
      </div>

      {/* Situación tributaria */}
      <div className="crmSection">
        <div className="crmSectionTitle">Situación tributaria</div>
        <div className="crmTaxGrid">
          <div className="crmTaxItem">
            <div className="crmTaxLabel">Moroso</div>
            <div className={`crmTaxVal ${moroso ? "crmTaxBad" : "crmTaxOk"}`}>{sit.moroso || "No"}</div>
          </div>
          <div className="crmTaxItem">
            <div className="crmTaxLabel">Omiso</div>
            <div className={`crmTaxVal ${omiso ? "crmTaxBad" : "crmTaxOk"}`}>{sit.omiso || "No"}</div>
          </div>
          {sit.administracionTributaria && (
            <div className="crmTaxItem">
              <div className="crmTaxLabel">Administración Tributaria</div>
              <div className="crmTaxVal">{sit.administracionTributaria}</div>
            </div>
          )}
        </div>
      </div>

      {/* Actividades económicas */}
      {data.actividades?.length > 0 && (
        <div className="crmSection">
          <div className="crmSectionTitle">Actividades económicas <span className="crmCount">{data.actividades.length}</span></div>
          {data.actividades.map(a => (
            <div key={`${a.codigo}-${a.tipo}`} className="crmActRow">
              <div className="crmActLeft">
                <span className="crmActCode">{a.codigo}</span>
                <div>
                  <div className="crmActName">{a.descripcion}</div>
                  <div className="crmActBadges">
                    <span className={`crmBadge ${a.tipo === "P" ? "crmBadgePrimary" : "crmBadgeSecondary"}`}>
                      {a.tipo === "P" ? "Principal" : "Secundaria"}
                    </span>
                    <span className={`crmBadge ${a.estado === "A" ? "crmBadgeOk" : "crmBadgeOff"}`}>
                      {a.estado === "A" ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                </div>
              </div>
              <button type="button" className="crmCabysBtn" onClick={() => onBuscarCabys(a.descripcion)}>
                Buscar CABYS {IC.arrowRight}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer acciones */}
      <div className="crmFooter">
        <CopyBtn id="ae-res" label="Copiar resumen" fl={fl} flash={flash} getText={aeResumen} disabled={false} />
        <CopyBtn id="ae-csv" label="Copiar CSV" fl={fl} flash={flash} getText={aeActCsv} disabled={!data?.actividades?.length} />
        <button className="btn btnGhost" onClick={downloadActs} disabled={!data?.actividades?.length} type="button">Descargar XLSX</button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   NAV CONFIG
───────────────────────────────────────────── */
const NAV = [
  { id: "home",           icon: IC.dashboard, label: "Inicio" },
  { id: "cabys",          icon: IC.search,    label: "Asistente CABYS" },
  { id: "contribuyente",  icon: IC.user,      label: "Contribuyente" },
  { id: "cedulas",        icon: IC.id,        label: "Cédulas TSE" },
  { id: "tipocambio",     icon: IC.currency,  label: "Tipo de Cambio" },
  { id: "factura",        icon: IC.receipt,   label: "Factura Electrónica" },
  { id: "exoneraciones",  icon: IC.shield,    label: "Exoneraciones" },
]
const NAV_MAP = Object.fromEntries(NAV.map(n => [n.id, n]))
const NAV_GROUPS = [
  { items: ["home", "cabys"] },
  { label: "Consultas",  items: ["contribuyente", "cedulas"] },
  { label: "Finanzas",   items: ["tipocambio", "factura"] },
  { label: "Tributario", items: ["exoneraciones"] },
]

/* ═════════════════════════════════════════════
   APP ROOT
═════════════════════════════════════════════ */
export default function App() {
  const [page,          setPage]          = useState("home")
  const [sideOpen,      setSideOpen]      = useState(false)
  const [sideCollapsed, setSideCollapsed] = useState(false)
  const [activities,    setActivities]    = useState(() => loadActs())
  const [searchQ,       setSearchQ]       = useState("")
  const [searchFocus,   setSearchFocus]   = useState(false)
  const [cmdOpen,       setCmdOpen]       = useState(false)
  const [cabysF_avs,    setCabysF_avs]    = useState(() => loadFavs())
  const [cabysAeMatch,  setCabysAeMatch]  = useState(null)

  const navigate = (id) => { setPage(id); setSideOpen(false); setSearchQ(""); setSearchFocus(false); setCmdOpen(false) }

  /* ─── ⌘K / Ctrl+K ─── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(o => !o) }
      if (e.key === "Escape") setCmdOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  /* ─── Toggle favorito CABYS ─── */
  const toggleFav = useCallback((item) => {
    setCabysF_avs(prev => {
      const exists = prev.some(f => f.codigo === item.codigo)
      const next = exists ? prev.filter(f => f.codigo !== item.codigo) : [item, ...prev]
      saveFavs(next); return next
    })
  }, [])

  const logActivity = useCallback((type, q) => {
    appendAct(type, q)
    setActivities(loadActs())
  }, [])

  /* ─── Navigate to CABYS with pre-filled query ─── */
  const navigateToCabys = useCallback((q) => {
    navigate("cabys")
    setTimeout(() => {
      setCabysQ(q)
      setCabysPage(0)
      consultarCabysRef.current({ reset: true, q })
    }, 50)
  }, [])
  const consultarCabysRef = useRef(null)

  /* ─── Search dropdown ─── */
  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return NAV
    return NAV.filter(n => n.label.toLowerCase().includes(q) || n.id.includes(q))
  }, [searchQ])

  /* ─── API STATUS ─── */
  const [apiStatus, setApiStatus] = useState(null)
  const [bccrOk,    setBccrOk]    = useState(null)

  const refreshApi = async () => {
    try { const ms = await checkApiStatus(); setApiStatus({ ok: true, ms, at: new Date() }) }
    catch { setApiStatus({ ok: false, at: new Date() }) }
  }

  /* ─── TIPO DE CAMBIO ─── */
  const [fx,        setFx]        = useState(null)
  const [fxLoading, setFxLoading] = useState(false)
  const [fxError,   setFxError]   = useState("")
  const [fxEur,     setFxEur]     = useState(null)

  const fetchFx = useCallback(async () => {
    setFxLoading(true); setFxError("")
    try {
      const json = await fetchJsonSafe("/hacienda/indicadores/tc")
      const pV = x => x && typeof x === "object" ? x.valor ?? "" : x ?? ""
      const pF = x => x && typeof x === "object" ? x.fecha ?? "" : x ?? ""
      const cR = json?.compra ?? json?.tipoCambioCompra ?? json?.dolar?.compra ?? json?.data?.tipoCambioCompra
      const vR = json?.venta  ?? json?.tipoCambioVenta  ?? json?.dolar?.venta  ?? json?.data?.tipoCambioVenta
      const compra = Number(pV(cR)), venta = Number(pV(vR))
      if (!compra && !venta) throw new Error("Sin datos")
      const fechaUsd = json?.fecha ?? json?.data?.fecha ?? pF(cR) ?? pF(vR)
      setFx({ compra, venta, fecha: fechaUsd })
      setBccrOk(true)
      // EUR desde el mismo endpoint de Hacienda
      try {
        const pV2 = x => x && typeof x === "object" ? x.valor ?? x : x
        const eurColones = json?.euro?.colones
        const eurFecha = json?.euro?.fecha ?? fechaUsd
        const eurVal = eurColones ? Number(pV2(eurColones)) : null
        if (eurVal) setFxEur({ colones: eurVal, fecha: eurFecha })
      } catch { /* silencioso */ }
    } catch { setFx(null); setFxError("No disponible"); setBccrOk(false) }
    finally { setFxLoading(false) }
  }, [])

  useEffect(() => {
    refreshApi(); fetchFx()
    const t = setInterval(refreshApi, 60_000)
    return () => clearInterval(t)
  }, [fetchFx])

  /* ─── CONVERSOR ─── */
  const [fxInput, setFxInput] = useState("")
  const [fxDir,   setFxDir]   = useState("usd2crc")
  const fxResult = useMemo(() => {
    if (!fx || fxInput === "") return null
    const n = parseFloat(fxInput.replace(/,/g, ""))
    if (isNaN(n) || n < 0) return null
    return fxDir === "usd2crc"
      ? (n * fx.venta).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (n / fx.compra).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [fx, fxInput, fxDir])

  /* ─── COPY FLASH ─── */
  const { fl, flash } = useCopyFlash()

  /* ─── TC HISTÓRICO ─── */
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [tcFecha,    setTcFecha]    = useState(todayStr)
  const [tcData,     setTcData]     = useState(null)
  const [tcLoading,  setTcLoading]  = useState(false)
  const [tcError,    setTcError]    = useState("")
  const [tcSearched, setTcSearched] = useState(false)

  const consultarTc = async () => {
    if (!tcFecha) return
    setTcLoading(true); setTcError(""); setTcSearched(true)
    try {
      const [y, m, d] = tcFecha.split("-"); const f = `${d}/${m}/${y}`
      const base = `/bccr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicos`
      const p = ind => `?Indicador=${ind}&FechaInicio=${f}&FechaFinal=${f}&Nombre=ht&SubNiveles=N&CorreoElectronico=no@no.com&Token=NONE`
      const [rC, rV] = await Promise.all([
        fetch(base + p(317), { cache: "no-store" }), fetch(base + p(318), { cache: "no-store" }),
      ])
      const [tC, tV] = await Promise.all([rC.text(), rV.text()])
      const xv = xml => { const mm = xml.match(/<NUM_VALOR>([\d.,]+)<\/NUM_VALOR>/); return mm ? parseFloat(mm[1].replace(",", ".")) : null }
      const compra = xv(tC), venta = xv(tV)
      if (!compra && !venta) throw new Error("Sin datos para esa fecha — puede ser feriado o fin de semana")
      setTcData({ compra, venta, fecha: tcFecha })
      logActivity("tipocambio", tcFecha)
    } catch (e) { setTcData(null); setTcError(e?.message || "Error") }
    finally { setTcLoading(false) }
  }

  /* ─── CABYS ─── */
  const [cabysQ,        setCabysQ]        = useState("")
  const [cabysTop,      setCabysTop]      = useState(12)
  const [cabysData,     setCabysData]     = useState([])
  const [cabysLoading,  setCabysLoading]  = useState(false)
  const [cabysError,    setCabysError]    = useState("")
  const [cabysPage,     setCabysPage]     = useState(0)
  const [cabysLastTop,  setCabysLastTop]  = useState(0)
  const [cabysSearched, setCabysSearched] = useState(false)
  const [cabysHist,     setCabysHist]     = useState(() => loadH("ht_cabys"))
  const [cabysSort,     setCabysSort]     = useState({ col: null, dir: "asc" })
  const [cabysView,     setCabysView]     = useState("cards") // "cards" | "table"
  const [cabysNorm,     setCabysNorm]     = useState("")      // query normalizada (con tildes)
  const [cabysMode,     setCabysMode]     = useState("libre") // "libre" | "ae"
  const [aeDesc,        setAeDesc]        = useState("")      // descripción actividad económica

  const cabysQ_  = useMemo(() => cabysQ.trim(), [cabysQ])
  const pageSize = useMemo(() => { const n = Number(cabysTop); return Number.isFinite(n) && n > 0 ? Math.min(50, Math.max(6, n)) : 12 }, [cabysTop])

  const consultarCabys = useCallback(async ({ reset = false, q: qOv } = {}) => {
    const rawQ = (qOv ?? cabysQ_).trim(); if (!rawQ) return
    const q = restoreAccents(rawQ)
    setCabysNorm(q !== rawQ ? q : "")
    if (reset) setCabysPage(0)
    setCabysLoading(true); setCabysError(""); setCabysSearched(true)
    try {
      const pg = reset ? 0 : cabysPage
      const top = Math.min(50, pageSize * (pg + 1)); setCabysLastTop(top)
      const res = await fetch(`/hacienda/fe/cabys?q=${encodeURIComponent(q)}&top=${top}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json(); setCabysData(json.cabys || [])
      if (reset) { saveH("ht_cabys", rawQ); setCabysHist(loadH("ht_cabys")); setCabysPage(0); logActivity("cabys", rawQ) }
    } catch (e) { setCabysData([]); setCabysError(e?.message || "Error") }
    finally { setCabysLoading(false) }
  }, [cabysQ_, cabysPage, pageSize, logActivity])

  const consultarCabysAe = useCallback(() => {
    const ae = matchAe(aeDesc)
    const terms = ae ? ae.q : extractAeTerms(aeDesc)
    if (!terms) return
    const normalized = restoreAccents(terms)
    setCabysAeMatch(ae || null)
    setCabysQ(normalized)
    setCabysMode("libre")
    consultarCabysRef.current?.({ reset: true, q: normalized })
  }, [aeDesc])

  useEffect(() => { consultarCabysRef.current = consultarCabys }, [consultarCabys])

  const cabysNext = async () => {
    const np = cabysPage + 1, need = Math.min(50, pageSize * (np + 1))
    if (cabysData.length < need) {
      setCabysLoading(true); setCabysError("")
      try {
        const res = await fetch(`/hacienda/fe/cabys?q=${encodeURIComponent(cabysQ_)}&top=${need}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json(); setCabysData(json.cabys || []); setCabysLastTop(need)
      } catch (e) { setCabysError(e?.message || "Error"); setCabysLoading(false); return }
      finally { setCabysLoading(false) }
    } else { setCabysLastTop(need) }
    setCabysPage(np)
  }

  const cabysTotal = cabysData.length
  const cabysStart = cabysPage * pageSize, cabysEnd = cabysStart + pageSize
  const cabysRaw   = cabysData.slice(cabysStart, cabysEnd)
  const cabysRows  = useMemo(() => {
    if (!cabysSort.col) return cabysRaw
    return [...cabysRaw].sort((a, b) => {
      const av = String(a[cabysSort.col] ?? ""), bv = String(b[cabysSort.col] ?? "")
      const r = av.localeCompare(bv, "es", { numeric: cabysSort.col !== "descripcion" })
      return cabysSort.dir === "asc" ? r : -r
    })
  }, [cabysRaw, cabysSort])
  const cabysHasNext = cabysEnd < cabysTotal || (cabysTotal === cabysLastTop && cabysLastTop < 50)

  const handleCabysSort = (col) => {
    setCabysSort(s => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" })
  }

  /* ─── AE / CONTRIBUYENTE ─── */
  const [aeId,       setAeId]       = useState("")
  const [aeData,     setAeData]     = useState(null)
  const [aeLoading,  setAeLoading]  = useState(false)
  const [aeError,    setAeError]    = useState("")
  const [aeSearched, setAeSearched] = useState(false)
  const [aeHist,     setAeHist]     = useState(() => loadH("ht_ae"))
  const aeLastQ = useRef("")

  const aeDigits = useMemo(() => onlyDigits(aeId), [aeId])
  const aeValid  = useMemo(() => isValidAeId(aeId), [aeId])

  const consultarAE = async (idOv) => {
    const digits = idOv ? onlyDigits(idOv) : aeDigits
    if (!isValidAeId(digits)) return
    setAeLoading(true); setAeError(""); setAeSearched(true)
    try {
      const res = await fetch(`/hacienda/fe/ae?identificacion=${digits}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json(); setAeData(json)
      aeLastQ.current = digits; saveH("ht_ae", digits); setAeHist(loadH("ht_ae"))
      logActivity("contribuyente", digits)
    } catch (e) { setAeData(null); setAeError(e?.message || "Error") }
    finally { setAeLoading(false) }
  }

  const aeJsonId = useMemo(() => {
    const raw = aeData?.identificacion ?? aeData?.identificacionTributaria ?? aeData?.cedula ?? aeData?.id ?? ""
    return onlyDigits(String(raw)) || aeLastQ.current
  }, [aeData])

  const aeResumen = () => {
    if (!aeData) return ""; const s = aeData?.situacion || {}
    return [`Contribuyente`, `Nombre: ${aeData.nombre || "-"}`, `Identificación: ${aeJsonId || "-"}`,
      `Régimen: ${aeData.regimen?.descripcion || "-"}`, `Estado: ${s.estado || "-"}`,
      `Moroso: ${s.moroso || "-"}`, `Omiso: ${s.omiso || "-"}`,
      `AT: ${s.administracionTributaria || "-"}`].join("\n")
  }

  const aeActCsv = () => {
    if (!aeData?.actividades?.length) return ""
    return toCsv(aeData.actividades.map(a => [a.codigo, a.descripcion, a.tipo === "P" ? "Principal" : "Secundaria", a.estado === "A" ? "Activa" : "Inactiva"]), ["codigo", "descripcion", "tipo", "estado"])
  }

  /* ─── CÉDULAS ─── */
  const [cedQ,        setCedQ]        = useState("")
  const [cedItems,    setCedItems]    = useState([])
  const [cedLoading,  setCedLoading]  = useState(false)
  const [cedError,    setCedError]    = useState("")
  const [cedSearched, setCedSearched] = useState(false)
  const [cedHist,     setCedHist]     = useState(() => loadH("ht_ced"))
  const cedQ_ = useMemo(() => cedQ.trim(), [cedQ])

  const consultarCed = async (qOv) => {
    const q = (qOv ?? cedQ_).trim(); if (!q) return
    setCedLoading(true); setCedError(""); setCedItems([]); setCedSearched(true)
    try {
      const json = await fetchJsonSafe(`/gometa/cedulas/${encodeURIComponent(q)}`)
      setCedItems(normalizeGometa(json))
      saveH("ht_ced", q); setCedHist(loadH("ht_ced"))
      logActivity("cedulas", q)
    } catch (e) { setCedError(e?.message || "Error") }
    finally { setCedLoading(false) }
  }

  /* ─── FACTURA ─── */
  const [feKey,      setFeKey]      = useState("")
  const [feData,     setFeData]     = useState(null)
  const [feNotFound, setFeNotFound] = useState(false)
  const [feLoading,  setFeLoading]  = useState(false)
  const [feError,    setFeError]    = useState("")
  const [feSearched, setFeSearched] = useState(false)

  const feClean = useMemo(() => onlyDigits(feKey), [feKey])
  const feValid = feClean.length === 50

  const feDecoded = useMemo(() => {
    if (feClean.length !== 50) return null
    const pais = feClean.slice(0, 3), dia = feClean.slice(3, 5), mes = feClean.slice(5, 7), anio = feClean.slice(7, 9)
    const cedula = feClean.slice(9, 21).replace(/^0+/, ""), terminal = feClean.slice(21, 24)
    const consec = feClean.slice(24, 41), situacion = feClean.slice(41, 42), seguridad = feClean.slice(42, 50)
    const tipos = { "001": "Factura Electrónica", "002": "Nota de Débito", "003": "Nota de Crédito", "004": "Tiquete Electrónico", "008": "FE de Compra", "009": "FE de Exportación" }
    const sits  = { "1": "Normal", "2": "Contingencia", "3": "Sin internet" }
    return { pais, tipo: tipos[consec.slice(0, 3)] || `Comprobante ${consec.slice(0, 3)}`, fecha: `${dia}/${mes}/20${anio}`, cedula, terminal, consecutivo: consec.replace(/^0+/, ""), situacion: sits[situacion] || situacion, seguridad }
  }, [feClean])

  const consultarFe = async () => {
    if (!feValid) return
    setFeLoading(true); setFeError(""); setFeSearched(true); setFeData(null); setFeNotFound(false)
    try {
      const res = await fetch(`/hacienda/fe/documento?clave=${feClean}`, { cache: "no-store" })
      if (res.status === 404) { setFeNotFound(true); logActivity("factura", feClean.slice(0, 20) + "…"); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json?.code === 404) { setFeNotFound(true); logActivity("factura", feClean.slice(0, 20) + "…"); return }
      setFeData(json); logActivity("factura", feClean.slice(0, 20) + "…")
    } catch (e) { setFeError(e?.message || "Error") }
    finally { setFeLoading(false) }
  }

  const feResumen = () => {
    if (!feData) return ""
    return [`Factura Electrónica`, `Clave: ${feClean}`, `Estado: ${feData?.ind_estado || feData?.estado || "-"}`,
      feData?.emisor?.nombre   ? `Emisor: ${feData.emisor.nombre}`    : "",
      feData?.receptor?.nombre ? `Receptor: ${feData.receptor.nombre}` : "",
      feData?.totalComprobante ? `Total: ₡${Number(feData.totalComprobante).toLocaleString("es-CR", { minimumFractionDigits: 2 })}` : "",
    ].filter(Boolean).join("\n")
  }

  /* ─── EXONERACIONES ─── */
  const [exoQ,       setExoQ]       = useState("")
  const [exoTipo,    setExoTipo]    = useState("01") // 01=física, 02=jurídica, 03=DIMEX, 04=NITE
  const [exoData,    setExoData]    = useState(null)
  const [exoLoading, setExoLoading] = useState(false)
  const [exoError,   setExoError]   = useState("")
  const [exoSearched,setExoSearched]= useState(false)

  const consultarExo = useCallback(async () => {
    const num = onlyDigits(exoQ); if (!num) return
    setExoLoading(true); setExoError(""); setExoSearched(true); setExoData(null)
    try {
      const res = await fetch(`/hacienda/fe/exoneraciones?tipoDocumento=${exoTipo}&numDocumento=${num}`, { cache: "no-store" })
      if (res.status === 404) { setExoData([]); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setExoData(Array.isArray(json) ? json : json.exoneraciones || json.data || [json])
      logActivity("exoneraciones", num)
    } catch (e) { setExoError(e?.message || "Error consultando exoneraciones") }
    finally { setExoLoading(false) }
  }, [exoQ, exoTipo, logActivity])

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className={`layout${sideCollapsed ? " sideCollapsed" : ""}`}>
      {sideOpen && <div className="sideOverlay" onClick={() => setSideOpen(false)} />}

      {/* ── COMMAND PALETTE ── */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)}
        activities={activities} navigate={navigate}
        setCabysQ={setCabysQ} consultarCabysRef={consultarCabysRef}
        setAeId={setAeId} consultarAE={consultarAE}
        setCedQ={setCedQ} consultarCed={consultarCed} />

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar${sideOpen ? " sideOpen" : ""}`}>
        <div className="sideTop">
          <div className="sideBrand">
            <div className="sideLogo">{IC.bolt}</div>
            <span className="sideName">HaciendaKit</span>
          </div>
        </div>

        <nav className="sideNav">
          {NAV_GROUPS.map((g, gi) => (
            <div key={gi} className="navGroup">
              {g.label && <div className="navGroupLabel">{g.label}</div>}
              {g.items.map(id => {
                const n = NAV_MAP[id]; if (!n) return null
                return (
                  <button key={n.id} type="button"
                    className={`navItem${page === n.id ? " navActive" : ""}`}
                    title={n.label}
                    onClick={() => navigate(n.id)}>
                    <span className="navIcon">{n.icon}</span>
                    <span className="navLabel">{n.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sideBottom">
          <button type="button" className="cmdTriggerBtn" onClick={() => setCmdOpen(true)}>
            {IC.search}
            <span className="cmdTriggerLabel">Búsqueda rápida</span>
          </button>
          <button type="button" className="sideCollapseBtn" onClick={() => setSideCollapsed(c => !c)}>
            {sideCollapsed ? IC.expandRight : IC.collapseLeft}
            <span className="collapseBtnLabel">Colapsar</span>
          </button>
          <div className={`apiPill${apiStatus == null ? "" : apiStatus.ok ? " apiPillOk" : " apiPillBad"}`}>
            <span className={`dot${apiStatus?.ok ? " ok" : apiStatus == null ? " loading" : " bad"}`} />
            <span className="apiPillText">{apiStatus == null ? "…" : apiStatus.ok ? `Hacienda · ${apiStatus.ms}ms` : "Sin respuesta"}</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="mainArea">
        <header className="topbar">
          <button className="menuBtn" type="button" onClick={() => setSideOpen(s => !s)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 4.5h14M2 9h14M2 13.5h14"/></svg>
          </button>

          <div className="topbarBread">
            <span className="topbarApp">HaciendaKit</span>
            <span className="topbarSep">/</span>
            <span className="topbarPage">{NAV_MAP[page]?.label}</span>
          </div>

          {/* Buscador tipo pill que abre Command Palette */}
          <button type="button" className="topbarCmdBtn" onClick={() => setCmdOpen(true)}>
            <span className="topbarCmdIcon">{IC.search}</span>
            <span className="topbarCmdPlaceholder">Buscar…</span>
          </button>

          <div className="topbarRight">
            <span className={`apiDot${apiStatus?.ok ? " apiDotOk" : apiStatus == null ? "" : " apiDotBad"}`}
              title={apiStatus?.ok ? `Hacienda ${apiStatus.ms}ms` : "Sin respuesta"} />
            {fx && (
              <div className="topbarFx" onClick={() => navigate("tipocambio")} style={{ cursor: "pointer" }}>
                <span className="topbarFxLabel">USD</span>
                <span className="topbarFxVal">₡{fx.venta.toLocaleString("es-CR")}</span>
              </div>
            )}
            {fxEur && (
              <div className="topbarFx topbarFxEur" onClick={() => navigate("tipocambio")} style={{ cursor: "pointer" }}>
                <span className="topbarFxLabel">EUR</span>
                <span className="topbarFxVal">₡{fxEur.colones.toLocaleString("es-CR")}</span>
              </div>
            )}
          </div>
        </header>

        <main className="content">

          {/* ══ INICIO — Spotlight ══ */}
          {page === "home" && (
            <div className="spotlightWrap">
              <div className="spotlightHero">
                <div className="spotlightGreeting">{saludo()}</div>
                <h1 className="spotlightTitle">¿Qué deseas consultar?</h1>
                <button type="button" className="spotlightSearchBox" onClick={() => setCmdOpen(true)}>
                  <span className="spotlightSearchIcon">{IC.search}</span>
                  <span className="spotlightSearchText">Buscá empresa, CABYS, factura electrónica…</span>
                </button>
                {fx && (
                  <div className="spotlightFx">
                    <span>USD · Compra <strong>₡{fx.compra.toLocaleString("es-CR")}</strong></span>
                    <span className="spotlightFxSep">·</span>
                    <span>Venta <strong>₡{fx.venta.toLocaleString("es-CR")}</strong></span>
                  </div>
                )}
              </div>

              <div className="spotlightQuickGrid">
                {[
                  { id:"cabys",        emoji:"⚡", label:"Asistente CABYS",    desc:"Encontrá el código correcto" },
                  { id:"contribuyente",emoji:"🏢", label:"Verificar empresa",   desc:"Estado fiscal y actividades" },
                  { id:"factura",      emoji:"📋", label:"Validar factura",     desc:"Comprobantes electrónicos" },
                  { id:"tipocambio",   emoji:"💱", label:"Tipo de cambio",      desc:"USD/CRC del BCCR" },
                ].map(q => (
                  <button key={q.id} type="button" className="spotlightQuickBtn" onClick={() => navigate(q.id)}>
                    <span className="spotlightQuickEmoji">{q.emoji}</span>
                    <div>
                      <div className="spotlightQuickLabel">{q.label}</div>
                      <div className="spotlightQuickDesc">{q.desc}</div>
                    </div>
                    <span className="spotlightQuickArrow">{IC.arrowRight}</span>
                  </button>
                ))}
              </div>

            </div>
          )}

          {/* ══ ASISTENTE CABYS ══ */}
          {page === "cabys" && (
            <div className="pageWrap pageCentered" style={{ maxWidth: 960 }}>
              {/* Favoritos */}
              {cabysF_avs.length > 0 && !cabysSearched && (
                <div className="favSection">
                  <div className="favSectionTitle">{IC.star} Favoritos guardados</div>
                  <div className="cabysGrid">
                    {cabysF_avs.map(item => (
                      <CabysCard key={item.codigo} item={item} score={null}
                        fl={fl} flash={flash} favs={cabysF_avs} onToggleFav={toggleFav} />
                    ))}
                  </div>
                </div>
              )}

              <div className="assistantHero">
                <h1 className="assistantTitle">Asistente CABYS</h1>
                <p className="assistantSub">Describí tu actividad, producto o giro de negocio</p>

                {/* Modo selector */}
                <div className="cabysModeRow">
                  <button type="button"
                    className={`cabysModeBtn${cabysMode === "libre" ? " active" : ""}`}
                    onClick={() => setCabysMode("libre")}>
                    🔍 Búsqueda libre
                  </button>
                  <button type="button"
                    className={`cabysModeBtn${cabysMode === "ae" ? " active" : ""}`}
                    onClick={() => setCabysMode("ae")}>
                    🏢 Mi actividad económica
                  </button>
                </div>

                {cabysMode === "libre" ? (
                  <>
                    <div className="assistantSearchWrap">
                      <input className="assistantSearchInput" value={cabysQ}
                        placeholder="Ej: vendo ropa en tienda, servicios contables, arroz blanco…"
                        onChange={e => { setCabysQ(e.target.value); setCabysPage(0) }}
                        onKeyDown={e => { if (e.key === "Enter") consultarCabys({ reset: true }) }} />
                      <button className="assistantSearchBtn" onClick={() => consultarCabys({ reset: true })}
                        disabled={!cabysQ_.length || cabysLoading} type="button">
                        {cabysLoading ? "Buscando…" : "Buscar"}
                      </button>
                    </div>
                    <div className="quickChipsRow">
                      {CABYS_SUGERENCIAS.map(s => (
                        <button key={s.q} type="button" className="quickChip"
                          onClick={() => { setCabysQ(s.q); setCabysPage(0); consultarCabys({ reset: true, q: s.q }) }}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="aeSearchBlock">
                    <p className="aeSearchHint">Escribí la descripción de tu actividad económica tal como aparece en Hacienda — el sistema extraerá los términos clave y buscará los códigos CABYS más relevantes.</p>
                    <div className="assistantSearchWrap">
                      <input className="assistantSearchInput" value={aeDesc}
                        placeholder="Ej: Actividades de restaurantes y de servicio móvil de comidas"
                        onChange={e => setAeDesc(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") consultarCabysAe() }} />
                      <button className="assistantSearchBtn" onClick={consultarCabysAe}
                        disabled={!aeDesc.trim() || cabysLoading} type="button">
                        {cabysLoading ? "Buscando…" : "Sugerir CABYS"}
                      </button>
                    </div>
                    {aeDesc.trim() && (
                      <p className="aeTermsPreview">
                        Términos clave: <strong>{extractAeTerms(aeDesc) || "—"}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>


              {cabysNorm && (
                <div className="cabysNormHint">
                  {IC.search} Buscando con tildes: <strong>{cabysNorm}</strong>
                </div>
              )}

              {cabysAeMatch && cabysSearched && (
                <div className="aeMatchBanner">
                  <span className="aeMatchLabel">AE relacionada:</span>
                  <span className="aeMatchCiiu">{cabysAeMatch.ciiu}</span>
                  <span className="aeMatchName">{cabysAeMatch.label}</span>
                </div>
              )}

              {cabysError && <div className="alertBox" style={{ marginTop: 16 }}>{IC.warning} {cabysError}</div>}
              {cabysSearched && !cabysLoading && !cabysError && !cabysTotal && (
                <EmptyState msg={`Sin resultados para "${cabysQ_}" — intentá con términos más generales`} />
              )}

              {cabysTotal > 0 && (
                <>
                  <div className="resultsHeader" style={{ marginTop: 20 }}>
                    <span className="resultsHeaderText">
                      <strong>{cabysTotal}</strong> resultado{cabysTotal !== 1 ? "s" : ""} para "<strong>{cabysNorm || cabysQ_}</strong>"
                    </span>
                    <div className="resultsHeaderActions">
                      <div className="viewModeToggle">
                        <button type="button" className={`viewModeBtn${cabysView === "cards" ? " active" : ""}`}
                          onClick={() => setCabysView("cards")}>{IC.grid}</button>
                        <button type="button" className={`viewModeBtn${cabysView === "table" ? " active" : ""}`}
                          onClick={() => setCabysView("table")}>{IC.table}</button>
                      </div>
                      <CopyBtn id="cabys-csv" label="CSV" fl={fl} flash={flash}
                        getText={() => toCsv(cabysRows.map(c => [c.codigo, c.descripcion, `${c.impuesto}%`]), ["codigo", "descripcion", "impuesto"])}
                        disabled={!cabysRows.length} />
                      <button className="btn btnGhost" onClick={() => {
                        if (!cabysRows.length) return
                        downloadXlsx("cabys.xlsx", "CABYS", cabysRows.map(c => ({ codigo: c.codigo, descripcion: c.descripcion, impuesto: `${c.impuesto}%` })), ["codigo", "descripcion", "impuesto"])
                      }} type="button">XLSX</button>
                    </div>
                  </div>

                  {/* Results — cards or table */}
                  {cabysView === "cards" ? (
                    <div className="cabysGrid">
                      {cabysRows.map(c => (
                        <CabysCard key={c.codigo} item={c}
                          score={cabysQ_ ? scoreMatch(cabysNorm || cabysQ_, c.descripcion) : null}
                          fl={fl} flash={flash} favs={cabysF_avs} onToggleFav={toggleFav} />
                      ))}
                    </div>
                  ) : (
                    <div className="tableWrap">
                      <div className="tableToolbar">
                        <span className="tableToolbarLeft">{cabysTotal} resultado{cabysTotal !== 1 ? "s" : ""}</span>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <SortableTH col="codigo" sort={cabysSort} onSort={handleCabysSort}>Código</SortableTH>
                            <SortableTH col="descripcion" sort={cabysSort} onSort={handleCabysSort}>Descripción</SortableTH>
                            <SortableTH col="impuesto" sort={cabysSort} onSort={handleCabysSort}>Impuesto</SortableTH>
                            <th className="thR">Copiar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cabysRows.map(c => (
                            <tr key={c.codigo}>
                              <td className="mono">{c.codigo}</td>
                              <td>{c.descripcion}</td>
                              <td><span className={`taxBadgeV2 ${taxClass(c.impuesto)}`}>{c.impuesto}%</span></td>
                              <td className="thR">
                                <button className={`iconBtn${fl === `cc-${c.codigo}` ? " flashed" : ""}`} type="button"
                                  onClick={() => flash(`cc-${c.codigo}`, String(c.codigo || ""))}>
                                  {fl === `cc-${c.codigo}` ? "✓" : "📋"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination */}
                  <div className="pager">
                    <button className="btn btnGhost btnSm" disabled={cabysPage === 0}
                      onClick={() => setCabysPage(p => Math.max(0, p - 1))} type="button">{IC.chevronLeft}</button>
                    <span className="muted">Pág. {cabysPage + 1} · {Math.min(cabysEnd, cabysTotal)} de {cabysTotal}</span>
                    <button className="btn btnGhost btnSm" disabled={!cabysHasNext}
                      onClick={cabysNext} type="button">{IC.chevronRight}</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ CONTRIBUYENTE ══ */}
          {page === "contribuyente" && (
            <div className="pageWrap pageCentered">
              <PageHeader icon={IC.user} title="Verificar Contribuyente"
                description="Consultá el estado fiscal, régimen y actividades económicas. Desde una actividad podés buscar sus códigos CABYS directamente." />
              <div className="toolCard">
                <div className="toolSection">
                  <label className="lbl">Cédula, NITE o número de identificación</label>
                  <div className="inputRow">
                    <input className="inp" value={aeId} inputMode="numeric" placeholder="9, 10 u 11 dígitos"
                      onChange={e => setAeId(onlyDigits(e.target.value))}
                      onKeyDown={e => { if (e.key === "Enter") consultarAE() }} />
                    <button className="btn btnPrimary" onClick={() => consultarAE()} disabled={!aeValid || aeLoading} type="button">
                      {aeLoading ? "Consultando…" : "Consultar"}
                    </button>
                  </div>
                  {!aeValid && aeId.length > 0 && <div className="hintBad">Debe tener 9, 10 u 11 dígitos.</div>}
                </div>
              </div>

              {aeError && <div className="alertBox">{IC.warning} {aeError}</div>}
              {aeSearched && !aeLoading && !aeError && !aeData && (
                <EmptyState msg={`No se encontró contribuyente para "${aeDigits}"`} />
              )}

              {aeData && (
                <FichaContribuyente
                  data={aeData}
                  aeJsonId={aeJsonId}
                  onBuscarCabys={navigateToCabys}
                  fl={fl} flash={flash}
                  aeResumen={aeResumen}
                  aeActCsv={aeActCsv}
                  downloadActs={() => {
                    if (!aeData?.actividades?.length) return
                    downloadXlsx("actividades_ae.xlsx", "Actividades",
                      aeData.actividades.map(a => ({ codigo: a.codigo, descripcion: a.descripcion, tipo: a.tipo === "P" ? "Principal" : "Secundaria", estado: a.estado === "A" ? "Activa" : "Inactiva" })),
                      ["codigo", "descripcion", "tipo", "estado"])
                  }}
                />
              )}
            </div>
          )}

          {/* ══ CÉDULAS TSE ══ */}
          {page === "cedulas" && (
            <div className="pageWrap pageCentered">
              <PageHeader icon={IC.id} title="Búsqueda de Cédulas TSE"
                description="Personas físicas y jurídicas registradas en el Tribunal Supremo de Elecciones." />
              <div className="toolCard">
                <div className="toolSection">
                  <label className="lbl">Número de cédula o nombre</label>
                  <div className="inputRow">
                    <input className="inp" value={cedQ} placeholder="Ej: 116740278 o Juan Pérez García"
                      onChange={e => setCedQ(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") consultarCed() }} />
                    <button className="btn btnPrimary" onClick={() => consultarCed()} disabled={!cedQ_.length || cedLoading} type="button">
                      {cedLoading ? "Buscando…" : "Buscar"}
                    </button>
                  </div>
                </div>

                {cedItems.length > 0 && (
                  <div className="toolActions">
                    <button className="btn btnGhost" onClick={() => downloadXlsx("cedulas_tse.xlsx", "Cedulas",
                      cedItems.map(x => ({ cedula: x.cedula, nombre: x.nombre, tipo: x.tipo })), ["cedula", "nombre", "tipo"])} type="button">
                      Descargar XLSX
                    </button>
                  </div>
                )}

                {cedError && <div className="alertBox">{IC.warning} {cedError}</div>}
                {cedSearched && !cedLoading && !cedError && !cedItems.length && <EmptyState msg={`Sin resultados para "${cedQ_}"`} />}

                {cedItems.length > 0 && (
                  <div className="tableWrap">
                    <div className="tableToolbar">
                      <span className="tableToolbarLeft">{cedItems.length} resultado{cedItems.length !== 1 ? "s" : ""}</span>
                    </div>
                    <table>
                      <thead><tr><th>Cédula</th><th>Nombre</th><th>Tipo</th><th className="thR">Copiar</th></tr></thead>
                      <tbody>
                        {cedItems.map(x => (
                          <tr key={x.id}>
                            <td className="mono">{x.cedula}</td>
                            <td>{x.nombre}</td>
                            <td className="mono">{x.tipo}</td>
                            <td className="thR">
                              <button className={`iconBtn${fl === `ced-${x.id}` ? " flashed" : ""}`} type="button"
                                onClick={() => flash(`ced-${x.id}`, String(x.cedula || ""))}>
                                {fl === `ced-${x.id}` ? "✓" : "📋"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ TIPO DE CAMBIO ══ */}
          {page === "tipocambio" && (
            <div className="pageWrap pageCentered">
              <PageHeader icon={IC.currency} title="Tipo de Cambio"
                description="Tipo de cambio del Banco Central de Costa Rica — dólar y euro, actual, histórico y conversor." />

              <div className="sectionBlock">
                <div className="sectionTitle">Actual</div>
                <div className="tcCurrencyGrid">
                  {/* USD */}
                  <div className="tcCurrencyBlock">
                    <div className="tcCurrencyLabel">
                      <span className="tcCurrencyFlag">🇺🇸</span>
                      <span className="tcCurrencyName">Dólar <span className="tcCurrencyCode">USD</span></span>
                    </div>
                    <div className="tcActualGrid">
                      <div className="tcActualCard">
                        <div className="lbl">Compra</div>
                        <div className="tcActualVal">{fxLoading ? "…" : fx ? `₡${fx.compra.toLocaleString("es-CR")}` : "—"}</div>
                      </div>
                      <div className="tcActualCard">
                        <div className="lbl">Venta</div>
                        <div className="tcActualVal">{fxLoading ? "…" : fx ? `₡${fx.venta.toLocaleString("es-CR")}` : "—"}</div>
                      </div>
                    </div>
                  </div>
                  {/* EUR */}
                  <div className="tcCurrencyBlock tcCurrencyBlockEur">
                    <div className="tcCurrencyLabel">
                      <span className="tcCurrencyFlag">🇪🇺</span>
                      <span className="tcCurrencyName">Euro <span className="tcCurrencyCode">EUR</span></span>
                    </div>
                    <div className="tcActualGrid" style={{ gridTemplateColumns: "1fr" }}>
                      <div className="tcActualCard">
                        <div className="lbl">Tipo de cambio referencia</div>
                        <div className="tcActualVal">{fxLoading ? "…" : fxEur ? `₡${fxEur.colones.toLocaleString("es-CR")}` : "—"}</div>
                        {fxEur && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Publicado {formatFechaCR(fxEur.fecha)}</div>}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{fx ? formatFechaCR(fx.fecha) : ""}</div>
                  <button className="btn btnGhost btnSm" onClick={fetchFx} type="button">{IC.refresh} Actualizar</button>
                </div>
              </div>

              {fx && (
                <div className="sectionBlock">
                  <div className="sectionTitle">Conversor</div>
                  <ConversorUI fx={fx} fxInput={fxInput} setFxInput={setFxInput} fxDir={fxDir} setFxDir={setFxDir} fxResult={fxResult} />
                </div>
              )}

              <div className="sectionBlock">
                <div className="sectionTitle">Histórico por fecha</div>
                <div className="toolCard">
                  <div className="toolSection">
                    <label className="lbl">Fecha</label>
                    <div className="inputRow">
                      <input className="inp" type="date" value={tcFecha} max={todayStr}
                        onChange={e => setTcFecha(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") consultarTc() }} />
                      <button className="btn btnPrimary" onClick={consultarTc} disabled={!tcFecha || tcLoading} type="button">
                        {tcLoading ? "Consultando…" : "Consultar"}
                      </button>
                      {tcData && <CopyBtn id="tc-hist" label="Copiar" fl={fl} flash={flash} disabled={false}
                        getText={() => { const [y, m, d] = tcData.fecha.split("-"); return `TC BCCR ${d}/${m}/${y}\nUSD Compra: ₡${tcData.compra.toLocaleString("es-CR")}\nUSD Venta: ₡${tcData.venta.toLocaleString("es-CR")}` }} />}
                    </div>
                  </div>
                  {tcError && <div className="alertBox">{IC.warning} {tcError}</div>}
                  {tcSearched && !tcLoading && !tcError && !tcData && <EmptyState msg="Sin datos para esa fecha" />}
                  {tcData && (
                    <div className="tcHistBox">
                      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                        {(() => { const [y, m, d] = tcData.fecha.split("-"); return `${d}/${m}/${y}` })()}
                      </div>
                      <div className="tcHistRow">
                        <div className="tcHistCell"><div className="lbl">Compra</div><div className="tcHistVal">₡{tcData.compra.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div></div>
                        <div className="tcHistDivider" />
                        <div className="tcHistCell"><div className="lbl">Venta</div><div className="tcHistVal">₡{tcData.venta.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div></div>
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Fuente: Banco Central de Costa Rica</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ FACTURA ══ */}
          {page === "factura" && (
            <div className="pageWrap pageCentered">
              <PageHeader icon={IC.receipt} title="Validación de Factura Electrónica"
                description="Verificá si un comprobante fue aceptado o rechazado por Hacienda. Ingresá los 50 dígitos de la clave." />
              <div className="toolCard">
                <div className="toolSection">
                  <label className="lbl">Clave numérica del comprobante (50 dígitos)</label>
                  <div className="inputRow">
                    <input className="inp" value={feKey} inputMode="numeric" maxLength={50}
                      placeholder="50 dígitos — ej: 50623011800310…"
                      onChange={e => setFeKey(onlyDigits(e.target.value))}
                      onKeyDown={e => { if (e.key === "Enter") consultarFe() }} />
                    <button className="btn btnPrimary" onClick={consultarFe} disabled={!feValid || feLoading} type="button">
                      {feLoading ? "Verificando…" : "Verificar"}
                    </button>
                  </div>
                  <div className={`keyCounter${feValid ? " keyOk" : ""}`}>{feClean.length}/50{feClean.length > 0 && !feValid ? " — faltan dígitos" : ""}</div>
                </div>
                {feData && <div className="toolActions"><CopyBtn id="fe-res" label="Copiar resultado" fl={fl} flash={flash} getText={feResumen} disabled={!feData} /></div>}
                {feError && <div className="alertBox">{IC.warning} {feError}</div>}

                {feValid && feDecoded && (
                  <div className="feDecodedBox">
                    <div className="feDecodedTitle">Información de la clave</div>
                    <div className="feDecodedGrid">
                      <div className="feField"><div className="lbl">Tipo</div><div className="feVal">{feDecoded.tipo}</div></div>
                      <div className="feField"><div className="lbl">Fecha emisión</div><div className="feVal">{feDecoded.fecha}</div></div>
                      <div className="feField"><div className="lbl">Cédula emisor</div><div className="feVal mono">{feDecoded.cedula}</div></div>
                      <div className="feField"><div className="lbl">Terminal</div><div className="feVal mono">{feDecoded.terminal}</div></div>
                      <div className="feField"><div className="lbl">Situación</div><div className="feVal">{feDecoded.situacion}</div></div>
                      <div className="feField"><div className="lbl">Cód. seguridad</div><div className="feVal mono">{feDecoded.seguridad}</div></div>
                    </div>
                    {feDecoded.cedula && (
                      <button type="button" className="btn btnGhost btnSm" style={{ marginTop: 12 }}
                        onClick={() => { setAeId(feDecoded.cedula); navigate("contribuyente"); setTimeout(() => consultarAE(feDecoded.cedula), 50) }}>
                        {IC.user} Verificar emisor como contribuyente →
                      </button>
                    )}
                  </div>
                )}

                {feNotFound && (
                  <div className="feNotFound">
                    <div className="feNotFoundIcon">{IC.warning}</div>
                    <div>
                      <div className="feNotFoundTitle">No disponible en la API pública de Hacienda</div>
                      <div className="feNotFoundDesc">La API pública no indexa todos los comprobantes. La información decodificada arriba sí corresponde a esta clave. Para verificar el estado oficial:</div>
                      <div className="feNotFoundLinks">
                        <a href="https://atv.hacienda.go.cr/ATV/frmConsultaFactura.aspx" target="_blank" rel="noopener noreferrer" className="feExternalBtn feExternalBtnPrimary">ATV Hacienda (sin login) ↗</a>
                        <a href="https://verificatufactura.com/verificacion-simple" target="_blank" rel="noopener noreferrer" className="feExternalBtn">VerificaTuFactura.com ↗</a>
                      </div>
                    </div>
                  </div>
                )}

                {feData && (
                  <div className="feBox">
                    {(feData?.ind_estado || feData?.estado) && (
                      <div className="feEstado">
                        <span className={`feEstadoBadge ${(feData?.ind_estado || feData?.estado || "").toUpperCase().includes("ACEPT") ? "feAceptado" : "feRechazado"}`}>
                          {feData?.ind_estado || feData?.estado}
                        </span>
                      </div>
                    )}
                    <div className="feGrid">
                      {feData?.emisor?.nombre   && <div className="feField"><div className="lbl">Emisor</div><div className="feVal">{feData.emisor.nombre}</div></div>}
                      {feData?.receptor?.nombre && <div className="feField"><div className="lbl">Receptor</div><div className="feVal">{feData.receptor.nombre}</div></div>}
                      {feData?.fecha            && <div className="feField"><div className="lbl">Fecha</div><div className="feVal">{formatFechaCR(feData.fecha)}</div></div>}
                      {feData?.totalComprobante && <div className="feField"><div className="lbl">Total</div><div className="feVal mono">₡{Number(feData.totalComprobante).toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div></div>}
                    </div>
                    {!feData?.emisor && !feData?.estado && !feData?.ind_estado && <pre className="feRaw">{JSON.stringify(feData, null, 2)}</pre>}
                  </div>
                )}

                <div className="infoBox">
                  <div className="infoTitle">¿Cómo encontrar la clave?</div>
                  <div className="infoText">La clave de 50 dígitos aparece en el PDF de tu factura bajo "Clave" o "Número de clave".</div>
                </div>
              </div>
            </div>
          )}

          {/* ══ EXONERACIONES ══ */}
          {page === "exoneraciones" && (
            <div className="pageWrap pageCentered" style={{ maxWidth: 760 }}>
              <PageHeader icon={IC.shield} title="Exoneraciones" subtitle="Verificá si una entidad tiene exoneración de impuestos registrada en Hacienda" />

              <div className="toolCard">
                <div className="toolRow">
                  <div className="toolField" style={{ flex: "0 0 160px" }}>
                    <label className="lbl">Tipo de documento</label>
                    <select className="inp" value={exoTipo} onChange={e => setExoTipo(e.target.value)}>
                      <option value="01">Cédula física (01)</option>
                      <option value="02">Cédula jurídica (02)</option>
                      <option value="03">DIMEX (03)</option>
                      <option value="04">NITE (04)</option>
                    </select>
                  </div>
                  <div className="toolField" style={{ flex: 1 }}>
                    <label className="lbl">Número de documento</label>
                    <input className="inp mono" value={exoQ} placeholder="Ej: 106780456"
                      onChange={e => setExoQ(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") consultarExo() }} />
                  </div>
                </div>
                <div className="toolActions">
                  <button className="btn btnPrimary" onClick={consultarExo}
                    disabled={!onlyDigits(exoQ).length || exoLoading} type="button">
                    {exoLoading ? "Consultando…" : "Verificar exoneraciones"}
                  </button>
                </div>

                {exoError && <div className="alertBox" style={{ marginTop: 16 }}>{IC.warning} {exoError}</div>}

                {exoSearched && !exoLoading && !exoError && exoData !== null && exoData.length === 0 && (
                  <div className="exoEmpty">
                    <div className="exoEmptyIcon">{IC.shield}</div>
                    <div className="exoEmptyTitle">Sin exoneraciones registradas</div>
                    <div className="exoEmptyDesc">Este contribuyente no tiene exoneraciones activas en Hacienda.</div>
                  </div>
                )}

                {exoData && exoData.length > 0 && (
                  <div className="exoResults">
                    <div className="exoResultsTitle">{exoData.length} exoneración{exoData.length !== 1 ? "es" : ""} encontrada{exoData.length !== 1 ? "s" : ""}</div>
                    {exoData.map((ex, i) => (
                      <div key={i} className="exoCard">
                        {ex.nombreContribuyente && <div className="exoCardName">{ex.nombreContribuyente}</div>}
                        <div className="exoCardGrid">
                          {ex.tipoExoneracion  && <div className="exoField"><span className="lbl">Tipo</span><span>{ex.tipoExoneracion}</span></div>}
                          {ex.porcentajeExoneracion != null && <div className="exoField"><span className="lbl">Porcentaje</span><span className="exoBadge">{ex.porcentajeExoneracion}%</span></div>}
                          {ex.fechaInicio       && <div className="exoField"><span className="lbl">Inicio</span><span>{ex.fechaInicio}</span></div>}
                          {ex.fechaFin          && <div className="exoField"><span className="lbl">Vencimiento</span><span>{ex.fechaFin}</span></div>}
                          {ex.estado            && <div className="exoField"><span className="lbl">Estado</span><span className={`exoEstadoBadge ${(ex.estado||"").toUpperCase() === "ACTIVO" ? "exoActivo" : "exoInactivo"}`}>{ex.estado}</span></div>}
                          {ex.numDocumento      && <div className="exoField"><span className="lbl">Documento</span><span className="mono">{ex.numDocumento}</span></div>}
                        </div>
                        {/* Mostrar campos adicionales no mapeados */}
                        {Object.keys(ex).filter(k => !["nombreContribuyente","tipoExoneracion","porcentajeExoneracion","fechaInicio","fechaFin","estado","numDocumento"].includes(k)).map(k => (
                          <div key={k} className="exoField"><span className="lbl">{k}</span><span>{String(ex[k])}</span></div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>

        <footer className="footerBar">
          Datos: Ministerio de Hacienda · BCCR · TSE · Gometa
        </footer>
      </div>
    </div>
  )
}

/* ─── Conversor component ─── */
function ConversorUI({ fx, fxInput, setFxInput, fxDir, setFxDir, fxResult }) {
  return (
    <div className="toolCard">
      <div className="conversorRow">
        <div className="conversorInputWrap">
          <span className="conversorPrefix">{fxDir === "usd2crc" ? "$" : "₡"}</span>
          <input className="conversorInput" type="number" min="0" placeholder="0.00"
            value={fxInput} onChange={e => setFxInput(e.target.value)} />
        </div>
        <button className="conversorSwap" type="button" onClick={() => { setFxDir(d => d === "usd2crc" ? "crc2usd" : "usd2crc"); setFxInput("") }}>⇄</button>
        <div className="conversorResult">
          {fxResult !== null
            ? <><span className="conversorPrefix">{fxDir === "usd2crc" ? "₡" : "$"}</span><span className="conversorValue">{fxResult}</span></>
            : <span className="muted">{fxDir === "usd2crc" ? "₡ —" : "$ —"}</span>}
        </div>
      </div>
      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        {fxDir === "usd2crc" ? `Usando tipo de cambio venta ₡${fx.venta.toLocaleString("es-CR")}` : `Usando tipo de cambio compra ₡${fx.compra.toLocaleString("es-CR")}`}
      </div>
    </div>
  )
}
