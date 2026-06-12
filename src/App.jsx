import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import "./App.css"

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
async function checkApiStatus() {
  const start = performance.now()
  const res = await fetch("/hacienda/fe/cabys?q=sal&top=1", { cache: "no-store" })
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
function isValidAeId(s) { const v = onlyDigits(s); return v.length >= 9 && v.length <= 12 }
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
  try { await navigator.clipboard.writeText(text); return true } catch (_e) { /* fallback */ }
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

/* ─── Historial localStorage ─── */
const H = 5
const loadH = k => { try { return JSON.parse(localStorage.getItem(k) || "[]") } catch { return [] } }
const saveH = (k, v) => { if (!v?.trim()) return; const p = loadH(k); localStorage.setItem(k, JSON.stringify([v, ...p.filter(x => x !== v)].slice(0, H))) }

/* ─── Home Favoritos ─── */
const HOME_FAVS_KEY = "hk_home_favs"
const HOME_FAVS_DEFAULT = [
  { id: "dev-sw",   label: "Desarrollo software",     type: "cabys", query: "desarrollo software programacion" },
  { id: "srv-prof", label: "Servicios profesionales",  type: "cabys", query: "servicios profesionales consultoria" },
  { id: "rest",     label: "Restaurante / Soda",       type: "cabys", query: "restaurante soda comidas alimentacion" },
]
const loadHomeFavs = () => { try { const s = JSON.parse(localStorage.getItem(HOME_FAVS_KEY)); return s?.length ? s : HOME_FAVS_DEFAULT } catch { return HOME_FAVS_DEFAULT } }
const saveHomeFavs = (f) => localStorage.setItem(HOME_FAVS_KEY, JSON.stringify(f))

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
  info:         <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="9" r="7.5"/><path d="M9 8.5v4.5"/><circle cx="9" cy="6" r=".7" fill="currentColor" stroke="none"/></svg>,
  arrowRight:   <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m5 2 5 4-5 4M2 6h8"/></svg>,
  x:            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m3 3 8 8M11 3 3 11"/></svg>,
  bot:          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="12" height="9" rx="2"/><path d="M6 7V5a3 3 0 016 0v2M6 11.5h.01M12 11.5h.01M1 11h2M15 11h2M9 2v2"/></svg>,
  send:         <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2L2 7.5l5 1.5L9 14l5-12z"/></svg>,
  upload:       <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M8 10V3M5 6l3-3 3 3"/><path d="M3 13h10"/></svg>,
  chat:         <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h14a1 1 0 011 1v9a1 1 0 01-1 1H5l-3 2V4a1 1 0 011-1z"/></svg>,
  xml:          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l-3 3 3 3M14 6l3 3-3 3M11 3L7 15"/></svg>,
}

const ACT_ICONS  = { cabys: IC.search, contribuyente: IC.user, factura: IC.receipt, tipocambio: IC.currency, exoneraciones: IC.shield }
const ACT_LABELS = { cabys: "CABYS", contribuyente: "Contribuyente", factura: "Factura", tipocambio: "Tipo de Cambio", exoneraciones: "Exoneraciones" }

