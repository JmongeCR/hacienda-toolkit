import { useMemo, useState } from "react"

const TARIFAS = [
  { pct: 0,  desc: "Exento"               },
  { pct: 1,  desc: "Canasta básica"        },
  { pct: 2,  desc: "Especial"              },
  { pct: 4,  desc: "Salud / Educación"     },
  { pct: 8,  desc: "Profesionales"         },
  { pct: 13, desc: "Tarifa general"        },
]

const fmt = (n) => n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function IvaCalculatorPage() {
  const [monto,  setMonto]  = useState("")
  const [tarifa, setTarifa] = useState(13)
  const [modo,   setModo]   = useState("base") // "base" = ingresa sin IVA, "total" = ingresa con IVA

  const n = parseFloat(monto.replace(/[^\d.]/g, "")) || 0

  const { base, iva, total } = useMemo(() => {
    if (modo === "base") {
      const base = n
      const iva  = base * tarifa / 100
      return { base, iva, total: base + iva }
    } else {
      const total = n
      const base  = total / (1 + tarifa / 100)
      return { base, iva: total - base, total }
    }
  }, [n, tarifa, modo])

  const hasValue = n > 0

  return (
    <div className="pageWrap pageCentered ivaWrap">
      <div className="ivaCard">
        <div className="ivaCardHeader">
          <div className="ivaCardTitle">Calculadora de IVA</div>
          <div className="ivaCardSub">Costa Rica — Ley 9635</div>
        </div>

        {/* Modo */}
        <div className="ivaModoRow">
          <button type="button"
            className={`ivaModoBtn${modo === "base" ? " ivaModoActive" : ""}`}
            onClick={() => setModo("base")}>
            Monto sin IVA
          </button>
          <button type="button"
            className={`ivaModoBtn${modo === "total" ? " ivaModoActive" : ""}`}
            onClick={() => setModo("total")}>
            Monto con IVA incluido
          </button>
        </div>

        {/* Monto */}
        <div className="ivaFieldWrap">
          <label className="ivaLabel">
            {modo === "base" ? "Monto base (excluye IVA)" : "Monto total (incluye IVA)"}
          </label>
          <div className="ivaInputRow">
            <span className="ivaInputPrefix">₡</span>
            <input
              className="ivaInput"
              type="number"
              min="0"
              step="0.01"
              value={monto}
              placeholder="0.00"
              onChange={e => setMonto(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Tarifa */}
        <div className="ivaFieldWrap">
          <label className="ivaLabel">Tarifa de IVA</label>
          <div className="ivaTarifaGrid">
            {TARIFAS.map(t => (
              <button key={t.pct} type="button"
                className={`ivaTarifaBtn${tarifa === t.pct ? " ivaTarifaActive" : ""}`}
                onClick={() => setTarifa(t.pct)}>
                <span className="ivaTarifaPct">{t.pct}%</span>
                <span className="ivaTarifaDesc">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Resultado */}
        {hasValue && (
          <div className="ivaResultWrap">
            <div className="ivaResultRow">
              <span className="ivaResultLbl">Base imponible</span>
              <span className="ivaResultVal mono">₡{fmt(base)}</span>
            </div>
            <div className="ivaResultRow">
              <span className="ivaResultLbl">IVA ({tarifa}%)</span>
              <span className="ivaResultVal mono ivaResultIvaVal">₡{fmt(iva)}</span>
            </div>
            <div className="ivaResultRow ivaResultTotalRow">
              <span className="ivaResultLbl">Total con IVA</span>
              <span className="ivaResultVal mono ivaResultTotalVal">₡{fmt(total)}</span>
            </div>
          </div>
        )}

        {!hasValue && (
          <div className="ivaEmptyHint">
            Ingresá un monto para ver el desglose de IVA
          </div>
        )}
      </div>

      {/* Tabla de referencia */}
      <div className="ivaRefCard">
        <div className="ivaRefTitle">Tarifas de IVA — Costa Rica</div>
        <table className="ivaRefTable">
          <thead>
            <tr><th>Tarifa</th><th>Aplica a</th></tr>
          </thead>
          <tbody>
            <tr><td>0%</td><td>Bienes y servicios exentos (canasta básica, medicamentos genéricos, etc.)</td></tr>
            <tr><td>1%</td><td>Canasta básica tributaria, insumos agropecuarios</td></tr>
            <tr><td>2%</td><td>Medicamentos y dispositivos médicos</td></tr>
            <tr><td>4%</td><td>Primas de seguros de vida, servicios de educación privada, servicios médicos privados</td></tr>
            <tr><td>8%</td><td>Servicios de profesionales y técnicos, seguros pólizas, boletos aéreos</td></tr>
            <tr><td>13%</td><td>Tarifa general — todos los demás bienes y servicios</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
