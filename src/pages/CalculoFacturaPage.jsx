import { useMemo, useState } from "react"
import { taxClass } from "../utils/formatters.js"

const fmtN = (n) => "₡" + n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TARIFAS = [
  { codigo: "01", label: "Exento",    pct: 0 },
  { codigo: "02", label: "Exonerado", pct: 0 },
  { codigo: "03", label: "1%",        pct: 1 },
  { codigo: "04", label: "2%",        pct: 2 },
  { codigo: "05", label: "4%",        pct: 4 },
  { codigo: "06", label: "8%",        pct: 8 },
  { codigo: "07", label: "13%",       pct: 13 },
]

let nextId = 1
const newLine = () => ({
  id:    nextId++,
  desc:  "",
  cant:  "1",
  precio: "",
  tarifa: "07",
  descPct: "0",
})

export function CalculoFacturaPage() {
  const [lines, setLines] = useState([newLine()])
  const [moneda, setMoneda] = useState("CRC")

  const SYM = { CRC: "₡", USD: "$", EUR: "€" }
  const sym = SYM[moneda] || "₡"

  const fmtM = (n) =>
    sym + n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const computed = useMemo(() => lines.map(l => {
    const cant   = parseFloat(l.cant)   || 0
    const precio = parseFloat(l.precio) || 0
    const dPct   = parseFloat(l.descPct) || 0
    const tarifa = TARIFAS.find(t => t.codigo === l.tarifa) || TARIFAS[6]
    const bruto  = cant * precio
    const desc   = bruto * dPct / 100
    const sub    = bruto - desc
    const iva    = sub * tarifa.pct / 100
    const total  = sub + iva
    return { ...l, bruto, desc, sub, iva, total, pct: tarifa.pct, tarifaLabel: tarifa.label }
  }), [lines])

  const totals = useMemo(() => {
    const totalVenta    = computed.reduce((s, l) => s + l.bruto, 0)
    const totalDesc     = computed.reduce((s, l) => s + l.desc,  0)
    const totalGravado  = computed.filter(l => l.pct > 0).reduce((s, l) => s + l.sub, 0)
    const totalExento   = computed.filter(l => l.pct === 0).reduce((s, l) => s + l.sub, 0)
    const totalIva      = computed.reduce((s, l) => s + l.iva,   0)
    const total         = computed.reduce((s, l) => s + l.total, 0)

    const byTarifa = {}
    computed.forEach(l => {
      if (!byTarifa[l.tarifa]) byTarifa[l.tarifa] = { label: l.tarifaLabel, pct: l.pct, sub: 0, iva: 0 }
      byTarifa[l.tarifa].sub += l.sub
      byTarifa[l.tarifa].iva += l.iva
    })
    return { totalVenta, totalDesc, totalGravado, totalExento, totalIva, total, byTarifa }
  }, [computed])

  const updateLine = (id, field, value) =>
    setLines(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l))

  const addLine = () => setLines(ls => [...ls, newLine()])

  const removeLine = (id) => setLines(ls => ls.filter(l => l.id !== id))

  const hasDiscount = lines.some(l => parseFloat(l.descPct) > 0)

  return (
    <div className="pageWrap calcFWrap">

      <div className="calcFHeader">
        <div className="calcFTitle">Calculadora de factura</div>
        <div className="calcFHeaderRight">
          <label className="calcFLabel">Moneda</label>
          <select className="calcFMonedaSel" value={moneda} onChange={e => setMoneda(e.target.value)}>
            <option value="CRC">CRC — Colones</option>
            <option value="USD">USD — Dólares</option>
            <option value="EUR">EUR — Euros</option>
          </select>
        </div>
      </div>

      {/* Tabla de líneas */}
      <div className="calcFTableWrap">
        <table className="calcFTable">
          <thead>
            <tr>
              <th className="calcFThDesc">Descripción</th>
              <th className="calcFThNum">Cantidad</th>
              <th className="calcFThNum">Precio unit.</th>
              {hasDiscount && <th className="calcFThNum">Desc. %</th>}
              <th className="calcFThTar">IVA</th>
              <th className="calcFThNum">Subtotal</th>
              <th className="calcFThNum">IVA monto</th>
              <th className="calcFThNum">Total</th>
              <th className="calcFThAct" />
            </tr>
          </thead>
          <tbody>
            {computed.map((l) => (
              <tr key={l.id}>
                <td>
                  <input className="calcFInput calcFInputDesc" value={l.desc}
                    placeholder="Descripción del bien o servicio"
                    onChange={e => updateLine(l.id, "desc", e.target.value)} />
                </td>
                <td>
                  <input className="calcFInput calcFInputNum" type="number" min="0" step="any"
                    value={l.cant} onChange={e => updateLine(l.id, "cant", e.target.value)} />
                </td>
                <td>
                  <input className="calcFInput calcFInputNum" type="number" min="0" step="any"
                    placeholder="0.00" value={l.precio}
                    onChange={e => updateLine(l.id, "precio", e.target.value)} />
                </td>
                {hasDiscount && (
                  <td>
                    <input className="calcFInput calcFInputNum" type="number" min="0" max="100" step="any"
                      value={l.descPct} onChange={e => updateLine(l.id, "descPct", e.target.value)} />
                  </td>
                )}
                <td>
                  <select className="calcFTarifaSel" value={l.tarifa}
                    onChange={e => updateLine(l.id, "tarifa", e.target.value)}>
                    {TARIFAS.map(t => (
                      <option key={t.codigo} value={t.codigo}>{t.label}</option>
                    ))}
                  </select>
                </td>
                <td className="mono calcFTdR">{l.sub > 0 ? fmtM(l.sub) : <span className="calcFMuted">—</span>}</td>
                <td className="mono calcFTdR">{l.iva > 0 ? fmtM(l.iva) : <span className="calcFMuted">—</span>}</td>
                <td className="mono calcFTdR calcFTdBold">{l.total > 0 ? fmtM(l.total) : <span className="calcFMuted">—</span>}</td>
                <td>
                  <button type="button" className="calcFRemoveBtn" title="Eliminar línea"
                    onClick={() => removeLine(l.id)} disabled={lines.length === 1}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="calcFTableActions">
        <button type="button" className="calcFAddBtn" onClick={addLine}>+ Agregar línea</button>
        <button type="button" className="calcFDiscBtn"
          onClick={() => setLines(ls => ls.map(l => ({ ...l, descPct: parseFloat(l.descPct) > 0 ? "0" : l.descPct })))}>
          {hasDiscount ? "Quitar descuentos" : "Agregar columna descuento"}
        </button>
      </div>

      {/* Totales + desglose */}
      <div className="calcFBottom">
        {/* Desglose por tarifa */}
        {Object.keys(totals.byTarifa).length > 1 && (
          <div className="calcFDesglose">
            <div className="calcFDesgloseTitle">Desglose IVA</div>
            {Object.values(totals.byTarifa).sort((a, b) => a.pct - b.pct).map(g => (
              <div key={g.label} className="calcFDesgloseRow">
                <span className={`taxBadgeV2 ${g.pct === 0 ? "t0" : taxClass(g.pct)}`}>{g.label}</span>
                <span className="mono">Base: {fmtM(g.sub)}</span>
                {g.iva > 0 && <span className="mono">IVA: {fmtM(g.iva)}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="calcFTotals">
          {totals.totalDesc > 0 && (
            <>
              <div className="calcFTotalRow"><span>Subtotal bruto</span><span className="mono">{fmtM(totals.totalVenta)}</span></div>
              <div className="calcFTotalRow calcFTotalDisc"><span>Descuentos</span><span className="mono">− {fmtM(totals.totalDesc)}</span></div>
            </>
          )}
          {totals.totalGravado > 0 && <div className="calcFTotalRow calcFTotalSub"><span>Base gravada</span><span className="mono">{fmtM(totals.totalGravado)}</span></div>}
          {totals.totalExento > 0  && <div className="calcFTotalRow calcFTotalSub"><span>Exento / Exonerado</span><span className="mono">{fmtM(totals.totalExento)}</span></div>}
          {totals.totalIva > 0     && <div className="calcFTotalRow"><span>IVA</span><span className="mono">{fmtM(totals.totalIva)}</span></div>}
          <div className="calcFTotalRow calcFTotalFinal">
            <span>TOTAL COMPROBANTE</span>
            <span className="mono">{fmtM(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
