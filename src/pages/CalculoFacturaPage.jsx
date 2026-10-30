import { useMemo, useRef, useState } from "react"
import { taxClass } from "../utils/formatters.js"

const TARIFAS = [
  { codigo: "01", label: "Exento",    pct: 0 },
  { codigo: "02", label: "Exonerado", pct: 0 },
  { codigo: "03", label: "1%",        pct: 1 },
  { codigo: "04", label: "2%",        pct: 2 },
  { codigo: "05", label: "4%",        pct: 4 },
  { codigo: "06", label: "8%",        pct: 8 },
  { codigo: "07", label: "13%",       pct: 13 },
]

const SYM = { CRC: "₡", USD: "$", EUR: "€" }

let nextId = 1
const newLine = () => ({
  id:       nextId++,
  nombre:   "",       // descripción del bien/servicio
  cant:     "1",
  precio:   "",
  tarifa:   "07",
  descPct:  "",       // descuento %
})

function fmtM(n, sym) {
  return sym + n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CalculoFacturaPage() {
  const [lines,       setLines]       = useState([newLine()])
  const [moneda,      setMoneda]      = useState("CRC")
  const [showDisc,    setShowDisc]    = useState(false)
  const lastPrecioRef = useRef({})

  const sym = SYM[moneda] || "₡"

  // ── cómputo por línea ──────────────────────────────────────────
  const computed = useMemo(() => lines.map(l => {
    const cant     = parseFloat(l.cant)    || 0
    const precio   = parseFloat(l.precio)  || 0
    const dPct     = parseFloat(l.descPct) || 0
    const tarifa   = TARIFAS.find(t => t.codigo === l.tarifa) || TARIFAS[6]
    const bruto    = cant * precio
    const descMonto = bruto * dPct / 100
    const sub      = bruto - descMonto
    const ivaMonto = sub * tarifa.pct / 100
    const total    = sub + ivaMonto
    return { ...l, bruto, descMonto, sub, ivaMonto, total, pct: tarifa.pct, tarifaLabel: tarifa.label }
  }), [lines])

  // ── totales ────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const totalVenta   = computed.reduce((s, l) => s + l.bruto,     0)
    const totalDesc    = computed.reduce((s, l) => s + l.descMonto, 0)
    const totalGravado = computed.filter(l => l.pct > 0).reduce((s, l) => s + l.sub, 0)
    const totalExento  = computed.filter(l => l.pct === 0).reduce((s, l) => s + l.sub, 0)
    const totalIva     = computed.reduce((s, l) => s + l.ivaMonto,  0)
    const total        = computed.reduce((s, l) => s + l.total,     0)

    const byTarifa = {}
    computed.forEach(l => {
      if (!byTarifa[l.tarifa]) byTarifa[l.tarifa] = { label: l.tarifaLabel, pct: l.pct, sub: 0, iva: 0 }
      byTarifa[l.tarifa].sub += l.sub
      byTarifa[l.tarifa].iva += l.ivaMonto
    })
    return { totalVenta, totalDesc, totalGravado, totalExento, totalIva, total, byTarifa }
  }, [computed])

  const updateLine = (id, field, value) =>
    setLines(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l))

  const addLine = () => setLines(ls => [...ls, newLine()])

  const removeLine = (id) => {
    if (lines.length === 1) return
    setLines(ls => ls.filter(l => l.id !== id))
  }

  const clearAll = () => {
    nextId = 1
    setLines([newLine()])
    setShowDisc(false)
  }

  const toggleDiscount = () => {
    setShowDisc(v => {
      if (v) setLines(ls => ls.map(l => ({ ...l, descPct: "" })))
      return !v
    })
  }

  // Enter en precio → enfocar siguiente campo o agregar línea
  const handlePrecioKey = (e, lineId) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const idx = lines.findIndex(l => l.id === lineId)
      if (idx === lines.length - 1) {
        addLine()
        setTimeout(() => {
          const inputs = document.querySelectorAll(".calcFInputNombre")
          inputs[inputs.length - 1]?.focus()
        }, 50)
      } else {
        const inputs = document.querySelectorAll(".calcFInputNombre")
        inputs[idx + 1]?.focus()
      }
    }
  }

  const hasAnyTotal = totals.total > 0

  return (
    <div className="pageWrap calcFWrap">

      {/* ── Cabecera ─────────────────────────────────────── */}
      <div className="calcFHeader">
        <div className="calcFTitle">Calculadora de factura</div>
        <div className="calcFHeaderRight">
          <label className="calcFLabel">Moneda</label>
          <select className="calcFMonedaSel" value={moneda} onChange={e => setMoneda(e.target.value)}>
            <option value="CRC">CRC — Colones</option>
            <option value="USD">USD — Dólares</option>
            <option value="EUR">EUR — Euros</option>
          </select>
          {lines.length > 1 && (
            <button type="button" className="calcFClearBtn" onClick={clearAll} title="Limpiar todo">
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── Tabla de líneas ─────────────────────────────── */}
      <div className="calcFTableWrap">
        <table className="calcFTable">
          <thead>
            <tr>
              <th className="calcFThNum calcFThLine">#</th>
              <th className="calcFThDesc">Descripción</th>
              <th className="calcFThNum">Cantidad</th>
              <th className="calcFThNum">Precio unit.</th>
              {showDisc && <th className="calcFThNum">Desc. %</th>}
              <th className="calcFThTar">IVA</th>
              <th className="calcFThNum">Subtotal</th>
              <th className="calcFThNum">IVA</th>
              <th className="calcFThNum">Total línea</th>
              <th className="calcFThAct" />
            </tr>
          </thead>
          <tbody>
            {computed.map((l, idx) => (
              <tr key={l.id} className="calcFRow">
                <td className="calcFTdLine">{idx + 1}</td>
                <td>
                  <input
                    className="calcFInput calcFInputNombre"
                    value={l.nombre}
                    placeholder="Descripción del bien o servicio"
                    onChange={e => updateLine(l.id, "nombre", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="calcFInput calcFInputNum"
                    type="number" min="0" step="any"
                    value={l.cant}
                    onChange={e => updateLine(l.id, "cant", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="calcFInput calcFInputNum"
                    type="number" min="0" step="any"
                    placeholder="0.00"
                    value={l.precio}
                    onChange={e => updateLine(l.id, "precio", e.target.value)}
                    onKeyDown={e => handlePrecioKey(e, l.id)}
                  />
                </td>
                {showDisc && (
                  <td>
                    <input
                      className="calcFInput calcFInputNum"
                      type="number" min="0" max="100" step="any"
                      placeholder="0"
                      value={l.descPct}
                      onChange={e => updateLine(l.id, "descPct", e.target.value)}
                    />
                  </td>
                )}
                <td>
                  <select
                    className="calcFTarifaSel"
                    value={l.tarifa}
                    onChange={e => updateLine(l.id, "tarifa", e.target.value)}
                  >
                    {TARIFAS.map(t => (
                      <option key={t.codigo} value={t.codigo}>{t.label}</option>
                    ))}
                  </select>
                </td>
                <td className="mono calcFTdR">
                  {l.sub > 0 ? fmtM(l.sub, sym) : <span className="calcFMuted">—</span>}
                </td>
                <td className="mono calcFTdR">
                  {l.ivaMonto > 0 ? fmtM(l.ivaMonto, sym) : <span className="calcFMuted">—</span>}
                </td>
                <td className="mono calcFTdR calcFTdBold">
                  {l.total > 0 ? fmtM(l.total, sym) : <span className="calcFMuted">—</span>}
                </td>
                <td>
                  <button
                    type="button" className="calcFRemoveBtn"
                    title="Eliminar línea"
                    onClick={() => removeLine(l.id)}
                    disabled={lines.length === 1}
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Acciones tabla ──────────────────────────────── */}
      <div className="calcFTableActions">
        <button type="button" className="calcFAddBtn" onClick={addLine}>
          + Agregar línea
        </button>
        <button type="button" className={`calcFDiscBtn${showDisc ? " calcFDiscBtnOn" : ""}`} onClick={toggleDiscount}>
          {showDisc ? "✕ Quitar descuentos" : "% Descuentos"}
        </button>
      </div>

      {/* ── Totales ─────────────────────────────────────── */}
      {hasAnyTotal && (
        <div className="calcFBottom">

          {/* Desglose por tarifa */}
          {Object.keys(totals.byTarifa).length > 1 && (
            <div className="calcFDesglose">
              <div className="calcFDesgloseTitle">Desglose IVA por tarifa</div>
              {Object.values(totals.byTarifa).sort((a, b) => a.pct - b.pct).map(g => (
                <div key={g.label} className="calcFDesgloseRow">
                  <span className={`taxBadgeV2 ${g.pct === 0 ? "t0" : taxClass(g.pct)}`}>{g.label}</span>
                  <span className="mono calcFDesgloseMono">Base: {fmtM(g.sub, sym)}</span>
                  {g.iva > 0 && <span className="mono calcFDesgloseMono">IVA: {fmtM(g.iva, sym)}</span>}
                </div>
              ))}
            </div>
          )}

          <div className="calcFTotals">
            {totals.totalDesc > 0 && (
              <>
                <div className="calcFTotalRow">
                  <span>Subtotal bruto</span>
                  <span className="mono">{fmtM(totals.totalVenta, sym)}</span>
                </div>
                <div className="calcFTotalRow calcFTotalDisc">
                  <span>Descuentos</span>
                  <span className="mono">− {fmtM(totals.totalDesc, sym)}</span>
                </div>
              </>
            )}
            {totals.totalGravado > 0 && (
              <div className="calcFTotalRow calcFTotalSub">
                <span>Base gravada</span>
                <span className="mono">{fmtM(totals.totalGravado, sym)}</span>
              </div>
            )}
            {totals.totalExento > 0 && (
              <div className="calcFTotalRow calcFTotalSub">
                <span>Exento / Exonerado</span>
                <span className="mono">{fmtM(totals.totalExento, sym)}</span>
              </div>
            )}
            {totals.totalIva > 0 && (
              <div className="calcFTotalRow">
                <span>IVA total</span>
                <span className="mono">{fmtM(totals.totalIva, sym)}</span>
              </div>
            )}
            <div className="calcFTotalRow calcFTotalFinal">
              <span>TOTAL</span>
              <span className="mono">{fmtM(totals.total, sym)}</span>
            </div>
          </div>
        </div>
      )}

      <p className="calcFHint">
        Presione <kbd>Enter</kbd> en el precio para avanzar a la siguiente línea.
      </p>
    </div>
  )
}
