import { useMemo, useState } from "react"

const fmtN = (n) => n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ESCENARIOS = [
  {
    id: "iva100",
    label: "Retención IVA — Agente retenedor (100%)",
    grupo: "IVA",
    desc: "Gobiernos, entes públicos y grandes contribuyentes designados retienen el 100% del IVA al comprador.",
    tarifaIva: 13,
    pctRetencion: 100,
    tipo: "iva",
    base: "gravada",
  },
  {
    id: "iva75",
    label: "Retención IVA — Agente retenedor (75%)",
    grupo: "IVA",
    desc: "Algunos agentes de retención retienen el 75% del IVA.",
    tarifaIva: 13,
    pctRetencion: 75,
    tipo: "iva",
    base: "gravada",
  },
  {
    id: "dividendos",
    label: "Dividendos — Personas físicas residentes",
    grupo: "Renta",
    desc: "Retención sobre distribución de dividendos: 15% sobre el monto bruto.",
    pct: 15,
    tipo: "renta",
  },
  {
    id: "intereses",
    label: "Intereses — Residentes",
    grupo: "Renta",
    desc: "Retención sobre intereses pagados a residentes: 8%.",
    pct: 8,
    tipo: "renta",
  },
  {
    id: "alquileres",
    label: "Arrendamientos — Personas físicas",
    grupo: "Renta",
    desc: "Retención sobre alquiler de bienes inmuebles: 15% del monto bruto.",
    pct: 15,
    tipo: "renta",
  },
  {
    id: "remesas_svc",
    label: "Remesas al exterior — Servicios",
    grupo: "Renta",
    desc: "Retención sobre servicios prestados por no domiciliados: 25%.",
    pct: 25,
    tipo: "renta",
  },
  {
    id: "remesas_int",
    label: "Remesas al exterior — Intereses",
    grupo: "Renta",
    desc: "Retención sobre intereses pagados a no domiciliados: 15%.",
    pct: 15,
    tipo: "renta",
  },
]

const GRUPOS = ["IVA", "Renta"]

export function RetencionesPPage() {
  const [esId,  setEsId]  = useState("iva100")
  const [monto, setMonto] = useState("")
  const [modo,  setModo]  = useState("bruto") // "bruto" | "neto"

  const n = parseFloat(monto.replace(/[^\d.]/g, "")) || 0
  const es = ESCENARIOS.find(e => e.id === esId)

  const calc = useMemo(() => {
    if (!n || !es) return null
    if (es.tipo === "iva") {
      // n = base gravada (excl. IVA) o monto total (incl. IVA)
      const base = modo === "bruto" ? n : n / (1 + es.tarifaIva / 100)
      const iva  = base * es.tarifaIva / 100
      const retencion = iva * es.pctRetencion / 100
      const ivaNeto   = iva - retencion
      const totalSinRetencion = base + iva
      const totalConRetencion = base + ivaNeto
      return { base, iva, retencion, ivaNeto, totalSinRetencion, totalConRetencion, tipo: "iva" }
    } else {
      const bruto      = modo === "bruto" ? n : n / (1 - es.pct / 100)
      const retencion  = bruto * es.pct / 100
      const neto       = bruto - retencion
      return { bruto, retencion, neto, pct: es.pct, tipo: "renta" }
    }
  }, [n, es, modo])

  return (
    <div className="pageWrap pageCentered retWrap">
      <div className="retCard">
        <div className="retCardHeader">
          <div className="retCardTitle">Calculadora de retenciones</div>
          <div className="retCardSub">Costa Rica — estimativo informativo</div>
        </div>

        {/* Escenario */}
        <div className="retFieldWrap">
          <label className="retLabel">Tipo de retención</label>
          {GRUPOS.map(g => (
            <div key={g} className="retGrupo">
              <div className="retGrupoLabel">{g}</div>
              <div className="retScenarioList">
                {ESCENARIOS.filter(e => e.grupo === g).map(e => (
                  <button key={e.id} type="button"
                    className={`retScenarioBtn${esId === e.id ? " retScenarioActive" : ""}`}
                    onClick={() => setEsId(e.id)}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {es && <p className="retScenarioDesc">{es.desc}</p>}
        </div>

        {/* Modo + monto */}
        <div className="retFieldWrap">
          <label className="retLabel">Monto ingresado como</label>
          <div className="retModoRow">
            {["bruto", "neto"].map(m => (
              <button key={m} type="button"
                className={`retModoBtn${modo === m ? " retModoActive" : ""}`}
                onClick={() => setModo(m)}>
                {m === "bruto" ? (es?.tipo === "iva" ? "Base gravada (sin IVA)" : "Monto bruto") : (es?.tipo === "iva" ? "Total (con IVA)" : "Monto neto")}
              </button>
            ))}
          </div>
          <div className="retMontoRow">
            <span className="retMontoPfx">₡</span>
            <input className="retMontoInput" type="number" min="0" step="0.01"
              placeholder="0.00" value={monto} onChange={e => setMonto(e.target.value)} autoFocus />
          </div>
        </div>

        {/* Resultado */}
        {calc && n > 0 && (
          <div className="retResultWrap">
            {calc.tipo === "iva" ? (
              <>
                <div className="retResultRow"><span>Base gravada</span><span className="mono">₡{fmtN(calc.base)}</span></div>
                <div className="retResultRow"><span>IVA ({es.tarifaIva}%)</span><span className="mono">₡{fmtN(calc.iva)}</span></div>
                <div className="retResultRow retResultRet"><span>Retención ({es.pctRetencion}% del IVA)</span><span className="mono retRetVal">− ₡{fmtN(calc.retencion)}</span></div>
                <div className="retResultRow retResultSep"><span>IVA a pagar por emisor</span><span className="mono">₡{fmtN(calc.ivaNeto)}</span></div>
                <div className="retResultRow retResultFinal"><span>Total a cobrar al cliente</span><span className="mono">₡{fmtN(calc.totalConRetencion)}</span></div>
                <div className="retResultRow retResultMuted"><span>Total sin retención (referencia)</span><span className="mono">₡{fmtN(calc.totalSinRetencion)}</span></div>
              </>
            ) : (
              <>
                <div className="retResultRow"><span>Monto bruto</span><span className="mono">₡{fmtN(calc.bruto)}</span></div>
                <div className="retResultRow retResultRet"><span>Retención ({calc.pct}%)</span><span className="mono retRetVal">− ₡{fmtN(calc.retencion)}</span></div>
                <div className="retResultRow retResultFinal"><span>Monto neto a percibir</span><span className="mono">₡{fmtN(calc.neto)}</span></div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="retDisclaimer">
        ⚠ Los cálculos son estimativos e informativos. Las tasas y escenarios son de referencia general. Consulte a un contador autorizado para su caso específico.
      </div>
    </div>
  )
}
