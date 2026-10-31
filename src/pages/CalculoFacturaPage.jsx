import { useEffect, useMemo, useState } from "react"
import { taxClass } from "../utils/formatters.js"

/* ── Constantes ─────────────────────────────────────────────────── */
const TARIFAS = [
  { codigo: "01", label: "Exento",    pct: 0  },
  { codigo: "02", label: "Exonerado", pct: 0  },
  { codigo: "03", label: "1%",        pct: 1  },
  { codigo: "04", label: "2%",        pct: 2  },
  { codigo: "05", label: "4%",        pct: 4  },
  { codigo: "06", label: "8%",        pct: 8  },
  { codigo: "07", label: "13%",       pct: 13 },
]

const CONDICIONES = ["Contado", "Crédito 15 días", "Crédito 30 días", "Crédito 60 días", "Consignación", "Otro"]
const MEDIOS_PAGO = ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia", "Cheque", "Otro"]
const MONEDAS     = [{ code: "CRC", sym: "₡", label: "CRC — Colones" }, { code: "USD", sym: "$", label: "USD — Dólares" }, { code: "EUR", sym: "€", label: "EUR — Euros" }]

const EMISOR_INIT = {
  nombre:    "",
  tipoCed:   "Jurídica",
  cedula:    "",
  telefono:  "",
  correo:    "",
  direccion: "",
}
const RECEPTOR_INIT = { nombre: "", cedula: "", correo: "", direccion: "" }
const META_INIT = {
  condicion:  "Contado",
  medioPago:  "Efectivo",
  moneda:     "CRC",
  notas:      "",
}

let lineId = 1
const newLine = () => ({
  id:      lineId++,
  nombre:  "",
  unidad:  "Sp",
  cant:    "1",
  precio:  "",
  descPct: "",
  tarifa:  "07",
})

const todayISO = () => new Date().toISOString().slice(0, 10)

function fmtM(n, sym) {
  return sym + n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseFlt(v) { return parseFloat(String(v).replace(/[^\d.]/g, "")) || 0 }

function useLS(key, init) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? { ...init, ...JSON.parse(s) } : init }
    catch { return init }
  })
  const save = (v) => { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }
  return [val, save]
}

