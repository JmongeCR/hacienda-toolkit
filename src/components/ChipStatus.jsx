export function ChipStatus({ label, value }) {
  if (!value) return null
  const v = String(value).toUpperCase()
  const cls = v === "NO" ? "chipOk" : (v === "SI" || v === "NO INSCRITO") ? "chipBad" : v === "INSCRITO" ? "chipOk" : ""
  return <span className={`chip ${cls}`}>{label}: {value}</span>
}
