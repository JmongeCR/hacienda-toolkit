import * as XLSX from "xlsx"

/* ─────────────────────────────────────────────
   EXPORT HELPERS — clipboard, CSV, XLSX
───────────────────────────────────────────── */

/** Copia texto al portapapeles (con fallback) */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch (_e) { /* fallback */ }
  try {
    const ta = document.createElement("textarea")
    ta.value = text; document.body.appendChild(ta); ta.select()
    document.execCommand("copy"); document.body.removeChild(ta); return true
  } catch { return false }
}

/** Genera una cadena CSV escapada */
export function toCsv(rows, headers) {
  const esc = (v) => { const s = String(v ?? ""); const t = s.replace(/"/g, '""'); return /[",\n]/.test(t) ? `"${t}"` : t }
  return `${headers.map(esc).join(",")}\n${rows.map(r => r.map(esc).join(",")).join("\n")}\n`
}

/** Descarga un Blob como archivo */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

/** Descarga filas como archivo XLSX */
export function downloadXlsx(filename, sheetName, rows, headerOrder) {
  const data = rows.map(r => { const o = {}; headerOrder.forEach(h => (o[h] = r[h] ?? "")); return o })
  const ws = XLSX.utils.json_to_sheet(data, { header: headerOrder })
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  downloadBlob(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
}