/* ─── Hub cards config ─── */
const HUB_CARDS = [
  { id: "factura",        icon: IC.xml,      color: "violet",  title: "Validador XML",               desc: "Cargá un comprobante XML y revisá líneas, CABYS, IVA e inconsistencias" },
  { id: "cabys",          icon: IC.search,   color: "blue",    title: "Asistente CABYS",         desc: "Encontrá el código correcto para tus productos y servicios" },
  { id: "contribuyente",  icon: IC.user,     color: "green",   title: "Verificar Contribuyente", desc: "Estado fiscal, régimen y actividades económicas de cualquier contribuyente" },
  { id: "exoneraciones",  icon: IC.shield,   color: "purple",  title: "Exoneraciones",           desc: "Verificá si una entidad tiene exoneración de impuestos en Hacienda" },
  { id: "tipocambio",     icon: IC.currency, color: "slate",   title: "Tipo de Cambio",          desc: "BCCR en tiempo real, histórico y conversor USD/CRC" },
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

/* ─── XML FE parser (DOMParser, sin librerías) ─── */
function parseXmlFe(xmlStr) {
  const dp = new DOMParser()
  const doc = dp.parseFromString(xmlStr, "application/xml")
  const err = doc.querySelector("parsererror")
  if (err) throw new Error("XML inválido: " + err.textContent.slice(0, 120))
  const get = (sel) => doc.querySelector(sel)?.textContent?.trim() || ""
  const rootTag = doc.documentElement.localName
  const clave         = get("Clave")
  const numConsecutivo= get("NumeroConsecutivo")
  const fecha         = get("FechaEmision")
  const emisor = {
    nombre:    get("Emisor > Nombre"),
    comercial: get("Emisor > NombreComercial"),
    cedula:    get("Emisor > Identificacion > Numero"),
    tipoCed:   get("Emisor > Identificacion > Tipo"),
    correo:    get("Emisor > CorreoElectronico"),
  }
  const receptor = {
    nombre: get("Receptor > Nombre"),
    cedula: get("Receptor > Identificacion > Numero"),
    correo: get("Receptor > CorreoElectronico"),
  }
  // Schema v4.4: CodigoTipoMoneda > CodigoMoneda; versiones anteriores usan Codigo
  const moneda    = get("CodigoTipoMoneda > CodigoMoneda") || get("CodigoTipoMoneda > Codigo") || get("CodigoMoneda") || "CRC"
  const tipoCambio= get("CodigoTipoMoneda > TipoCambio") || get("TipoCambio") || ""
  const resumen = {
    total:          get("TotalComprobante"),
    totalImpuesto:  get("TotalImpuesto") || get("TotalImpuestoVenta"),
    totalVenta:     get("TotalVentaNeta") || get("TotalVenta"),
    totalDesc:      get("TotalDescuentos"),
    moneda, tipoCambio,
  }
  const lines = [...doc.querySelectorAll("LineaDetalle")].map(el => {
    const g = sel => el.querySelector(sel)?.textContent?.trim() || ""
    return {
      descripcion: g("Detalle") || g("Descripcion"),
      cantidad:    g("Cantidad"),
      unidad:      g("UnidadMedida"),
      precio:      g("PrecioUnitario"),
      subtotal:    g("SubTotal"),
      cabys:       g("CodigoCABYS") || g("CodigoComercial > Codigo") || g("Codigo"),
      ivaPct:      g("Impuesto > Tarifa") || g("Tarifa"),
      ivaMoneto:   g("Impuesto > Monto"),
      total:       g("MontoTotalLinea"),
    }
  })
  const condicionVenta = get("CondicionVenta") || ""
  // InformacionReferencia — puede haber más de una; tomamos todas
  const refNodes = [...doc.querySelectorAll("InformacionReferencia")]
  const referencias = refNodes.map(n => {
    const rg = sel => n.querySelector(sel)?.textContent?.trim() || ""
    return {
      tipoDoc:     rg("TipoDoc"),
      numero:      rg("Numero"),
      fechaRef:    rg("FechaEmisionDoc"),
      codigo:      rg("Codigo"),
      razon:       rg("Razon"),
    }
  })
  const tiposDoc = { FacturaElectronica:"Factura Electrónica", TiqueteElectronico:"Tiquete Electrónico",
    NotaDebitoElectronica:"Nota de Débito", NotaCreditoElectronica:"Nota de Crédito",
    FacturaElectronicaCompra:"FE de Compra", FacturaElectronicaExportacion:"FE de Exportación" }
  const tiposRefDoc = { "01":"Factura Electrónica","02":"Nota de Débito","03":"Nota de Crédito",
    "04":"Tiquete","05":"Nota despacho","06":"Contrato","07":"Procedimiento","08":"Comprobante emitido en contingencia",
    "09":"Devolución mercadería","10":"Sustitución FE anulada","11":"Continuación FE","12":"FE de Exportación","99":"Otro" }
  const codigosRef = { "01":"Anula doc ref","02":"Corrige texto","03":"Corrige monto","04":"Referencia a otro doc",
    "05":"Sustituye doc provisional","06":"Otros" }
  return { rootTag, tipoDoc: tiposDoc[rootTag] || rootTag, clave, numConsecutivo, fecha, emisor, receptor, resumen, lines, condicionVenta, referencias, tiposRefDoc, codigosRef }
}

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



function EmptyState({ msg }) {
  return (
    <div className="emptyState">
      <div className="emptyIconBox">{IC.empty}</div>
      <span className="emptyText">{msg}</span>
    </div>
  )
}

function PageHeader({ icon, title, description, onClear }) {
  return (
    <div className="pageHeader">
      <div className="pageHeaderTop">
        <div className="pageHeaderIcon">{icon}</div>
        <h1 className="pageTitle">{title}</h1>
      </div>
      {description && <p className="pageDesc">{description}</p>}
      {onClear && (
        <button type="button" className="clearResultsBtn" onClick={onClear}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Nueva consulta
        </button>
      )}
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

/* ─── CABYS — mapa de jerarquía por prefijo de código ─── */
const CABYS_CAT1 = {
  "0":"Productos agrícolas y animales","1":"Silvicultura, pesca y minerales",
  "2":"Combustibles y productos mineros","3":"Alimentos, bebidas y tabaco",
  "4":"Textiles, confección y cuero","5":"Madera, papel, químicos y farmacéuticos",
  "6":"Metales, maquinaria y equipo","7":"Equipos de transporte",
  "8":"Servicios","9":"Transacciones y bienes especiales",
}
const CABYS_CAT2 = {
  "31":"Carnes, pescado y mariscos","32":"Lácteos, huevos y grasas","33":"Frutas y verduras",
  "34":"Cereales, harinas y almidones","35":"Alimentos procesados","36":"Bebidas",
  "37":"Tabaco","38":"Alimentos para animales","39":"Otros alimentos",
  "51":"Productos de madera y corcho","52":"Pasta, papel y cartón",
  "53":"Productos impresos y grabados","54":"Medicamentos y farmacéuticos",
  "55":"Caucho y plástico","56":"Vidrio, cerámica y materiales de construcción",
  "61":"Hierro, acero y metales","62":"Maquinaria y equipo general",
  "63":"Equipo eléctrico y electrónico","64":"Instrumentos y óptica",
  "71":"Vehículos automotores","72":"Otro equipo de transporte",
  "81":"Servicios de construcción e inmobiliarios","82":"Distribución y comercio",
  "83":"Servicios empresariales y profesionales","84":"Telecomunicaciones e informática",
  "85":"Servicios de transporte","86":"Soporte a negocios",
  "87":"Servicios agropecuarios","88":"Servicios financieros y seguros",
  "89":"Servicios de arrendamiento","91":"Servicios de salud",
  "92":"Servicios educativos","93":"Servicios de alcantarillado y residuos",
  "94":"Servicios de asociaciones y organizaciones",
  "95":"Servicios de reparación y mantenimiento",
  "96":"Servicios recreativos, culturales y deportivos",
  "97":"Servicios de hospedaje y alimentación",
  "98":"Servicios domésticos y personales",
  "99":"Servicios y transacciones especiales",
}
function cabysEsServicio(codigo) {
  const s = String(codigo ?? "").replace(/\D/g, "")
  return s[0] === "8" || s[0] === "9"
}

function getCabysHierarchy(codigo) {
  const s = String(codigo ?? "").replace(/\D/g, "")
  if (!s) return []
  const cat1 = CABYS_CAT1[s[0]]
  const cat2 = CABYS_CAT2[s.slice(0, 2)]
  return [cat1, cat2].filter(Boolean)
}

/* ─── Ícono copiar (global) ─── */
const CopyIco = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <rect x="4" y="4" width="7" height="7" rx="1.5"/>
    <path d="M8 4V2.5A1.5 1.5 0 006.5 1H2.5A1.5 1.5 0 001 2.5v4A1.5 1.5 0 002.5 8H4"/>
  </svg>
)

/* ─── CABYS result card (enriched) ─── */
function CabysCard({ item, score: _score, fl, flash, favs, onToggleFav, onSelect }) {
  const [catExp, setCatExp] = useState(false)
  const isFav = favs?.some(f => f.codigo === item.codigo)
  const idCode = `cc-${item.codigo}`, idDesc = `cd-${item.codigo}`, idBoth = `cb-${item.codigo}`
  const esSvc = cabysEsServicio(item.codigo)

  const allCats = (item.categorias?.length ? item.categorias : getCabysHierarchy(item.codigo))
    .filter((v, i, a) => a.indexOf(v) === i)
  const MAX_CATS = 3
  const visibleCats = catExp ? allCats : allCats.slice(-MAX_CATS)
  const hasMore = allCats.length > MAX_CATS

  const handleCardClick = (e) => {
    // No abrir drawer si se hizo clic en un botón o su hijo
    if (e.target.closest("button")) return
    onSelect?.(item)
  }

  return (
    <div
      className={`cabysCard${isFav ? " cabysCardFav" : ""}${onSelect ? " cabysCardSelectable" : ""}`}
      onClick={handleCardClick}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(item) } } : undefined}
    >
      {/* Header: code badge + fav */}
      <div className="cabysCardHead">
        <span className="cabysCardCode">{item.codigo}</span>
        <button className={`favBtn${isFav ? " favBtnOn" : ""}`} type="button"
          title={isFav ? "Quitar favorito" : "Guardar favorito"}
          onClick={() => onToggleFav(item)}>
          {isFav ? IC.star : IC.starOff}
        </button>
      </div>

      {/* Name — primary content */}
      <div className="cabysCardName">{item.descripcion}</div>

      {/* Categories — vertical list, expandable */}
      {allCats.length > 0 && (
        <div className="cabysCardCatWrap">
          {visibleCats.map((label, i) => (
            <div key={i} className="cabysCardCatRow">
              <span className="cabysCardCatDot" />
              <span className="cabysCardCatChip">{label}</span>
            </div>
          ))}
          {hasMore && (
            <button className="cabysCardCatToggle" type="button" onClick={() => setCatExp(e => !e)}>
              {catExp ? "Ver menos" : `+${allCats.length - MAX_CATS} más`}
            </button>
          )}
        </div>
      )}

      {/* Footer: badges + actions */}
      <div className="cabysCardFoot">
        <div className="cabysCardBadges">
          <span className={`taxBadgeV2 ${taxClass(item.impuesto)}`}>{item.impuesto}% IVA</span>
          <span className={`cabysTypeBadge${esSvc ? " cabysTypeSvc" : " cabysTypeArt"}`}>
            {esSvc ? "Servicio" : "Artículo"}
          </span>
        </div>
        <div className="cabysCardActions">
          <button className={`cabysActBtn${fl === idCode ? " cabysActBtnDone" : ""}`} type="button"
            title="Copiar código" onClick={() => flash(idCode, String(item.codigo))}>
            {fl === idCode ? "✓" : "#"}
          </button>
          <button className={`cabysActBtn${fl === idDesc ? " cabysActBtnDone" : ""}`} type="button"
            title="Copiar descripción" onClick={() => flash(idDesc, item.descripcion)}>
            {fl === idDesc ? "✓" : "T"}
          </button>
          <button className={`cabysActBtn cabysActBtnPrimary${fl === idBoth ? " cabysActBtnDone" : ""}`} type="button"
            title="Copiar código y descripción"
            onClick={() => flash(idBoth, `${item.codigo} — ${item.descripcion}`)}>
            {fl === idBoth ? "✓ Copiado" : "Copiar ambos"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── CABYS Drawer ─── */
// Reutilizable: recibe item + lista de relacionados + callbacks
function CabysDrawer({ item, relatedItems = [], fl, flash, favs, onToggleFav, onClose, onSelectRelated }) {
  const esSvc = item ? cabysEsServicio(item.codigo) : false
  const isFav = favs?.some(f => f.codigo === item?.codigo)
  const idCode  = `drw-c-${item?.codigo}`
  const idDesc  = `drw-d-${item?.codigo}`
  const idBoth  = `drw-b-${item?.codigo}`

  const allCats = item
    ? (item.categorias?.length ? item.categorias : getCabysHierarchy(item.codigo))
        .filter((v, i, a) => a.indexOf(v) === i)
    : []

  // Cerrar con ESC
  useEffect(() => {
    if (!item) return
    const handler = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [item, onClose])

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    if (item) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [item])

  if (!item) return null

  // Relacionados: del mismo tipo (servicio/artículo) excluyendo el actual
  const related = relatedItems
    .filter(r => r.codigo !== item.codigo && cabysEsServicio(r.codigo) === esSvc)
    .slice(0, 6)

  return (
    <>
      {/* Overlay */}
      <div className="cabysDrawerOverlay" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="cabysDrawerPanel" role="dialog" aria-modal="true" aria-label="Detalle CABYS">
        {/* Header del drawer */}
        <div className="cabysDrawerHeader">
          <div className="cabysDrawerHeaderTop">
            <div className="cabysDrawerBadges">
              <span className={`taxBadgeV2 ${taxClass(item.impuesto)}`}>{item.impuesto}% IVA</span>
              <span className={`cabysTypeBadge${esSvc ? " cabysTypeSvc" : " cabysTypeArt"}`}>
                {esSvc ? "Servicio" : "Artículo"}
              </span>
            </div>
            <button className="cabysDrawerClose" type="button" onClick={onClose} title="Cerrar (ESC)">
              ✕
            </button>
          </div>
          <div className="cabysDrawerTitle">{item.descripcion}</div>
        </div>

        {/* Cuerpo con scroll */}
        <div className="cabysDrawerBody">

          {/* Código */}
          <div className="cabysDrawerSection">
            <div className="cabysDrawerSectionLabel">Código CABYS</div>
            <div className="cabysDrawerCodeRow">
              <span className="cabysDrawerCode">{item.codigo}</span>
              <button
                className={`cabysDrawerCopyBtn${fl === idCode ? " cabysDrawerCopyBtnOk" : ""}`}
                type="button"
                onClick={() => flash(idCode, String(item.codigo))}
                title="Copiar código"
              >
                {fl === idCode ? "✓" : <CopyIco />}
              </button>
            </div>
          </div>

          {/* Ruta completa */}
          {allCats.length > 0 && (
            <div className="cabysDrawerSection">
              <div className="cabysDrawerSectionLabel">Ruta de clasificación</div>
              <div className="cabysDrawerCatPath">
                {allCats.map((cat, i) => (
                  <div key={i} className="cabysDrawerCatStep">
                    {i > 0 && <span className="cabysDrawerCatArrow">›</span>}
                    <span className="cabysDrawerCatLabel">{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descripción completa */}
          <div className="cabysDrawerSection">
            <div className="cabysDrawerSectionLabel">Descripción completa</div>
            <div className="cabysDrawerDesc">{item.descripcion}</div>
          </div>

          {/* Acciones */}
          <div className="cabysDrawerSection">
            <div className="cabysDrawerSectionLabel">Copiar</div>
            <div className="cabysDrawerActions">
              <button
                className={`cabysDrawerActionBtn${fl === idCode ? " cabysDrawerActionBtnOk" : ""}`}
                type="button"
                onClick={() => flash(idCode, String(item.codigo))}
              >
                {fl === idCode ? "✓ Copiado" : "📋 Copiar código"}
              </button>
              <button
                className={`cabysDrawerActionBtn${fl === idDesc ? " cabysDrawerActionBtnOk" : ""}`}
                type="button"
                onClick={() => flash(idDesc, item.descripcion)}
              >
                {fl === idDesc ? "✓ Copiado" : "📋 Copiar descripción"}
              </button>
              <button
                className={`cabysDrawerActionBtn cabysDrawerActionBtnPrimary${fl === idBoth ? " cabysDrawerActionBtnOk" : ""}`}
                type="button"
                onClick={() => flash(idBoth, `${item.codigo} — ${item.descripcion}`)}
              >
                {fl === idBoth ? "✓ Copiado" : "📋 Copiar ambos"}
              </button>
              <button
                className={`cabysDrawerActionBtn${isFav ? " cabysDrawerActionBtnFav" : ""}`}
                type="button"
                onClick={() => onToggleFav(item)}
              >
                {isFav ? "★ En favoritos" : "☆ Guardar favorito"}
              </button>
            </div>
          </div>

          {/* Relacionados */}
          {related.length > 0 && (
            <div className="cabysDrawerSection">
              <div className="cabysDrawerSectionLabel">También podrían interesarte</div>
              <div className="cabysDrawerRelated">
                {related.map(r => (
                  <button
                    key={r.codigo}
                    className="cabysDrawerRelatedItem"
                    type="button"
                    onClick={() => onSelectRelated(r)}
                  >
                    <span className="cabysDrawerRelatedCode">{r.codigo}</span>
                    <span className="cabysDrawerRelatedDesc">{r.descripcion}</span>
                    <span className={`taxBadgeV2 ${taxClass(r.impuesto)}`} style={{ flexShrink: 0, fontSize: 10 }}>{r.impuesto}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

/* ─── Command Palette ─── */
function CommandPalette({ open, onClose, activities, navigate, setCabysQ, consultarCabysRef, setAeId, consultarAE }) {
  const [q, setQ] = useState("")
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  const isLikelyCedula = (s) => /^\d{9,11}$/.test(s.replace(/[-\s]/g,""))
  const isLikelyFe     = (s) => /^\d{30,50}$/.test(s.replace(/\s/g,""))

  const searchCabys = useCallback((t) => {
    navigate("cabys")
    setTimeout(() => { setCabysQ(t); consultarCabysRef.current?.({ reset: true, q: t }) }, 50)
  }, [navigate, setCabysQ, consultarCabysRef])

  const smartActions = useMemo(() => {
    const t = q.trim()
    if (!t) return []
    const results = []
    if (isLikelyCedula(t)) {
      results.push({ type:"smart", icon: IC.user,   label: `Consultar contribuyente: ${t}`, action: () => { setAeId(t); navigate("contribuyente"); setTimeout(() => consultarAE(t), 50) } })
    } else if (isLikelyFe(t)) {
      results.push({ type:"smart", icon: IC.receipt, label: `Validar factura electrónica`, action: () => navigate("factura") })
    } else {
      // eslint-disable-next-line react-hooks/refs
      results.push({ type:"smart", icon: IC.search,  label: `Buscar CABYS: "${t}"`, action: () => searchCabys(t) })
    }
    return results
  }, [q, setAeId, navigate, consultarAE, searchCabys])

  const filteredActions = useMemo(() => {
    const all = [
      { id:"factura",       icon: IC.xml,      label: "Validador XML",                desc: "Cargá un comprobante y revisá CABYS e IVA" },
      { id:"cabys",         icon: IC.search,   label: "Asistente CABYS",          desc: "Buscá códigos por actividad o producto" },
      { id:"contribuyente", icon: IC.user,     label: "Verificar Contribuyente",  desc: "Estado fiscal y actividades económicas" },
      { id:"exoneraciones", icon: IC.shield,   label: "Exoneraciones",            desc: "Verificá exoneraciones de impuestos" },
      { id:"tipocambio",    icon: IC.currency, label: "Tipo de Cambio",           desc: "USD/CRC en tiempo real" },
    ]
    if (!q.trim()) return all
    const low = q.toLowerCase()
    return all.filter(a => a.label.toLowerCase().includes(low) || a.desc.toLowerCase().includes(low))
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
  { id: "factura",        icon: IC.xml,       label: "Validador XML" },
  { id: "cabys",          icon: IC.search,    label: "Asistente CABYS" },
  { id: "contribuyente",  icon: IC.user,      label: "Contribuyente" },
  { id: "exoneraciones",  icon: IC.shield,    label: "Exoneraciones" },
  { id: "tipocambio",     icon: IC.currency,  label: "Tipo de Cambio" },
  { id: "clientes",       icon: IC.star,      label: "Clientes" },
  { id: "acerca",         icon: IC.info,      label: "Acerca de" },
]
const NAV_MAP = Object.fromEntries(NAV.map(n => [n.id, n]))
const NAV_GROUPS = [
  { items: ["home"] },
  { label: "Comprobantes",  items: ["factura", "cabys"] },
  { label: "Consultas",     items: ["contribuyente", "exoneraciones"] },
  { label: "Finanzas",      items: ["tipocambio"] },
  { label: "Gestión",       items: ["clientes"] },
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
  const [_searchFocus,  setSearchFocus]   = useState(false)
  const [cmdOpen,       setCmdOpen]       = useState(false)
  const [cabysF_avs,    setCabysF_avs]    = useState(() => loadFavs())
  const [cabysAeMatch,  setCabysAeMatch]  = useState(null)
  const [homeSearch,    setHomeSearch]    = useState("")
  const [homeFavs,      setHomeFavs]      = useState(() => loadHomeFavs())

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

  /* ─── Home smart search ─── */
  const homeSearchIntent = useMemo(() => {
    const q = homeSearch.trim()
    if (!q) return null
    const digits = q.replace(/[-\s]/g, "")
    if (/^\d{9,11}$/.test(digits)) return { type: "cedula",  label: "Verificar contribuyente",      icon: "user" }
    if (/^\d{30,50}$/.test(digits)) return { type: "factura", label: "Validar factura electrónica", icon: "receipt" }
    if (q.length >= 2)              return { type: "cabys",   label: "Buscar en Asistente CABYS",   icon: "search" }
    return null
  }, [homeSearch])

  const executeHomeSearch = useCallback(() => {
    const q = homeSearch.trim(); if (!q || !homeSearchIntent) return
    if (homeSearchIntent.type === "cedula") {
      const digits = q.replace(/[-\s]/g, "")
      setAeId(digits); navigate("contribuyente")
      setTimeout(() => consultarAE(digits), 80)
    } else if (homeSearchIntent.type === "factura") {
      setFeKey(q.replace(/\D/g, "")); navigate("factura")
    } else {
      navigate("cabys")
      setTimeout(() => { setCabysQ(q); setCabysPage(0); consultarCabysRef.current?.({ reset: true, q }) }, 50)
    }
    setHomeSearch("")
  }, [homeSearch, homeSearchIntent, consultarAE])

  const consultarCabysRef = useRef(null)

  /* ─── Navigate to CABYS with pre-filled query ─── */
  const navigateToCabys = useCallback((q) => {
    navigate("cabys")
    setTimeout(() => {
      setCabysQ(q)
      setCabysPage(0)
      consultarCabysRef.current({ reset: true, q })
    }, 50)
  }, [])

  /* ─── Search dropdown ─── */
  const _searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return NAV
    return NAV.filter(n => n.label.toLowerCase().includes(q) || n.id.includes(q))
  }, [searchQ])

  /* ─── API STATUS ─── */
  const [apiStatus, setApiStatus] = useState(null)

  const refreshApi = async () => {
    try { const ms = await checkApiStatus(); setApiStatus({ ok: true, ms, at: new Date() }) }
    catch { setApiStatus({ ok: false, at: new Date() }) }
  }

  /* ─── TIPO DE CAMBIO ─── */
  const [fx,        setFx]        = useState(null)
  const [fxLoading, setFxLoading] = useState(false)
  const [_fxError,  setFxError]   = useState("")
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
      // EUR desde el mismo endpoint de Hacienda
      try {
        const pV2 = x => x && typeof x === "object" ? x.valor ?? x : x
        const eurColones = json?.euro?.colones
        const eurFecha = json?.euro?.fecha ?? fechaUsd
        const eurVal = eurColones ? Number(pV2(eurColones)) : null
        if (eurVal) setFxEur({ colones: eurVal, fecha: eurFecha })
      } catch { /* silencioso */ }
    } catch { setFx(null); setFxError("No disponible") }
    finally { setFxLoading(false) }
  }, [])

  useEffect(() => {
    refreshApi(); fetchFx()
    const t = setInterval(refreshApi, 60_000)
    return () => clearInterval(t)
  }, [fetchFx])

  /* ─── CONVERSOR WISE ─── */
  const [convFrom,   setConvFrom]   = useState("usd")
  const [convTo,     setConvTo]     = useState("crc")
  const [convAmount, setConvAmount] = useState("")
  const convResult = useMemo(() => {
    const n = convAmount === "" ? NaN : parseFloat(convAmount)
    if (!fx || isNaN(n) || n < 0) return null
    const eurRate = fxEur?.colones ?? null
    const toCrc = (id, a) => id === "crc" ? a : id === "usd" ? a * fx.venta : eurRate ? a * eurRate : null
    const fromCrc = (id, c) => id === "crc" ? c : id === "usd" ? c / fx.venta : eurRate ? c / eurRate : null
    const crc = toCrc(convFrom, n)
    if (crc == null) return null
    const thirdId = ["crc","usd","eur"].find(c => c !== convFrom && c !== convTo)
    return { to: fromCrc(convTo, crc), third: thirdId ? fromCrc(thirdId, crc) : null, thirdId }
  }, [fx, fxEur, convFrom, convTo, convAmount])

  /* ─── HISTORIAL BCCR ─── */
  const [tcHistory,     setTcHistory]     = useState([])
  const [tcHistLoading, setTcHistLoading] = useState(false)
  const fetchTcHistory = useCallback(async () => {
    setTcHistLoading(true)
    try {
      const fmtD = d => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
      const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 45)
      const base = `/bccr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicos`
      const p = ind => `?Indicador=${ind}&FechaInicio=${fmtD(start)}&FechaFinal=${fmtD(end)}&Nombre=ht&SubNiveles=N&CorreoElectronico=no@no.com&Token=NONE`
      const [rC, rV] = await Promise.all([fetch(base + p(317), { cache: "no-store" }), fetch(base + p(318), { cache: "no-store" })])
      const [tC, tV] = await Promise.all([rC.text(), rV.text()])
      const parseHist = xml => [...xml.matchAll(/<DES_FECHA>([\d/]+)<\/DES_FECHA>[\s\S]*?<NUM_VALOR>([\d.,]+)<\/NUM_VALOR>/g)]
        .map(([, f, v]) => ({ fecha: f, val: parseFloat(v.replace(",", ".")) }))
      const comp = parseHist(tC), vent = parseHist(tV)
      const map = {}
      comp.forEach(d => { map[d.fecha] = { fecha: d.fecha, compra: d.val } })
      vent.forEach(d => { if (map[d.fecha]) map[d.fecha].venta = d.val })
      const hist = Object.values(map).filter(d => d.compra && d.venta).slice(-30)
      setTcHistory(hist)
    } catch { /* silencioso */ }
    finally { setTcHistLoading(false) }
  }, [])

  useEffect(() => { fetchTcHistory() }, [fetchTcHistory])

  /* ─── COPY FLASH ─── */
  const { fl, flash } = useCopyFlash()

  /* ─── TC HISTÓRICO ─── */
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [tcFecha,    _setTcFecha]   = useState(todayStr)
  const [_tcData,    setTcData]     = useState(null)
  const [_tcLoading, setTcLoading]  = useState(false)
  const [_tcError,   setTcError]    = useState("")
  const [_tcSearched,setTcSearched] = useState(false)

  const _consultarTc = async () => {
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
  const [cabysTop,      _setCabysTop]     = useState(12)
  const [cabysData,     setCabysData]     = useState([])
  const [cabysLoading,  setCabysLoading]  = useState(false)
  const [cabysError,    setCabysError]    = useState("")
  const [cabysPage,     setCabysPage]     = useState(0)
  const [cabysLastTop,  setCabysLastTop]  = useState(0)
  const [cabysSearched, setCabysSearched] = useState(false)
  const [_cabysHist,    setCabysHist]     = useState(() => loadH("ht_cabys"))
  const [cabysSort,     setCabysSort]     = useState({ col: null, dir: "asc" })
  const [cabysView,     setCabysView]     = useState("cards") // "cards" | "table"
  const [cabysNorm,     setCabysNorm]     = useState("")      // query normalizada (con tildes)
  const [cabysMode,     setCabysMode]     = useState("libre") // "libre" | "ae"
  const [aeDesc,        setAeDesc]        = useState("")      // descripción actividad económica
  const [selectedCabys, setSelectedCabys] = useState(null)   // drawer lateral CABYS

  const cabysQ_  = useMemo(() => cabysQ.trim(), [cabysQ])
  const pageSize = useMemo(() => { const n = Number(cabysTop); return Number.isFinite(n) && n > 0 ? Math.min(50, Math.max(6, n)) : 12 }, [cabysTop])

  const consultarCabys = useCallback(async ({ reset = false, q: qOv } = {}) => {
    const rawQ = (qOv ?? cabysQ_).trim(); if (!rawQ) return
    const q = restoreAccents(rawQ)
    setCabysNorm(q !== rawQ ? q : "")
    if (reset) setCabysPage(0)
    setCabysLoading(true); setCabysError(""); setCabysSearched(true)
    // Si el query es numérico (código CABYS) → usar ?codigo=  |  si es texto → usar ?q=
    const esCodigo = /^\d{5,13}$/.test(rawQ.replace(/\s/g, ""))
    try {
      const pg = reset ? 0 : cabysPage
      const top = Math.min(50, pageSize * (pg + 1)); setCabysLastTop(top)
      const url = esCodigo
        ? `/hacienda/fe/cabys?codigo=${encodeURIComponent(rawQ.replace(/\s/g, ""))}`
        : `/hacienda/fe/cabys?q=${encodeURIComponent(q)}&top=${top}`
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      // ?q= devuelve { cabys:[...] }; ?codigo= devuelve [...] directamente
      setCabysData(Array.isArray(json) ? json : (json.cabys || []))
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
        const esCod = /^\d{5,13}$/.test(cabysQ_.replace(/\s/g,""))
        const res = await fetch(esCod ? `/hacienda/fe/cabys?codigo=${encodeURIComponent(cabysQ_)}` : `/hacienda/fe/cabys?q=${encodeURIComponent(cabysQ_)}&top=${need}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setCabysData(Array.isArray(json) ? json : (json.cabys || [])); setCabysLastTop(need)
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
  const [_aeHist,    setAeHist]     = useState(() => loadH("ht_ae"))
  const aeLastQ = useRef("")

  const aeDigits = useMemo(() => onlyDigits(aeId), [aeId])
  const aeValid  = useMemo(() => isValidAeId(aeId), [aeId])

  const consultarAE = useCallback(async (idOv) => {
    const digits = idOv ? onlyDigits(idOv) : aeDigits
    if (!isValidAeId(digits)) return
    setAeLoading(true); setAeError(""); setAeSearched(true)
    try {
      const res = await fetch(`/hacienda/fe/ae?identificacion=${digits}`, { cache: "no-store" })
      if (res.status === 404) { setAeData(null); aeLastQ.current = digits; return }
      if (!res.ok) throw new Error(`Error consultando Hacienda (${res.status})`)
      const json = await res.json()
      if (json?.code === 404 || json?.status?.toLowerCase().includes("not available")) { setAeData(null); aeLastQ.current = digits; return }
      setAeData(json)
      aeLastQ.current = digits; saveH("ht_ae", digits); setAeHist(loadH("ht_ae"))
      logActivity("contribuyente", digits)
    } catch (e) { setAeData(null); setAeError(e?.message || "Error consultando contribuyente") }
    finally { setAeLoading(false) }
  }, [aeDigits, logActivity])

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

  /* ─── FACTURA ─── */
  const [feTab,      setFeTab]      = useState("clave") // "clave" | "xml"
  const [feKey,      setFeKey]      = useState("")
  const [feData,     setFeData]     = useState(null)
  const [feNotFound, setFeNotFound] = useState(false)
  const [feLoading,  setFeLoading]  = useState(false)
  const [feError,    setFeError]    = useState("")
  const [_feSearched, setFeSearched] = useState(false)
  const [feXmlData,       setFeXmlData]       = useState(null)
  const [feXmlError,      setFeXmlError]      = useState("")
  const [feXmlDrag,       setFeXmlDrag]       = useState(false)
  const [cabysValidation, setCabysValidation] = useState({}) // { [codigo]: { status, impuesto, descripcion, categorias } }
  const [xmlDrawerItem,   setXmlDrawerItem]   = useState(null) // drawer CABYS desde validador XML
  const [soloInconsistencias, setSoloInconsistencias] = useState(false) // filtro filas XML

  const feClean = useMemo(() => onlyDigits(feKey), [feKey])
  const feValid = feClean.length === 50

  // Validación CABYS: se dispara al cargar un XML
  useEffect(() => {
    if (!feXmlData?.lines?.length) { setCabysValidation({}); return }
    const codigos = [...new Set(feXmlData.lines.map(l => l.cabys).filter(Boolean))]
    if (!codigos.length) { setCabysValidation({}); return }
    // Marcar todos como "loading"
    setCabysValidation(Object.fromEntries(codigos.map(c => [c, { status: "loading", impuesto: null }])))
    // Consultar en paralelo (un fetch por código único)
    Promise.all(codigos.map(async codigo => {
      try {
        const res = await fetch(`/hacienda/fe/cabys?codigo=${encodeURIComponent(codigo)}`, { cache: "no-store" })
        if (!res.ok) return [codigo, { status: "err", impuesto: null }]
        const json = await res.json()
        if (Array.isArray(json) && json.length > 0) {
          return [codigo, { status: "ok", impuesto: json[0].impuesto ?? null, descripcion: json[0].descripcion ?? "", categorias: json[0].categorias ?? [] }]
        }
        return [codigo, { status: "nf", impuesto: null, descripcion: "", categorias: [] }]
      } catch {
        return [codigo, { status: "err", impuesto: null, descripcion: "", categorias: [] }]
      }
    })).then(results => {
      setCabysValidation(Object.fromEntries(results))
    })
  }, [feXmlData])

  // Resetear filtros dependientes al cargar un XML nuevo
  useEffect(() => {
    setSoloInconsistencias(false)
    setXmlDrawerItem(null)
  }, [feXmlData])

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

  /* ─── XML FE ─── */
  const handleXmlFile = (file) => {
    if (!file) return
    if (!file.name.endsWith(".xml") && file.type !== "text/xml" && file.type !== "application/xml") {
      setFeXmlError("Solo se aceptan archivos XML de factura electrónica."); return
    }
    setFeXmlError(""); setFeXmlData(null)
    const reader = new FileReader()
    reader.onload = e => {
      try { setFeXmlData(parseXmlFe(e.target.result)) }
      catch (err) { setFeXmlError(err.message) }
    }
    reader.readAsText(file, "utf-8")
  }

  const printXmlFe = () => {
    window.print()
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
        setAeId={setAeId} consultarAE={consultarAE} />

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
          <button type="button"
            className={`navItem navItemAcerca${page === "acerca" ? " navActive" : ""}`}
            onClick={() => navigate("acerca")}>
            <span className="navIcon">{IC.info}</span>
            <span className="navLabel">Acerca de</span>
          </button>
          <div className="sideBottomSep" />
          <button type="button" className="cmdTriggerBtn" onClick={() => setCmdOpen(true)}>
            {IC.search}
            <span className="cmdTriggerLabel">Búsqueda rápida</span>
          </button>
          <button type="button" className="sideCollapseBtn"
            onClick={() => setSideCollapsed(c => !c)}
            data-tip={sideCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}>
            {sideCollapsed ? IC.expandRight : IC.collapseLeft}
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
            <div className="homeWrap">

              {/* ── Hero ── */}
              <div className="homeHero">
                <div className="homeGreeting">{saludo()}</div>
                <h1 className="homeTitle">Revisión de comprobantes XML</h1>
                <p className="homeSub">Cargá un XML de Hacienda para validar CABYS, IVA y detectar inconsistencias. También consultá contribuyentes, exoneraciones y tipo de cambio.</p>
              </div>

              {/* ── Buscador inteligente ── */}
              <div className="homeSearchWrap">
                <div className="homeSearchBar">
                  <span className="homeSearchIcon">{IC.search}</span>
                  <input
                    className="homeSearchInput"
                    value={homeSearch}
                    placeholder="Buscar empresa, CABYS, actividad económica o factura..."
                    onChange={e => setHomeSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") executeHomeSearch() }}
                    autoComplete="off"
                  />
                  <button
                    type="button" className="homeSearchBtn"
                    onClick={executeHomeSearch}
                    disabled={!homeSearchIntent}
                  >
                    {IC.arrowRight} Buscar
                  </button>
                </div>
                <div className="homeSearchHint">
                  {homeSearchIntent ? (
                    <>
                      <span className="homeSearchHintDot" />
                      {homeSearchIntent.type === "cedula"  && <>{IC.user}    Cédula detectada → <strong>Verificar contribuyente</strong></>}
                      {homeSearchIntent.type === "factura" && <>{IC.receipt} Clave FE detectada → <strong>Validar factura</strong></>}
                      {homeSearchIntent.type === "cabys"   && <>{IC.search}  Texto libre → <strong>Buscar en Asistente CABYS</strong></>}
                    </>
                  ) : (
                    <span className="homeSearchHintEmpty">Ingrese una cédula, clave de factura o cualquier término</span>
                  )}
                </div>
              </div>

              {/* ── Accesos rápidos ── */}
              <div className="homeSectionTitle">Accesos rápidos</div>
              <div className="homeQuickGrid">
                {[
                  { id:"factura",        icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l-3 3 3 3M16 6l3 3-3 3M13 3L7 17"/></svg>,
                    label:"Validador XML",           desc:"CABYS, IVA e inconsistencias",      color:"#f5f3ff", iconColor:"#7c3aed" },
                  { id:"cabys",          icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L5 11h4v7l6-9h-4L10 2z" fill="currentColor"/></svg>,
                    label:"Asistente CABYS",     desc:"Códigos y tarifas de IVA",          color:"#f0f9ff", iconColor:"#2563eb" },
                  { id:"contribuyente",  icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="7" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M7 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
                    label:"Contribuyentes",      desc:"Estado fiscal y actividades",        color:"#f0fdf4", iconColor:"#16a34a" },
                  { id:"tipocambio",     icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 8h12M13 5l3 3-3 3M16 12H4M7 15l-3-3 3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                    label:"Tipo de Cambio",      desc:"USD y EUR en tiempo real",           color:"#fdf4ff", iconColor:"#9333ea" },
                ].map(q => (
                  <button key={q.id} type="button" className="homeQuickCard" onClick={() => navigate(q.id)}>
                    <div className="homeQuickIcon" style={{ background: q.color, color: q.iconColor }}>{q.icon}</div>
                    <div className="homeQuickLabel">{q.label}</div>
                    <div className="homeQuickDesc">{q.desc}</div>
                  </button>
                ))}
              </div>

              {/* ── Favoritos ── */}
              <div className="homeSectionTitle">
                ⭐ Favoritos
              </div>
              <div className="homeFavsRow">
                {homeFavs.map(f => (
                  <button key={f.id} type="button" className="homeFavChip"
                    onClick={() => { navigate("cabys"); setTimeout(() => { setCabysQ(f.query); setCabysPage(0); consultarCabysRef.current?.({ reset: true, q: f.query }) }, 50) }}>
                    <span className="homeFavIcon">⭐</span>
                    <span>{f.label}</span>
                    <span className="homeFavRemove" onClick={e => {
                      e.stopPropagation()
                      const next = homeFavs.filter(x => x.id !== f.id)
                      setHomeFavs(next); saveHomeFavs(next)
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </span>
                  </button>
                ))}
                {homeFavs.length === 0 && (
                  <button type="button" className="homeFavChip homeFavReset" onClick={() => { setHomeFavs(HOME_FAVS_DEFAULT); saveHomeFavs(HOME_FAVS_DEFAULT) }}>
                    Restaurar favoritos por defecto
                  </button>
                )}
              </div>

              {/* ── Recientes ── */}
              {activities.length > 0 && (
                <>
                  <div className="homeSectionTitle" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span>🕒 Recientes</span>
                    <button type="button" className="homeClearBtn" onClick={() => { localStorage.removeItem(ACT_KEY); setActivities([]) }}>Limpiar</button>
                  </div>
                  <div className="homeRecentList">
                    {activities.slice(0, 7).map((a, i) => (
                      <button key={i} type="button" className="homeRecentItem" onClick={() => navigate(a.type)}>
                        <span className="homeRecentIcon">{ACT_ICONS[a.type] || IC.search}</span>
                        <div className="homeRecentBody">
                          <div className="homeRecentLabel">{a.q}</div>
                          <div className="homeRecentType">{ACT_LABELS[a.type]}</div>
                        </div>
                        <span className="homeRecentTime">{relTime(a.ts)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

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
                        fl={fl} flash={flash} favs={cabysF_avs} onToggleFav={toggleFav}
                        onSelect={setSelectedCabys} />
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

              {cabysError && (
                <div className="alertBox" style={{ marginTop: 16 }}>
                  {IC.warning} {cabysError}
                  <button type="button" className="clearInlineBtn" onClick={() => { setCabysData([]); setCabysError(""); setCabysSearched(false); setCabysQ(""); setCabysAeMatch(null) }}>✕ Limpiar</button>
                </div>
              )}
              {cabysSearched && !cabysLoading && !cabysError && !cabysTotal && (
                <div>
                  <EmptyState msg={`Sin resultados para "${cabysQ_}" — intentá con términos más generales`} />
                  <div style={{ textAlign:"center", marginTop: 12 }}>
                    <button type="button" className="newQueryBtn" onClick={() => { setCabysData([]); setCabysSearched(false); setCabysQ(""); setCabysAeMatch(null) }}>← Nueva búsqueda</button>
                  </div>
                </div>
              )}

              {cabysTotal > 0 && (
                <>
                  <div className="resultsHeader" style={{ marginTop: 20 }}>
                    <span className="resultsHeaderText">
                      <strong>{cabysTotal}</strong> resultado{cabysTotal !== 1 ? "s" : ""} para "<strong>{cabysNorm || cabysQ_}</strong>"
                    </span>
                    <div className="resultsHeaderActions">
                      <button type="button" className="newQueryBtn" onClick={() => { setCabysData([]); setCabysSearched(false); setCabysQ(""); setCabysAeMatch(null) }}>← Nueva búsqueda</button>
                      <div className="viewModeToggle">
                        <button type="button" className={`viewModeBtn${cabysView === "cards" ? " active" : ""}`}
                          onClick={() => setCabysView("cards")}>{IC.grid}</button>
                        <button type="button" className={`viewModeBtn${cabysView === "table" ? " active" : ""}`}
                          onClick={() => setCabysView("table")}>{IC.table}</button>
                      </div>
                      <button className="btn btnGhost" type="button" disabled={!cabysRows.length}
                        onClick={() => {
                          if (!cabysRows.length) return
                          const csv = toCsv(cabysRows.map(c => [c.codigo, c.descripcion, `${c.impuesto}%`, cabysEsServicio(c.codigo) ? "Servicio" : "Artículo"]), ["codigo", "descripcion", "impuesto", "tipo"])
                          downloadBlob("cabys.csv", new Blob([csv], { type: "text/csv;charset=utf-8;" }))
                        }}>CSV</button>
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
                          fl={fl} flash={flash} favs={cabysF_avs} onToggleFav={toggleFav}
                          onSelect={setSelectedCabys} />
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
                            <th>Tipo</th>
                            <th className="thR">Copiar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cabysRows.map(c => (
                            <tr key={c.codigo}>
                              <td className="mono">{c.codigo}</td>
                              <td>{c.descripcion}</td>
                              <td><span className={`taxBadgeV2 ${taxClass(c.impuesto)}`}>{c.impuesto}%</span></td>
                              <td><span className={`cabysTypeBadge${cabysEsServicio(c.codigo) ? " cabysTypeSvc" : " cabysTypeArt"}`}>{cabysEsServicio(c.codigo) ? "Servicio" : "Artículo"}</span></td>
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

              {/* ── Drawer de detalle CABYS ── */}
              <CabysDrawer
                item={selectedCabys}
                relatedItems={cabysData}
                fl={fl}
                flash={flash}
                favs={cabysF_avs}
                onToggleFav={toggleFav}
                onClose={() => setSelectedCabys(null)}
                onSelectRelated={(r) => setSelectedCabys(r)}
              />
            </div>
          )}

          {/* ══ CONTRIBUYENTE ══ */}
          {page === "contribuyente" && (
            <div className="pageWrap pageCentered">
              <PageHeader icon={IC.user} title="Verificar Contribuyente"
                description="Consultá el estado fiscal, régimen y actividades económicas. Desde una actividad podés buscar sus códigos CABYS directamente."
                onClear={(aeData || aeError) ? () => { setAeData(null); setAeId(""); setAeError("") } : null} />
              <div className="toolCard">
                <div className="toolSection">
                  <label className="lbl">Cédula, NITE o número de identificación</label>
                  <div className="inputRow">
                    <input className="inp" value={aeId} inputMode="numeric" placeholder="Cédula, NITE o DIMEX (9–12 dígitos)"
                      onChange={e => setAeId(onlyDigits(e.target.value))}
                      onKeyDown={e => { if (e.key === "Enter") consultarAE() }} />
                    <button className="btn btnPrimary" onClick={() => consultarAE()} disabled={!aeValid || aeLoading} type="button">
                      {aeLoading ? "Consultando…" : "Consultar"}
                    </button>
                  </div>
                  {!aeValid && aeId.length > 0 && <div className="hintBad">Cédula (9 dígitos), jurídica (10), NITE (10) o DIMEX (12).</div>}
                </div>
              </div>

              {aeError && <div className="alertBox">{IC.warning} {aeError}</div>}
              {aeSearched && !aeLoading && !aeError && !aeData && aeLastQ.current && (
                <EmptyState msg={`No se encontró contribuyente para "${aeLastQ.current}"`} />
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

          {/* ══ TIPO DE CAMBIO ══ */}
          {page === "tipocambio" && (() => {
            const prev = tcHistory.length >= 2 ? tcHistory[tcHistory.length - 2] : null
            const usdChg  = (fx && prev) ? fx.venta - prev.venta : null
            const usdChgP = (usdChg != null && prev?.venta) ? (usdChg / prev.venta) * 100 : null
            return (
            <div className="pageWrap pageCentered">

              {/* ── Chips compactos ── */}
              <div className="tcChipRow">
                <div className="tcChip">
                  <div className="tcChipMain">
                    <span className="tcChipFlag">🇺🇸</span>
                    <div>
                      <div className="tcChipRate">{fxLoading ? "…" : fx ? `₡${fx.venta.toLocaleString("es-CR")}` : "—"} <span className="tcChipCcy">USD</span></div>
                      <div className="tcChipSub">Compra ₡{fx?.compra?.toLocaleString("es-CR") ?? "—"} · Venta ₡{fx?.venta?.toLocaleString("es-CR") ?? "—"}</div>
                    </div>
                  </div>
                  {usdChg != null && (
                    <div className={`tcChipVar ${usdChg >= 0 ? "tcChipUp" : "tcChipDown"}`}>
                      <span className="tcChipVarPct">{usdChg >= 0 ? "▲" : "▼"} {Math.abs(usdChgP).toFixed(2)}%</span>
                      <span className="tcChipVarAbs">{usdChg >= 0 ? "+" : ""}₡{usdChg.toFixed(2)} vs ayer</span>
                    </div>
                  )}
                </div>
                <div className="tcChip tcChipEur">
                  <div className="tcChipMain">
                    <span className="tcChipFlag">🇪🇺</span>
                    <div>
                      <div className="tcChipRate">{fxLoading ? "…" : fxEur ? `₡${fxEur.colones.toLocaleString("es-CR")}` : "—"} <span className="tcChipCcy">EUR</span></div>
                      <div className="tcChipSub">Referencia Hacienda · {fxEur ? formatFechaCR(fxEur.fecha) : "—"}</div>
                    </div>
                  </div>
                </div>
                <button className="tcChipRefresh" onClick={() => { fetchFx(); fetchTcHistory() }} type="button" title="Actualizar">
                  {IC.refresh}
                </button>
              </div>

              {/* ── Conversor Wise ── */}
              <ConversorWise
                fx={fx} fxEur={fxEur}
                convFrom={convFrom} setConvFrom={setConvFrom}
                convTo={convTo} setConvTo={setConvTo}
                convAmount={convAmount} setConvAmount={setConvAmount}
                convResult={convResult}
              />

              {/* ── Sparkline 30 días ── */}
              <TcSparkline data={tcHistory} loading={tcHistLoading} />

            </div>
            )
          })()}

          {/* ══ FACTURA ══ */}
          {page === "factura" && (
            <div className="pageWrap pageCentered">
              <PageHeader icon={IC.receipt} title="Factura Electrónica"
                description="Validá facturas por clave numérica o subí el XML para ver todos los detalles."
                onClear={(feData || feError || feNotFound || feXmlData || feXmlError) ? () => { setFeData(null); setFeKey(""); setFeError(""); setFeSearched(false); setFeNotFound(false); setFeXmlData(null); setFeXmlError("") } : null} />

              {/* Tabs */}
              <div className="feTabRow">
                <button type="button" className={`feTabBtn${feTab==="clave"?" active":""}`} onClick={() => setFeTab("clave")}>
                  # Por clave (50 dígitos)
                </button>
                <button type="button" className={`feTabBtn${feTab==="xml"?" active":""}`} onClick={() => setFeTab("xml")}>
                  {IC.xml} Cargar XML
                </button>
              </div>
              {/* ── Tab: Por clave ── */}
              {feTab === "clave" && <div className="toolCard">
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
              </div>}

              {/* ── Tab: XML ── */}
              {feTab === "xml" && (
                <div>
                  {!feXmlData && (
                    <div
                      className={`fxvDrop${feXmlDrag?" fxvDropOver":""}`}
                      onDragOver={e => { e.preventDefault(); setFeXmlDrag(true) }}
                      onDragLeave={() => setFeXmlDrag(false)}
                      onDrop={e => { e.preventDefault(); setFeXmlDrag(false); handleXmlFile(e.dataTransfer.files[0]) }}
                      onClick={() => document.getElementById("xmlFileInput").click()}
                    >
                      <div className="fxvDropIco">
                        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                          <rect width="44" height="44" rx="12" fill="var(--accent)" fillOpacity=".1"/>
                          <path d="M22 29V18M17 23l5-5 5 5" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14 33h16" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="fxvDropTitle">Arrastre un XML aquí</div>
                      <div className="fxvDropSub">o haga clic para seleccionar el archivo</div>
                      <div className="fxvDropFormats">
                        <span>XML</span><span>Hacienda CR</span><span>FE v4.4</span>
                      </div>
                      <input id="xmlFileInput" type="file" accept=".xml,text/xml,application/xml" style={{display:"none"}}
                        onChange={e => handleXmlFile(e.target.files[0])} />
                    </div>
                  )}
                  {feXmlError && <div className="alertBox">{IC.warning} {feXmlError}</div>}
                  {feXmlData && (
                    <>
                      <XmlFacturaResult
                        data={feXmlData}
                        fl={fl} flash={flash}
                        cabysValidation={cabysValidation}
                        soloInconsistencias={soloInconsistencias}
                        setSoloInconsistencias={setSoloInconsistencias}
                        onCabysClick={(item) => setXmlDrawerItem(item)}
                        onPrint={printXmlFe}
                        onReset={() => { setFeXmlData(null); setFeXmlError(""); setCabysValidation({}) }}
                        onExcelDownload={() => {
                          if (!feXmlData.lines.length) return
                          downloadXlsx("factura_detalle.xlsx", "Detalle",
                            feXmlData.lines.map(l => ({ descripcion:l.descripcion, cantidad:l.cantidad, unidad:l.unidad, precio:l.precio, iva:`${l.ivaPct}%`, total:l.total, cabys:l.cabys })),
                            ["descripcion","cantidad","unidad","precio","iva","total","cabys"])
                        }}
                      />
                      <CabysDrawer
                        item={xmlDrawerItem}
                        relatedItems={[]}
                        fl={fl} flash={flash}
                        favs={cabysF_avs}
                        onToggleFav={toggleFav}
                        onClose={() => setXmlDrawerItem(null)}
                        onSelectRelated={() => {}}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ EXONERACIONES ══ */}
          {page === "exoneraciones" && (
            <div className="pageWrap pageCentered" style={{ maxWidth: 760 }}>
              <PageHeader icon={IC.shield} title="Exoneraciones"
                description="Verificá si una entidad tiene exoneración de impuestos registrada en Hacienda."
                onClear={(exoData || exoError) ? () => { setExoData(null); setExoQ(""); setExoError(""); setExoSearched(false) } : null} />

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

          {/* ══ CLIENTES ══ */}
          {page === "clientes" && (
            <ClientesPage
              navigate={navigate}
              setCabysQ={setCabysQ}
              consultarCabysRef={consultarCabysRef}
              setCabysPage={setCabysPage}
            />
          )}

          {/* ══ ACERCA DE ══ */}
          {page === "acerca" && <AcercaPage activities={activities} />}

        </main>

        <footer className="footerBar">
          Datos: Ministerio de Hacienda · BCCR
        </footer>
      </div>
    </div>
  )
}

/* ─── ClientesPage ─── */
const LS_CLIENTS = "hk_clients"

function loadClients() {
  try { return JSON.parse(localStorage.getItem(LS_CLIENTS) || "[]") } catch { return [] }
}
function saveClients(list) {
  try { localStorage.setItem(LS_CLIENTS, JSON.stringify(list)) } catch (_e) { /* silencioso */ }
}

function ClientesPage({ navigate, setCabysQ, consultarCabysRef, setCabysPage }) {
  const [clients,   setClients]   = useState(() => loadClients())
  const [selected,  setSelected]  = useState(null) // id del cliente en vista detalle
  const [showForm,  setShowForm]  = useState(false)
  const [editMode,  setEditMode]  = useState(false)
  const [form,      setForm]      = useState({ nombre: "", identificacion: "", notas: "" })

  const persist = (list) => { setClients(list); saveClients(list) }

  const openNew = () => {
    setForm({ nombre: "", identificacion: "", notas: "" })
    setEditMode(false); setShowForm(true)
  }

  const openEdit = (c) => {
    setForm({ nombre: c.nombre, identificacion: c.identificacion, notas: c.notas || "" })
    setEditMode(true); setShowForm(true)
  }

  const saveForm = () => {
    if (!form.nombre.trim()) return
    if (editMode) {
      persist(clients.map(c => c.id === selected ? { ...c, ...form } : c))
    } else {
      const nuevo = { id: Date.now().toString(), ...form, favsCabys: [], historial: [], createdAt: new Date().toISOString() }
      const next = [...clients, nuevo]
      persist(next); setSelected(nuevo.id)
    }
    setShowForm(false)
  }

  const deleteClient = (id) => {
    if (!confirm("¿Eliminar este cliente?")) return
    persist(clients.filter(c => c.id !== id)); setSelected(null)
  }

  const _addFavToClient = (clientId, cabysItem) => {
    persist(clients.map(c => {
      if (c.id !== clientId) return c
      const already = c.favsCabys.some(f => f.codigo === cabysItem.codigo)
      if (already) return c
      return { ...c, favsCabys: [...(c.favsCabys || []), { codigo: cabysItem.codigo, descripcion: cabysItem.descripcion, impuesto: cabysItem.impuesto }] }
    }))
  }

  const removeFavFromClient = (clientId, codigo) => {
    persist(clients.map(c => c.id !== clientId ? c : { ...c, favsCabys: c.favsCabys.filter(f => f.codigo !== codigo) }))
  }

  const _addHistToClient = (clientId, q) => {
    persist(clients.map(c => {
      if (c.id !== clientId) return c
      const hist = [q, ...(c.historial || []).filter(h => h !== q)].slice(0, 10)
      return { ...c, historial: hist }
    }))
  }

  const client = clients.find(c => c.id === selected)

  // Vista detalle
  if (selected && client) {
    return (
      <div className="pageWrap pageCentered clienteFichaWrap">
        <button className="clienteFichaBack" type="button" onClick={() => setSelected(null)}>
          ← Volver a Clientes
        </button>

        <div className="clienteFichaCard">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div className="clienteFichaName">{client.nombre}</div>
              {client.identificacion && <div className="clienteFichaId">{client.identificacion}</div>}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button type="button" className="btn btnGhost btnSm" onClick={() => openEdit(client)}>Editar</button>
              <button type="button" className="btn btnGhost btnSm" style={{ color:"#dc2626" }}
                onClick={() => deleteClient(client.id)}>Eliminar</button>
            </div>
          </div>

          {client.notas && (
            <div className="clienteFichaSection">
              <div className="clienteFichaSectionTitle">Notas</div>
              <div className="clienteFichaNotas">{client.notas}</div>
            </div>
          )}

          {/* Favoritos CABYS */}
          <div className="clienteFichaSection">
            <div className="clienteFichaSectionTitle">Favoritos CABYS ({client.favsCabys?.length || 0})</div>
            {client.favsCabys?.length > 0 ? (
              <div className="clienteFichaFavs">
                {client.favsCabys.map(f => (
                  <div key={f.codigo} className="clienteFichaFavRow">
                    <span className="clienteFichaFavCode">{f.codigo}</span>
                    <span className="clienteFichaFavDesc">{f.descripcion}</span>
                    <span style={{ fontSize:10, color:"var(--muted)", marginLeft:6 }}>{f.impuesto}%</span>
                    <button className="clienteFichaFavDel" type="button"
                      onClick={() => removeFavFromClient(client.id, f.codigo)} title="Quitar">✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="clienteFichaEmpty">
                Sin favoritos aún. Podés guardar CABYS desde la búsqueda y asignarlos aquí.
              </div>
            )}
          </div>

          {/* Historial */}
          <div className="clienteFichaSection">
            <div className="clienteFichaSectionTitle">Historial de consultas ({client.historial?.length || 0})</div>
            {client.historial?.length > 0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {client.historial.map((h, i) => (
                  <div key={i} className="clienteFichaHistRow">
                    <span>{h}</span>
                    <button type="button" style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:11, padding:0 }}
                      onClick={() => {
                        setCabysQ(h); setCabysPage(0); navigate("cabys")
                        setTimeout(() => consultarCabysRef.current?.({ reset:true, q:h }), 60)
                      }}>Buscar →</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="clienteFichaEmpty">Sin consultas registradas.</div>
            )}
          </div>
        </div>

        {showForm && (
          <div className="clienteModal" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
            <div className="clienteModalCard">
              <div className="clienteModalTitle">Editar cliente</div>
              <div className="clienteFormRow">
                <label className="clienteFormLbl">Nombre</label>
                <input className="clienteFormInput" value={form.nombre} placeholder="Nombre del cliente"
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="clienteFormRow">
                <label className="clienteFormLbl">Identificación</label>
                <input className="clienteFormInput" value={form.identificacion} placeholder="Cédula, NITE, pasaporte…"
                  onChange={e => setForm(f => ({ ...f, identificacion: e.target.value }))} />
              </div>
              <div className="clienteFormRow">
                <label className="clienteFormLbl">Notas</label>
                <textarea className="clienteFormInput clienteFormTextarea" value={form.notas} placeholder="Actividad económica, régimen, observaciones…"
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
              <div className="clienteModalBtns">
                <button type="button" className="btn btnGhost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="button" className="btn btnPrimary" onClick={saveForm} disabled={!form.nombre.trim()}>Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Vista lista
  return (
    <div className="pageWrap pageCentered clientesWrap">
      <div className="clientesHeader">
        <div className="clientesHeaderTitle">Clientes</div>
        <button type="button" className="btn btnPrimary" onClick={openNew}>+ Nuevo cliente</button>
      </div>

      {clients.length === 0 ? (
        <div className="clienteEmpty">
          <div className="clienteEmptyIcon">🏢</div>
          <div className="clienteEmptyTitle">Sin clientes aún</div>
          <div className="clienteEmptyDesc">Creá tu primer cliente para organizar favoritos CABYS, historial y notas por empresa.</div>
          <button type="button" className="btn btnPrimary" style={{ marginTop:16 }} onClick={openNew}>Crear primer cliente</button>
        </div>
      ) : (
        <div className="clientesGrid">
          {clients.map(c => (
            <div key={c.id} className="clienteCard" onClick={() => setSelected(c.id)}>
              <div className="clienteCardName">{c.nombre}</div>
              {c.identificacion && <div className="clienteCardId">{c.identificacion}</div>}
              <div className="clienteCardMeta">
                {(c.favsCabys?.length > 0) && <span className="clienteCardChip">⭐ {c.favsCabys.length} CABYS</span>}
                {(c.historial?.length > 0) && <span className="clienteCardChip">🕒 {c.historial.length} búsquedas</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="clienteModal" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="clienteModalCard">
            <div className="clienteModalTitle">Nuevo cliente</div>
            <div className="clienteFormRow">
              <label className="clienteFormLbl">Nombre *</label>
              <input className="clienteFormInput" value={form.nombre} placeholder="Nombre del cliente o empresa"
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") saveForm() }} autoFocus />
            </div>
            <div className="clienteFormRow">
              <label className="clienteFormLbl">Identificación</label>
              <input className="clienteFormInput" value={form.identificacion} placeholder="Cédula, NITE, pasaporte…"
                onChange={e => setForm(f => ({ ...f, identificacion: e.target.value }))} />
            </div>
            <div className="clienteFormRow">
              <label className="clienteFormLbl">Notas</label>
              <textarea className="clienteFormInput clienteFormTextarea" value={form.notas} placeholder="Actividad económica, régimen, observaciones…"
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div className="clienteModalBtns">
              <button type="button" className="btn btnGhost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="button" className="btn btnPrimary" onClick={saveForm} disabled={!form.nombre.trim()}>Crear cliente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── AcercaPage ─── */
function AcercaPage({ activities }) {
  const favCount   = loadFavs().length
  const actCount   = activities.length
  const histCount  = ["ht_cabys","ht_ae"].reduce((n,k) => n + loadH(k).length, 0)

  const TOOLS = [
    { icon:IC.search,   name:"Asistente CABYS",          desc:"Búsqueda de códigos por producto, actividad o descripción de negocio" },
    { icon:IC.user,     name:"Consulta de Contribuyentes",desc:"Estado fiscal, régimen tributario y actividades económicas registradas" },
    { icon:IC.receipt,  name:"Facturas Electrónicas",     desc:"Validación de comprobantes por clave numérica de 50 dígitos" },
    { icon:IC.xml,      name:"Validación XML",            desc:"Análisis completo de archivos XML con detalle de líneas y CABYS" },
    { icon:IC.currency, name:"Tipo de Cambio",            desc:"USD y EUR en tiempo real con historial 30 días y conversor 3 divisas" },
    { icon:IC.shield,   name:"Exoneraciones",             desc:"Verificación de exoneraciones de impuestos registradas en Hacienda" },
    { icon:IC.star,     name:"Favoritos CABYS",           desc:"Guardado y acceso rápido a los códigos CABYS más usados" },
    { icon:IC.clock,    name:"Historial Inteligente",     desc:"Registro de consultas recientes para retomar cualquier búsqueda" },
  ]

  const SOURCES = [
    { name:"Ministerio de Hacienda de Costa Rica", url:"api.hacienda.go.cr",       desc:"CABYS, Contribuyentes, Facturas, Exoneraciones, Tipo de Cambio",  color:"#f0fdf4", dot:"#16a34a" },
    { name:"Banco Central de Costa Rica (BCCR)",   url:"gee.bccr.fi.cr",           desc:"Indicadores económicos, tipo de cambio histórico USD/CRC",         color:"#eff6ff", dot:"#2563eb" },
  ]

  const TECH = [
    { name:"React 19",     color:"#0891b2", bg:"#ecfeff" },
    { name:"Vite 7",       color:"#7c3aed", bg:"#f5f3ff" },
    { name:"JavaScript",   color:"#b45309", bg:"#fffbeb" },
  ]

  const STATS = [
    { label:"Consultas realizadas", value:actCount,  icon:"🔍", desc:"registradas en esta sesión" },
    { label:"Favoritos guardados",  value:favCount,  icon:"⭐", desc:"códigos CABYS en favoritos" },
    { label:"Historial almacenado", value:histCount, icon:"🕒", desc:"búsquedas en historial local" },
  ]

  return (
    <div className="pageWrap pageCentered acercaWrap">

      {/* ── Hero Card ── */}
      <div className="acercaHero">
        <div className="acercaHeroLeft">
          <div className="acercaLogo">
            {IC.bolt}
          </div>
          <div>
            <h1 className="acercaAppName">HaciendaKit</h1>
            <p className="acercaTagline">Plataforma de consulta tributaria y herramientas fiscales para Costa Rica.</p>
          </div>
        </div>
        <div className="acercaMeta">
          <div className="acercaMetaItem">
            <span className="acercaMetaLabel">Versión</span>
            <span className="acercaVersionBadge">v1.0.0</span>
          </div>
          <div className="acercaMetaItem">
            <span className="acercaMetaLabel">Última actualización</span>
            <span className="acercaMetaVal">Junio 2026</span>
          </div>
          <div className="acercaMetaItem">
            <span className="acercaMetaLabel">Desarrollado por</span>
            <span className="acercaMetaVal acercaAuthor">Jean Monge</span>
          </div>
        </div>
      </div>

      {/* ── Herramientas disponibles ── */}
      <div className="acercaSection">
        <div className="acercaSectionHeader">
          <div className="acercaSectionTitle">Herramientas disponibles</div>
          <span className="acercaBadgeCount">{TOOLS.length}</span>
        </div>
        <div className="acercaToolsGrid">
          {TOOLS.map((t, i) => (
            <div key={i} className="acercaToolCard">
              <div className="acercaToolIcon">{t.icon}</div>
              <div>
                <div className="acercaToolName">{t.name}</div>
                <div className="acercaToolDesc">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Estadísticas ── */}
      <div className="acercaSection">
        <div className="acercaSectionHeader">
          <div className="acercaSectionTitle">Estadísticas de uso</div>
          <span className="acercaMetaLabel">datos locales · este dispositivo</span>
        </div>
        <div className="acercaStatsRow">
          {STATS.map((s, i) => (
            <div key={i} className="acercaStatCard">
              <div className="acercaStatIcon">{s.icon}</div>
              <div className="acercaStatVal">{s.value}</div>
              <div className="acercaStatLabel">{s.label}</div>
              <div className="acercaStatDesc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fuentes de información ── */}
      <div className="acercaSection">
        <div className="acercaSectionHeader">
          <div className="acercaSectionTitle">Fuentes de información</div>
        </div>
        <div className="acercaSourcesList">
          {SOURCES.map((s, i) => (
            <div key={i} className="acercaSourceCard" style={{ background: s.color }}>
              <div className="acercaSourceDot" style={{ background: s.dot }} />
              <div>
                <div className="acercaSourceName">{s.name}</div>
                <div className="acercaSourceUrl">{s.url}</div>
                <div className="acercaSourceDesc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="acercaDisclaimer">
          <div className="acercaDisclaimerIcon">{IC.warning}</div>
          <p>
            <strong>HaciendaKit</strong> no es un producto oficial del Ministerio de Hacienda ni del Banco Central de Costa Rica. La información mostrada proviene de fuentes públicas y <strong>debe verificarse para procesos oficiales</strong>. Para trámites formales, consultá directamente con Hacienda o un profesional tributario certificado.
          </p>
        </div>
      </div>

      {/* ── Tecnologías ── */}
      <div className="acercaSection">
        <div className="acercaSectionHeader">
          <div className="acercaSectionTitle">Tecnologías utilizadas</div>
        </div>
        <div className="acercaTechRow">
          {TECH.map((t, i) => (
            <div key={i} className="acercaTechBadge" style={{ background: t.bg, color: t.color }}>
              {t.name}
            </div>
          ))}
          <div className="acercaTechBadge" style={{ background:"#f0fdf4", color:"#16a34a" }}>APIs Públicas CR</div>
        </div>
        <p className="acercaFootNote">
          Aplicación de página única (SPA) sin backend propio. Todas las consultas se realizan directamente a las APIs públicas de las instituciones costarricenses. Los datos se almacenan únicamente en el dispositivo del usuario.
        </p>
      </div>

    </div>
  )
}

/* ─── XmlFacturaResult ─── */
function XmlFacturaResult({ data, fl, flash, cabysValidation = {}, soloInconsistencias = false, setSoloInconsistencias, onCabysClick, onPrint, onReset, onExcelDownload }) {
  const mon = data.resumen.moneda || "CRC"
  const tc  = data.resumen.tipoCambio ? parseFloat(data.resumen.tipoCambio) : null
  const isUsd = mon === "USD", isEur = mon === "EUR"

  // Montos en moneda ORIGINAL — sin convertir
  const fmtM = (v) => {
    const n = parseFloat(v || 0)
    if (isNaN(n)) return "—"
    const f = new Intl.NumberFormat("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })
    if (isUsd) return `$${f.format(n)}`
    if (isEur) return `€${f.format(n)}`
    return `₡${f.format(n)}`
  }

  // 13.00000 → "13%"  |  2.50000 → "2.5%"
  const fmtPct = (v) => {
    if (!v) return null
    const n = parseFloat(v)
    return isNaN(n) ? null : `${parseFloat(n.toFixed(4))}%`
  }

  // 1.00000 → "1"  |  2.50000 → "2.5"
  const fmtQty = (v) => {
    if (!v) return v
    const n = parseFloat(v)
    return isNaN(n) ? v : String(parseFloat(n.toFixed(6)))
  }

  const fmtTc = tc && tc > 0
    ? new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(tc)
    : null



  return (
    <div>
      <div className="xmlResult" id="xmlPrintArea">

        {/* ── Encabezado ── */}
        <div className="xmlResultHead">
          <div className={`xmlDocType${data.rootTag==="NotaCreditoElectronica"?" xmlDocType-nc":data.rootTag==="NotaDebitoElectronica"?" xmlDocType-nd":data.rootTag==="TiqueteElectronico"?" xmlDocType-tiquete":data.rootTag==="FacturaElectronicaCompra"?" xmlDocType-compra":""}`}>{data.tipoDoc}</div>
          {data.numConsecutivo && (
            <div className="xmlHeadField">
              <span className="xmlHeadLbl">Consecutivo</span>
              <div className="xmlHeadRow">
                <span className="xmlConsec mono">{data.numConsecutivo}</span>
                <button className={`xmlCopyBtn${fl==="xml-consec"?" xmlCopyBtnOk":""}`} type="button"
                  onClick={() => flash("xml-consec", data.numConsecutivo)} title="Copiar consecutivo">
                  {fl==="xml-consec" ? "✓" : <CopyIco/>}
                </button>
              </div>
            </div>
          )}
          {data.clave && (
            <div className="xmlHeadField">
              <span className="xmlHeadLbl">Clave</span>
              <div className="xmlHeadRow">
                <span className="xmlClave mono">{data.clave}</span>
                <button className={`xmlCopyBtn${fl==="xml-clave"?" xmlCopyBtnOk":""}`} type="button"
                  onClick={() => flash("xml-clave", data.clave)} title="Copiar clave">
                  {fl==="xml-clave" ? "✓" : <CopyIco/>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Emisor / Receptor ── */}
        <div className="xmlParties">
          <div className="xmlParty">
            <div className="xmlPartyLabel">Emisor</div>
            <div className="xmlPartyName">{data.emisor.nombre || "—"}</div>
            {data.emisor.comercial && <div className="xmlPartyComm">{data.emisor.comercial}</div>}
            {data.emisor.cedula && <div className="xmlPartyCed mono">{data.emisor.cedula}</div>}
            {data.emisor.correo && <div className="xmlPartySub">{data.emisor.correo}</div>}
          </div>
          {(data.receptor.nombre || data.receptor.cedula) && (
            <div className="xmlParty">
              <div className="xmlPartyLabel">Receptor</div>
              <div className="xmlPartyName">{data.receptor.nombre || "—"}</div>
              {data.receptor.cedula && <div className="xmlPartyCed mono">{data.receptor.cedula}</div>}
              {data.receptor.correo && <div className="xmlPartySub">{data.receptor.correo}</div>}
            </div>
          )}
        </div>

        {/* ── Meta ── */}
        <div className="xmlMeta">
          {data.fecha && (
            <div className="xmlMetaItem"><span>Fecha</span><span>{formatFechaCR(data.fecha)}</span></div>
          )}
          <div className="xmlMetaItem">
            <span>Moneda</span>
            <span className={`xmlMonTag xmlMonTag-${mon.toLowerCase()}`}>{mon}</span>
          </div>
          {fmtTc && !(mon === "CRC" && tc === 1) && (
            <div className="xmlMetaItem"><span>Tipo de cambio</span><span className="mono">{isUsd ? "$" : isEur ? "€" : "₡"}{fmtTc}</span></div>
          )}
          {data.condicionVenta && (
            <div className="xmlMetaItem">
              <span>Condición de venta</span>
              <span>{{"01":"Contado","02":"Crédito","03":"Consignación","04":"Apartado","99":"Otros"}[data.condicionVenta] || data.condicionVenta}</span>
            </div>
          )}
        </div>

        {/* ── Documento Relacionado (Notas de Crédito / Débito) ── */}
        {data.referencias && data.referencias.length > 0 && (
          <div className="xmlRef">
            {data.referencias.map((r, i) => {
              const isNc = data.rootTag === "NotaCreditoElectronica"
              const isNd = data.rootTag === "NotaDebitoElectronica"
              const bannerCls = `xmlRefBanner${isNc ? " xmlRefBanner-nc" : isNd ? " xmlRefBanner-nd" : ""}`
              const badgeCls  = `xmlRefBannerBadge${isNc ? " xmlRefBannerBadge-nc" : isNd ? " xmlRefBannerBadge-nd" : " xmlRefBannerBadge-default"}`
              return (
                <div key={i} className={bannerCls}>
                  <div className="xmlRefBannerHead">
                    <span className="xmlRefBannerType">Documento Relacionado</span>
                    {r.tipoDoc && (
                      <span className={badgeCls}>{data.tiposRefDoc?.[r.tipoDoc] || r.tipoDoc}</span>
                    )}
                  </div>
                  <div className="xmlRefBody">
                    {r.numero && (
                      <div className="xmlRefField xmlRefField-full">
                        <span className="xmlRefLbl">Clave / Consecutivo</span>
                        <span className="xmlRefVal xmlRefNumero">{r.numero}</span>
                      </div>
                    )}
                    {r.fechaRef && (
                      <div className="xmlRefField">
                        <span className="xmlRefLbl">Fecha</span>
                        <span className="xmlRefVal">{formatFechaCR(r.fechaRef)}</span>
                      </div>
                    )}
                    {r.codigo && (
                      <div className="xmlRefField">
                        <span className="xmlRefLbl">Código de referencia</span>
                        <span className="xmlRefVal">{data.codigosRef?.[r.codigo] || r.codigo}</span>
                      </div>
                    )}
                    {r.razon && (
                      <div className="xmlRefField xmlRefField-full">
                        <span className="xmlRefLbl">Motivo</span>
                        <span className="xmlRefVal xmlRefRazon">{r.razon}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Resumen de validaciones ── */}
        {data.lines.length > 0 && Object.keys(cabysValidation).length > 0 && (() => {
          const loading = Object.values(cabysValidation).some(v => v.status === "loading")
          const BANNER_SVC_UNITS = ["Sp","Al","Os","Spe","m2e"]
          // Por línea: calcular todos los avisos
          const lineStats = data.lines.map(l => {
            if (!l.cabys) return { cabysStatus: null, ivaMismatch: false, tipoAviso: false }
            const cv = cabysValidation[l.cabys] || {}
            const ivaMismatch = cv.status === "ok" && cv.impuesto !== null && l.ivaPct !== undefined && l.ivaPct !== ""
              ? parseFloat(l.ivaPct) !== cv.impuesto
              : false
            const cabysEsSvc = cabysEsServicio(l.cabys)
            const xmlEsSvc = l.unidad ? BANNER_SVC_UNITS.includes(l.unidad) : null
            const tipoAviso = cv.status === "ok" && cabysEsSvc !== null && xmlEsSvc !== null && cabysEsSvc !== xmlEsSvc
            return { cabysStatus: cv.status, ivaMismatch, tipoAviso }
          })
          const nOk      = lineStats.filter(v => v.cabysStatus === "ok" && !v.ivaMismatch && !v.tipoAviso).length
          const nNf      = lineStats.filter(v => v.cabysStatus === "nf").length
          const nErr     = lineStats.filter(v => v.cabysStatus === "err").length
          const nIvaDiff = lineStats.filter(v => v.ivaMismatch).length
          const nTipo    = lineStats.filter(v => v.tipoAviso).length
          const hasWarn  = nNf > 0 || nIvaDiff > 0 || nTipo > 0
          const totalInconsistencias = nNf + nIvaDiff + nTipo
          return (
            <div className={`xmlCabysValidBanner${hasWarn ? " xmlCabysValidBannerWarn" : " xmlCabysValidBannerOk"}`}>
              <span className="xmlCabysValidTitle">Validación tributaria</span>
              {loading ? (
                <span className="xmlCabysValidItem">Verificando…</span>
              ) : (
                <div className="xmlValidBannerItems">
                  {nOk  > 0 && <span className="xmlCabysValidOk">✔ {nOk} línea{nOk !== 1 ? "s" : ""} correcta{nOk !== 1 ? "s" : ""}</span>}
                  {nIvaDiff > 0 && <span className="xmlCabysValidNf">⚠ {nIvaDiff} diferencia{nIvaDiff !== 1 ? "s" : ""} de IVA</span>}
                  {nTipo  > 0 && <span className="xmlCabysValidTipo">⚠ {nTipo} verificar tipo</span>}
                  {nNf  > 0 && <span className="xmlCabysValidNf">⚠ {nNf} CABYS no encontrado{nNf !== 1 ? "s" : ""}</span>}
                  {nErr > 0 && <span className="xmlCabysValidErr">⚠ {nErr} sin verificar</span>}
                  {totalInconsistencias > 0 && (
                    <button
                      className={`xmlFilterToggle${soloInconsistencias ? " xmlFilterToggleActive" : ""}`}
                      type="button"
                      onClick={() => setSoloInconsistencias(v => !v)}
                    >
                      {soloInconsistencias ? "Ver todas las líneas" : "Ver solo inconsistencias"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Líneas de detalle ── */}
        {data.lines.length > 0 && (
          <div className="xmlLines">
            <div className="xmlLinesTitle">Detalle de líneas ({data.lines.length})</div>
            <div className="xmlTableWrap">
              <table className="xmlLinesTable">
                <thead>
                  <tr>
                    <th className="xmlThNum">#</th>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th className="xmlThR">Precio unitario</th>
                    <th>IVA</th>
                    <th className="xmlThR">Total línea</th>
                    <th>CABYS</th>
                    <th className="xmlThCabysVal">Validaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l, i) => {
                    const pct = fmtPct(l.ivaPct)
                    const cid = `xml-c-${i}`
                    const cv = l.cabys ? cabysValidation[l.cabys] : null
                    const cvStatus = cv?.status
                    // IVA mismatch: XML vs oficial CABYS
                    const ivaMismatch = cvStatus === "ok" && cv.impuesto !== null && l.ivaPct !== undefined && l.ivaPct !== ""
                      ? parseFloat(l.ivaPct) !== cv.impuesto
                      : false
                    // Tipo: inferir de unidad XML vs CABYS (advertencia suave, solo informativa)
                    const XML_SVC_UNITS = ["Sp","Al","Os","Spe","m2e"]
                    const cabysEsSvc = l.cabys ? cabysEsServicio(l.cabys) : null
                    const xmlEsSvc = l.unidad ? XML_SVC_UNITS.includes(l.unidad) : null
                    const tipoAviso = cvStatus === "ok" && cabysEsSvc !== null && xmlEsSvc !== null && cabysEsSvc !== xmlEsSvc
                    const hasRowWarn = ivaMismatch || cvStatus === "nf" || tipoAviso
                    // Filtro: ocultar si soloInconsistencias y la fila no tiene problema
                    if (soloInconsistencias && !hasRowWarn) return null
                    const rowClass = (ivaMismatch || cvStatus === "nf") ? "xmlRowWarn" : tipoAviso ? "xmlRowTipo" : ""
                    return (
                      <tr key={i} className={rowClass}>
                        <td className="xmlTdNum">{i + 1}</td>
                        <td className="xmlTdDesc">{l.descripcion}</td>
                        <td className="mono xmlTdQty">{fmtQty(l.cantidad)} <span className="xmlUnt">{l.unidad}</span></td>
                        <td className="mono xmlTdR">{l.precio ? fmtM(l.precio) : "—"}</td>
                        <td>{pct ? <span className={`taxBadgeV2 ${taxClass(parseFloat(l.ivaPct))}`}>{pct}</span> : <span className="xmlMuted">—</span>}</td>
                        <td className="mono xmlTdR xmlTdBold">{l.total ? fmtM(l.total) : "—"}</td>
                        <td className="mono xmlTdCabys">
                          {l.cabys ? (
                            <div className="xmlCabysCell">
                              {cvStatus === "ok" && onCabysClick ? (
                                <button
                                  className="xmlCabysCodeBtn"
                                  type="button"
                                  title="Ver detalle CABYS"
                                  onClick={() => onCabysClick({
                                    codigo: l.cabys,
                                    descripcion: cv.descripcion || l.descripcion,
                                    impuesto: cv.impuesto ?? 0,
                                    categorias: cv.categorias || []
                                  })}
                                >
                                  {l.cabys}
                                </button>
                              ) : (
                                <span className="xmlCabysCode">{l.cabys}</span>
                              )}
                              <button className={`xmlCopyBtn${fl===cid?" xmlCopyBtnOk":""}`} type="button"
                                onClick={() => flash(cid, l.cabys)} title="Copiar CABYS">
                                {fl===cid ? "✓" : <CopyIco/>}
                              </button>
                            </div>
                          ) : <span className="xmlMuted">—</span>}
                        </td>
                        <td className="xmlTdCabysVal">
                          {!l.cabys ? (
                            <span className="xmlMuted">—</span>
                          ) : cvStatus === "loading" ? (
                            <span className="xmlCabysValLoading">···</span>
                          ) : cvStatus === "nf" ? (
                            <span className="xmlCabysValNf">⚠ No encontrado en CABYS</span>
                          ) : cvStatus === "err" ? (
                            <span className="xmlCabysValErr">⚠ Sin verificar</span>
                          ) : cvStatus === "ok" ? (
                            <div className="xmlCabysValGroup">
                              <span className="xmlCabysValOk">✔ CABYS válido</span>
                              {ivaMismatch ? (
                                <span className="xmlCabysValMismatch">⚠ IVA XML: {parseFloat(l.ivaPct)}% / esperado: {cv.impuesto}%</span>
                              ) : (
                                <span className="xmlCabysValOk">✔ IVA correcto</span>
                              )}
                              <span className={`cabysTypeBadge${cabysEsSvc ? " cabysTypeSvc" : " cabysTypeArt"}`}>
                                🏷 {cabysEsSvc ? "Servicio" : "Artículo"}
                              </span>
                              {tipoAviso && (
                                <span className="xmlCabysValTipoAviso" title={`CABYS clasifica como ${cabysEsSvc ? "Servicio" : "Artículo"} pero la unidad XML es "${l.unidad}"`}>
                                  Verificar tipo
                                </span>
                              )}
                            </div>
                          ) : <span className="xmlMuted">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Totales ── */}
        <div className="xmlTotals">
          {data.resumen.totalVenta && parseFloat(data.resumen.totalVenta) > 0 &&
            <div className="xmlTotalRow"><span>Subtotal</span><span className="mono">{fmtM(data.resumen.totalVenta)}</span></div>}
          {data.resumen.totalDesc && parseFloat(data.resumen.totalDesc) > 0 &&
            <div className="xmlTotalRow"><span>Descuentos</span><span className="mono xmlTotalDisc">− {fmtM(data.resumen.totalDesc)}</span></div>}
          {data.resumen.totalImpuesto && parseFloat(data.resumen.totalImpuesto) > 0 &&
            <div className="xmlTotalRow"><span>IVA</span><span className="mono">{fmtM(data.resumen.totalImpuesto)}</span></div>}
          {data.resumen.total && (
            <div className="xmlTotalRow xmlTotalFinal">
              <span>TOTAL</span>
              <span className="mono">{fmtM(data.resumen.total)}</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Acciones ── */}
      <div className="xmlActions">
        <button type="button" className="btn btnPrimary" onClick={onPrint}>🖨 Imprimir / PDF</button>
        <CopyBtn id="xml-copy" label="Copiar resumen" fl={fl} flash={flash} disabled={false}
          getText={() => [data.tipoDoc,
            `Emisor: ${data.emisor.nombre}`,
            data.receptor.nombre ? `Receptor: ${data.receptor.nombre}` : "",
            data.fecha ? `Fecha: ${formatFechaCR(data.fecha)}` : "",
            data.resumen.total ? `Total: ${fmtM(data.resumen.total)}` : "",
            data.clave ? `Clave: ${data.clave}` : "",
          ].filter(Boolean).join("\n")} />
        {data.lines.length > 0 && (
          <button type="button" className="btn btnGhost" onClick={onExcelDownload}>Exportar Excel</button>
        )}
        <button type="button" className="btn btnGhost" onClick={onReset}>← Cargar otro XML</button>
      </div>

      {/* ── Aviso legal ── */}
      {data.lines.length > 0 && Object.keys(cabysValidation).length > 0 && (
        <div className="xmlLegalDisclaimer">
          La validación es informativa y no sustituye la revisión tributaria profesional. Los datos se contrastan con la API pública de Hacienda en tiempo real. Ante cualquier duda consulte a un contador autorizado.
        </div>
      )}
    </div>
  )
}

/* ─── CURRENCIES constant ─── */
const CURRENCIES = [
  { id: "crc", flag: "🇨🇷", code: "CRC", name: "Colón costarricense", symbol: "₡" },
  { id: "usd", flag: "🇺🇸", code: "USD", name: "Dólar estadounidense", symbol: "$" },
  { id: "eur", flag: "🇪🇺", code: "EUR", name: "Euro",                  symbol: "€" },
]

/* ─── Currency Selector ─── */
function CurrencySelector({ value, onChange, exclude = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const opts = CURRENCIES.filter(c => !exclude.includes(c.id))
  const sel  = CURRENCIES.find(c => c.id === value)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  return (
    <div className="currSel" ref={ref}>
      <button type="button" className="currSelBtn" onClick={() => setOpen(o => !o)}>
        <span className="currSelFlag">{sel.flag}</span>
        <span className="currSelCode">{sel.code}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`currSelArrow${open ? " open" : ""}`}>
          <path d="M1.5 3.5l3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="currSelDrop">
          {opts.map(c => (
            <button key={c.id} type="button"
              className={`currSelOpt${c.id === value ? " currSelOptAct" : ""}`}
              onClick={() => { onChange(c.id); setOpen(false) }}>
              <span className="currSelOptFlag">{c.flag}</span>
              <div>
                <div className="currSelOptCode">{c.code}</div>
                <div className="currSelOptName">{c.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Conversor Wise ─── */
function ConversorWise({ fx, fxEur, convFrom, setConvFrom, convTo, setConvTo, convAmount, setConvAmount, convResult }) {
  const fmtOut = (n, id) => {
    if (n == null || isNaN(n)) return ""
    const dec = id === "crc" ? 2 : 4
    return n.toLocaleString("es-CR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
  }
  const thirdCurr = CURRENCIES.find(c => c.id !== convFrom && c.id !== convTo)
  const handleSwap = () => {
    const tmp = convFrom; setConvFrom(convTo); setConvTo(tmp); setConvAmount("")
  }
  const handleFromChange = (id) => {
    if (id === convTo) setConvTo(convFrom)
    setConvFrom(id); setConvAmount("")
  }
  const handleToChange = (id) => {
    if (id === convFrom) setConvFrom(convTo)
    setConvTo(id)
  }
  const fromCurr = CURRENCIES.find(c => c.id === convFrom)
  const toCurr   = CURRENCIES.find(c => c.id === convTo)
  return (
    <div className="wiseCard">
      {/* ─ Tengo ─ */}
      <div className="wiseSection wiseSectionFrom">
        <div className="wiseSectionLabel">Tengo</div>
        <div className="wiseInputRow">
          <CurrencySelector value={convFrom} onChange={handleFromChange} exclude={[convTo]} />
          <input
            className="wiseAmountInput"
            type="number" min="0" placeholder="0"
            value={convAmount}
            onChange={e => setConvAmount(e.target.value)}
            autoFocus
          />
        </div>
        {convAmount && <div className="wiseAmountHint">{fromCurr.flag} {fromCurr.name}</div>}
      </div>

      {/* ─ Swap ─ */}
      <div className="wiseSwapBar">
        <div className="wiseSwapLine" />
        <button type="button" className="wiseSwapBtn" onClick={handleSwap} title="Invertir">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2v14M5 5.5L9 2l4 3.5M13 12.5L9 16l-4-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="wiseSwapLine" />
      </div>

      {/* ─ Recibo ─ */}
      <div className="wiseSection wiseSectionTo">
        <div className="wiseSectionLabel">Recibo</div>
        <div className="wiseInputRow">
          <CurrencySelector value={convTo} onChange={handleToChange} exclude={[convFrom]} />
          <div className="wiseOutputVal">
            {convResult?.to != null
              ? <span className="wiseResultNum">{fmtOut(convResult.to, convTo)}</span>
              : <span className="wiseResultEmpty">—</span>}
          </div>
        </div>
        {convResult?.to != null && <div className="wiseAmountHint">{toCurr.flag} {toCurr.name}</div>}
      </div>

      {/* ─ También en ─ */}
      {thirdCurr && convResult?.third != null && (
        <div className="wiseThirdRow">
          <span className="wiseThirdLabel">También en {thirdCurr.flag} {thirdCurr.code}:</span>
          <span className="wiseThirdVal">{thirdCurr.symbol} {fmtOut(convResult.third, thirdCurr.id)}</span>
        </div>
      )}

      {/* ─ Footer tasas ─ */}
      <div className="wiseRateBar">
        {fx && (
          <span>
            <strong>1 USD</strong> = ₡{fx.venta.toLocaleString("es-CR")} venta · ₡{fx.compra.toLocaleString("es-CR")} compra
          </span>
        )}
        {fxEur && (
          <span>
            <strong>1 EUR</strong> = ₡{fxEur.colones.toLocaleString("es-CR")} referencia
          </span>
        )}
        <button className="wiseClearBtn" type="button" onClick={() => setConvAmount("")}>Limpiar</button>
      </div>
    </div>
  )
}

/* ─── Sparkline 30 días USD ─── */
function TcSparkline({ data, loading }) {
  if (loading) return (
    <div className="sparkCard sparkLoading">
      <div className="sparkLoadingDots"><span /><span /><span /></div>
      <div className="sparkLoadingText">Cargando historial 30 días…</div>
    </div>
  )
  if (!data || data.length < 5) return null
  const vals = data.map(d => d.venta)
  const min = Math.min(...vals), max = Math.max(...vals), avg = vals.reduce((a,b) => a+b,0)/vals.length
  const first = vals[0], last = vals[vals.length-1]
  const change = last - first, changePct = (change/first)*100, isUp = change >= 0
  const W = 600, H = 90, padX = 2, padY = 6
  const sx = i => padX + (i/(vals.length-1))*(W-padX*2)
  const sy = v => padY + ((max-v)/((max-min)||1))*(H-padY*2)
  const pathD  = vals.map((v,i) => `${i===0?"M":"L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")
  const areaD  = `${pathD} L${sx(vals.length-1).toFixed(1)},${H} L${sx(0).toFixed(1)},${H} Z`
  const color  = isUp ? "#2563eb" : "#dc2626"
  const _colorA = isUp ? "#dbeafe" : "#fee2e2"
  const fmtV = v => `₡${v.toLocaleString("es-CR",{ minimumFractionDigits:2, maximumFractionDigits:2 })}`
  return (
    <div className="sparkCard">
      <div className="sparkHeader">
        <div>
          <div className="sparkTitle">🇺🇸 Dólar — últimos 30 días</div>
          <div className="sparkSub">Tipo de cambio venta · Banco Central de Costa Rica</div>
        </div>
        <div className={`sparkTrend ${isUp ? "sparkTrendUp" : "sparkTrendDown"}`}>
          <span className="sparkTrendPct">{isUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%</span>
          <span className="sparkTrendAbs">{isUp?"+":""}₡{change.toFixed(2)} en 30 días</span>
        </div>
      </div>
      <div className="sparkChartWrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="sparkSvg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#sg)"/>
          <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round"/>
          <circle cx={sx(vals.length-1)} cy={sy(last)} r="4" fill={color} stroke="#fff" strokeWidth="2"/>
        </svg>
        <div className="sparkYaxis">
          <span>{fmtV(max)}</span>
          <span>{fmtV(min)}</span>
        </div>
      </div>
      <div className="sparkStats">
        {[
          { label: "Mínimo",   val: fmtV(min) },
          { label: "Promedio", val: fmtV(avg) },
          { label: "Máximo",   val: fmtV(max) },
          { label: "Actual",   val: fmtV(last), accent: true },
        ].map(s => (
          <div key={s.label} className={`sparkStat${s.accent ? " sparkStatAccent" : ""}`}>
            <div className="sparkStatLabel">{s.label}</div>
            <div className="sparkStatVal">{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
