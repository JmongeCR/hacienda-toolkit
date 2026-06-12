import { CABYS_CAT1, CABYS_CAT2 } from "../constants/cabys.js"

/* ─────────────────────────────────────────────
   CABYS HELPERS — jerarquía y clasificación
───────────────────────────────────────────── */

/** Determina si un código CABYS corresponde a un servicio */
export function cabysEsServicio(codigo) {
  const s = String(codigo ?? "").replace(/\D/g, "")
  return s[0] === "8" || s[0] === "9"
}

/** Obtiene la ruta de clasificación de un código CABYS */
export function getCabysHierarchy(codigo) {
  const s = String(codigo ?? "").replace(/\D/g, "")
  if (!s) return []
  const cat1 = CABYS_CAT1[s[0]]
  const cat2 = CABYS_CAT2[s.slice(0, 2)]
  return [cat1, cat2].filter(Boolean)
}
