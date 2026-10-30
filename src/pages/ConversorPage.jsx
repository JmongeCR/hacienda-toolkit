import { useMemo, useState } from "react"

const MONEDAS = ["CRC", "USD", "EUR"]
const SYM = { CRC: "₡", USD: "$", EUR: "€" }
const fmt = (n, mon) =>
  SYM[mon] + n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ConversorPage({ fx, fxEur }) {
  const [monto, setMonto] = useState("")
  const [de,    setDe]    = useState("USD")
  const [a,     setA]     = useState("CRC")

  const n = parseFloat(monto.replace(/[^\d.]/g, "")) || 0

  // Tasa efectiva de conversión
  const { resultado, tasa, nota } = useMemo(() => {
    if (!n || de === a) return { resultado: n, tasa: 1, nota: null }
    if (!fx) return { resultado: null, tasa: null, nota: "Sin datos de tipo de cambio" }

    const usdVenta  = fx?.venta  || 0
    const usdCompra = fx?.compra || 0
    const eurColones = fxEur?.colones || 0

    // CRC → USD
    if (de === "CRC" && a === "USD" && usdVenta > 0)
      return { resultado: n / usdVenta,  tasa: usdVenta,  nota: `Tipo de cambio venta ₡${usdVenta.toLocaleString("es-CR")} por dólar (BCCR)` }

    // USD → CRC
    if (de === "USD" && a === "CRC" && usdCompra > 0)
      return { resultado: n * usdCompra, tasa: usdCompra, nota: `Tipo de cambio compra ₡${usdCompra.toLocaleString("es-CR")} por dólar (BCCR)` }

    // CRC → EUR
    if (de === "CRC" && a === "EUR" && eurColones > 0)
      return { resultado: n / eurColones, tasa: eurColones, nota: `Tipo de cambio ₡${eurColones.toLocaleString("es-CR")} por euro (BCCR)` }

    // EUR → CRC
    if (de === "EUR" && a === "CRC" && eurColones > 0)
      return { resultado: n * eurColones, tasa: eurColones, nota: `Tipo de cambio ₡${eurColones.toLocaleString("es-CR")} por euro (BCCR)` }

    // USD ↔ EUR (cruzado via CRC)
    if (de === "USD" && a === "EUR" && usdCompra > 0 && eurColones > 0) {
      const enCrc = n * usdCompra
      return { resultado: enCrc / eurColones, tasa: null, nota: "Tasa cruzada: USD → CRC → EUR vía BCCR" }
    }
    if (de === "EUR" && a === "USD" && usdVenta > 0 && eurColones > 0) {
      const enCrc = n * eurColones
      return { resultado: enCrc / usdVenta,  tasa: null, nota: "Tasa cruzada: EUR → CRC → USD vía BCCR" }
    }

    return { resultado: null, tasa: null, nota: "Sin datos suficientes" }
  }, [n, de, a, fx, fxEur])

  const swap = () => { setDe(a); setA(de) }

  const PARES_RAPIDOS = [
    { de: "USD", a: "CRC", label: "USD → CRC" },
    { de: "CRC", a: "USD", label: "CRC → USD" },
    { de: "EUR", a: "CRC", label: "EUR → CRC" },
    { de: "CRC", a: "EUR", label: "CRC → EUR" },
  ]

  return (
    <div className="pageWrap pageCentered convWrap">
      <div className="convCard">
        <div className="convCardHeader">
          <div className="convCardTitle">Conversor de moneda</div>
          <div className="convCardSub">Tipo de cambio BCCR — {fx?.fecha ? `al ${fx.fecha}` : "tiempo real"}</div>
        </div>

        {/* Pares rápidos */}
        <div className="convParesRow">
          {PARES_RAPIDOS.map(p => (
            <button key={p.label} type="button"
              className={`convParBtn${de === p.de && a === p.a ? " convParActive" : ""}`}
              onClick={() => { setDe(p.de); setA(p.a) }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Selectores + monto */}
        <div className="convRow">
          <div className="convField">
            <label className="convLabel">De</label>
            <select className="convSelect" value={de} onChange={e => setDe(e.target.value)}>
              {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <button type="button" className="convSwapBtn" onClick={swap} title="Intercambiar">
            ⇄
          </button>

          <div className="convField">
            <label className="convLabel">A</label>
            <select className="convSelect" value={a} onChange={e => setA(e.target.value)}>
              {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="convMontoWrap">
          <label className="convLabel">Monto</label>
          <div className="convMontoRow">
            <span className="convMontoPfx">{SYM[de]}</span>
            <input
              className="convMontoInput"
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

        {/* Resultado */}
        {n > 0 && de !== a && (
          <div className="convResultWrap">
            <div className="convResultEq">
              <span className="convResultFrom">{fmt(n, de)}</span>
              <span className="convResultArrow">=</span>
              <span className="convResultTo">{resultado != null ? fmt(resultado, a) : "—"}</span>
            </div>
            {nota && <div className="convResultNota">{nota}</div>}
          </div>
        )}

        {(!fx) && (
          <div className="convNoDatos">Sin tipo de cambio disponible. Revisá tu conexión.</div>
        )}
      </div>

      {/* Tabla de referencia */}
      {fx && (
        <div className="convRefCard">
          <div className="convRefTitle">Tasas vigentes — BCCR</div>
          <div className="convRefGrid">
            <div className="convRefItem">
              <span className="convRefLbl">USD compra</span>
              <span className="convRefVal mono">₡{fx.compra.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="convRefItem">
              <span className="convRefLbl">USD venta</span>
              <span className="convRefVal mono">₡{fx.venta.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</span>
            </div>
            {fxEur && (
              <div className="convRefItem">
                <span className="convRefLbl">EUR (referencia)</span>
                <span className="convRefVal mono">₡{fxEur.colones.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="convRefItem">
              <span className="convRefLbl">Margen USD</span>
              <span className="convRefVal mono">₡{(fx.venta - fx.compra).toLocaleString("es-CR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
