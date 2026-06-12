/* ─────────────────────────────────────────────
   FORMATTERS — helpers de formato y presentación
───────────────────────────────────────────── */

/** Formatea una fecha ISO a texto en español (CR) */
export function formatFechaCR(fecha) {
  if (!fecha) return ""
  const d = new Date(fecha)
  if (isNaN(d)) return fecha
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })
}

/** Tiempo relativo desde un timestamp ISO */
export function relTime(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return "ahora"
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(ts).toLocaleDateString("es-CR", { day: "numeric", month: "short" })
}

/** Clase CSS para badge de tasa de IVA */
export function taxClass(imp) {
  const n = Number(imp)
  return `t${n === 0 ? 0 : n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 8 ? 8 : n <= 13 ? 13 : 15}`
}

/** Iniciales del nombre (máx 2 palabras) */
export function nameInitials(name) {
  return (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

/** Saludo según la hora del día */
export function saludo() {
  const h = new Date().getHours()
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"
}