/* ── Componente ─────────────────────────────────────────────────── */
export function CalculoFacturaPage() {
  const [emisor,    setEmisor]    = useLS("hk_inv_emisor",    EMISOR_INIT)
  const [receptor,  setReceptor]  = useState(RECEPTOR_INIT)
  const [meta,      setMeta]      = useState(META_INIT)
  const [fecha,     setFecha]     = useState(todayISO)
  const [consec,    setConsec]    = useState(() => {
    try { return parseInt(localStorage.getItem("hk_inv_consec") || "1", 10) } catch { return 1 }
  })
  const [lines,     setLines]     = useState([newLine()])
  const [showDisc,  setShowDisc]  = useState(false)
  const [editEmisor, setEditEmisor] = useState(false)

  const sym = MONEDAS.find(m => m.code === meta.moneda)?.sym || "₡"

  const consecStr = String(consec).padStart(8, "0")
  const consecFmt = `001-001-${consecStr}`

  /* ── Cómputo ───────────────────────────────────────────────────── */
  const computed = useMemo(() => lines.map(l => {
    const cant      = parseFlt(l.cant)
    const precio    = parseFlt(l.precio)
    const dPct      = parseFlt(l.descPct)
    const tarifa    = TARIFAS.find(t => t.codigo === l.tarifa) || TARIFAS[6]
    const bruto     = cant * precio
    const descMonto = bruto * dPct / 100
    const sub       = bruto - descMonto
    const ivaMonto  = sub * tarifa.pct / 100
    const total     = sub + ivaMonto
    return { ...l, bruto, descMonto, sub, ivaMonto, total, pct: tarifa.pct, tarifaLabel: tarifa.label }
  }), [lines])

  const totals = useMemo(() => {
    const totalBruto   = computed.reduce((s, l) => s + l.bruto,     0)
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
    return { totalBruto, totalDesc, totalGravado, totalExento, totalIva, total, byTarifa }
  }, [computed])

  /* ── Helpers ───────────────────────────────────────────────────── */
  const upLine    = (id, f, v) => setLines(ls => ls.map(l => l.id === id ? { ...l, [f]: v } : l))
  const addLine   = () => setLines(ls => [...ls, newLine()])
  const removeLine = (id) => { if (lines.length > 1) setLines(ls => ls.filter(l => l.id !== id)) }
  const upEmisor  = (f, v) => { const e = { ...emisor, [f]: v }; setEmisor(e) }
  const upRec     = (f, v) => setReceptor(r => ({ ...r, [f]: v }))
  const upMeta    = (f, v) => setMeta(m => ({ ...m, [f]: v }))

  const nextConsec = () => {
    const n = consec + 1
    setConsec(n)
    try { localStorage.setItem("hk_inv_consec", String(n)) } catch {}
  }

  const clearInvoice = () => {
    lineId = 1
    setLines([newLine()])
    setReceptor(RECEPTOR_INIT)
    setFecha(todayISO())
    setShowDisc(false)
  }

  const printPDF = () => window.print()

  const hasAnyTotal = totals.total > 0

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="pageWrap invPage">

      {/* ── Barra de acciones (no imprime) ──────────────────── */}
      <div className="invToolbar noPrint">
        <div className="invToolbarLeft">
          <label className="invToolbarLabel">Moneda</label>
          <select className="invSel" value={meta.moneda} onChange={e => upMeta("moneda", e.target.value)}>
            {MONEDAS.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
          <button type="button" className={`invToolBtn${showDisc ? " invToolBtnOn" : ""}`} onClick={() => {
            if (showDisc) setLines(ls => ls.map(l => ({ ...l, descPct: "" })))
            setShowDisc(v => !v)
          }}>% Descuento</button>
          <button type="button" className="invToolBtnGhost" onClick={clearInvoice}>Limpiar</button>
        </div>
        <div className="invToolbarRight">
          <button type="button" className="invPrintBtn" onClick={printPDF}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="11" height="7" rx="1.5"/>
              <path d="M5 5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/>
              <path d="M5 10h5"/>
            </svg>
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* ── Papel de factura ────────────────────────────────── */}
      <div className="invPaper">

        {/* ── Encabezado ─────────────────────────────────── */}
        <div className="invHead">
          {/* Bloque emisor */}
          <div className="invEmisor">
            <div className="invEmisorNameRow">
              <input className="invEmisorName" value={emisor.nombre} placeholder="Nombre / Razón Social"
                onChange={e => upEmisor("nombre", e.target.value)} />
              <button type="button" className="invEditHint noPrint" title="Editar datos emisor"
                onClick={() => setEditEmisor(v => !v)}>
                {editEmisor ? "▲" : "✎"}
              </button>
            </div>
            {editEmisor ? (
              <div className="invEmisorFields noPrint">
                <div className="invFieldRow">
                  <select className="invSel invSelSmall" value={emisor.tipoCed} onChange={e => upEmisor("tipoCed", e.target.value)}>
                    <option>Física</option><option>Jurídica</option><option>DIMEX</option><option>NITE</option>
                  </select>
                  <input className="invInline" value={emisor.cedula} placeholder="Número de cédula" onChange={e => upEmisor("cedula", e.target.value)} />
                </div>
                <input className="invInline invInlineFull" value={emisor.telefono} placeholder="Teléfono" onChange={e => upEmisor("telefono", e.target.value)} />
                <input className="invInline invInlineFull" value={emisor.correo} placeholder="Correo electrónico" onChange={e => upEmisor("correo", e.target.value)} />
                <input className="invInline invInlineFull" value={emisor.direccion} placeholder="Dirección" onChange={e => upEmisor("direccion", e.target.value)} />
              </div>
            ) : (
              <div className="invEmisorInfo">
                {emisor.cedula    && <span>{emisor.tipoCed}: {emisor.cedula}</span>}
                {emisor.telefono  && <span>{emisor.telefono}</span>}
                {emisor.correo    && <span>{emisor.correo}</span>}
                {emisor.direccion && <span>{emisor.direccion}</span>}
                {!emisor.cedula && !emisor.telefono && !emisor.correo && !emisor.direccion && (
                  <span className="invPlaceholder noPrint">Haga clic en ✎ para agregar datos del emisor</span>
                )}
              </div>
            )}
          </div>

          {/* Bloque metadatos */}
          <div className="invMeta">
            <div className="invMetaType">FACTURA ELECTRÓNICA</div>
            <div className="invMetaConsec">{consecFmt}</div>
            <div className="invMetaGrid">
              <span className="invMetaLbl">Fecha</span>
              <input type="date" className="invMetaInput" value={fecha} onChange={e => setFecha(e.target.value)} />
              <span className="invMetaLbl">Condición</span>
              <select className="invMetaInput invSel" value={meta.condicion} onChange={e => upMeta("condicion", e.target.value)}>
                {CONDICIONES.map(c => <option key={c}>{c}</option>)}
              </select>
              <span className="invMetaLbl">Medio pago</span>
              <select className="invMetaInput invSel" value={meta.medioPago} onChange={e => upMeta("medioPago", e.target.value)}>
                {MEDIOS_PAGO.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" className="invConsecBtn noPrint" onClick={nextConsec} title="Siguiente consecutivo">
              N.° siguiente →
            </button>
          </div>
        </div>

        <div className="invDivider" />

        {/* ── Receptor ───────────────────────────────────── */}
        <div className="invReceptorRow">
          <div className="invReceptorSection">
            <div className="invSectionLabel">RECEPTOR</div>
            <div className="invReceptorGrid">
              <span className="invRecLbl">Nombre</span>
              <input className="invRecInput" value={receptor.nombre} placeholder="Nombre o razón social" onChange={e => upRec("nombre", e.target.value)} />
              <span className="invRecLbl">Cédula</span>
              <input className="invRecInput" value={receptor.cedula} placeholder="—" onChange={e => upRec("cedula", e.target.value)} />
              <span className="invRecLbl">Correo</span>
              <input className="invRecInput" value={receptor.correo} placeholder="—" onChange={e => upRec("correo", e.target.value)} />
              <span className="invRecLbl">Dirección</span>
              <input className="invRecInput invRecInputFull" value={receptor.direccion} placeholder="—" onChange={e => upRec("direccion", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="invDivider" />

        {/* ── Tabla líneas ───────────────────────────────── */}
        <div className="invLinesWrap">
          <table className="invTable">
            <thead>
              <tr className="invThead">
                <th className="invThN">#</th>
                <th className="invThDesc">Descripción</th>
                <th className="invThSm">Unidad</th>
                <th className="invThSm invThR">Cant.</th>
                <th className="invThSm invThR">Precio unit.</th>
                {showDisc && <th className="invThSm invThR">Desc.%</th>}
                <th className="invThSm">IVA</th>
                <th className="invThSm invThR">Subtotal</th>
                <th className="invThSm invThR">IVA</th>
                <th className="invThSm invThR invThBold">Total</th>
                <th className="invThAct noPrint" />
              </tr>
            </thead>
            <tbody>
              {computed.map((l, idx) => (
                <tr key={l.id} className="invRow">
                  <td className="invTdN">{idx + 1}</td>
                  <td>
                    <input className="invLInput invLInputDesc" value={l.nombre}
                      placeholder="Descripción del bien o servicio"
                      onChange={e => upLine(l.id, "nombre", e.target.value)} />
                  </td>
                  <td>
                    <input className="invLInput invLInputSm" value={l.unidad}
                      onChange={e => upLine(l.id, "unidad", e.target.value)} />
                  </td>
                  <td>
                    <input className="invLInput invLInputNum" type="number" min="0" step="any"
                      value={l.cant} onChange={e => upLine(l.id, "cant", e.target.value)} />
                  </td>
                  <td>
                    <input className="invLInput invLInputNum" type="number" min="0" step="any"
                      placeholder="0.00" value={l.precio}
                      onChange={e => upLine(l.id, "precio", e.target.value)} />
                  </td>
                  {showDisc && (
                    <td>
                      <input className="invLInput invLInputNum" type="number" min="0" max="100" step="any"
                        placeholder="0" value={l.descPct}
                        onChange={e => upLine(l.id, "descPct", e.target.value)} />
                    </td>
                  )}
                  <td>
                    <select className="invTarifaSel" value={l.tarifa} onChange={e => upLine(l.id, "tarifa", e.target.value)}>
                      {TARIFAS.map(t => <option key={t.codigo} value={t.codigo}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="invTdR mono">{l.sub > 0 ? fmtM(l.sub, sym) : <span className="invDash">—</span>}</td>
                  <td className="invTdR mono">{l.ivaMonto > 0 ? fmtM(l.ivaMonto, sym) : <span className="invDash">—</span>}</td>
                  <td className="invTdR mono invTdBold">{l.total > 0 ? fmtM(l.total, sym) : <span className="invDash">—</span>}</td>
                  <td className="noPrint">
                    <button type="button" className="invRemoveBtn" onClick={() => removeLine(l.id)} disabled={lines.length === 1} title="Eliminar">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invAddLineRow noPrint">
            <button type="button" className="invAddLineBtn" onClick={addLine}>+ Agregar línea</button>
          </div>
        </div>

        {/* ── Totales ────────────────────────────────────── */}
        {hasAnyTotal && (
          <div className="invTotalsSection">
            {/* IVA desglose por tarifa */}
            <div className="invTarifaBlock">
              {Object.values(totals.byTarifa).sort((a, b) => a.pct - b.pct).map(g => (
                <div key={g.label} className="invTarifaRow">
                  <span className={`taxBadgeV2 ${g.pct === 0 ? "t0" : taxClass(g.pct)}`}>{g.label}</span>
                  <span className="invTarifaMono">Base: {fmtM(g.sub, sym)}</span>
                  {g.iva > 0 && <span className="invTarifaMono">IVA: {fmtM(g.iva, sym)}</span>}
                </div>
              ))}
            </div>

            {/* Panel totales */}
            <div className="invTotalsPanel">
              {totals.totalDesc > 0 && (
                <>
                  <div className="invTotalRow">
                    <span>Subtotal bruto</span>
                    <span className="mono">{fmtM(totals.totalBruto, sym)}</span>
                  </div>
                  <div className="invTotalRow invTotalNeg">
                    <span>Descuentos</span>
                    <span className="mono">− {fmtM(totals.totalDesc, sym)}</span>
                  </div>
                </>
              )}
              {totals.totalGravado > 0 && (
                <div className="invTotalRow invTotalSub">
                  <span>Base gravada</span>
                  <span className="mono">{fmtM(totals.totalGravado, sym)}</span>
                </div>
              )}
              {totals.totalExento > 0 && (
                <div className="invTotalRow invTotalSub">
                  <span>Base exenta</span>
                  <span className="mono">{fmtM(totals.totalExento, sym)}</span>
                </div>
              )}
              {totals.totalIva > 0 && (
                <div className="invTotalRow">
                  <span>IVA</span>
                  <span className="mono">{fmtM(totals.totalIva, sym)}</span>
                </div>
              )}
              <div className="invTotalRow invTotalFinal">
                <span>TOTAL {meta.moneda}</span>
                <span className="mono">{fmtM(totals.total, sym)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Notas ──────────────────────────────────────── */}
        <div className="invNotasRow">
          <div className="invNotasLabel">Notas / Observaciones</div>
          <textarea className="invNotas" rows={3} value={meta.notas}
            placeholder="Condiciones de pago, términos adicionales..."
            onChange={e => upMeta("notas", e.target.value)} />
        </div>

        {/* ── Pie ────────────────────────────────────────── */}
        <div className="invFooter">
          <span>Documento generado con HaciendaKit · hacienda-toolkit.vercel.app</span>
        </div>
      </div>
    </div>
  )
}
