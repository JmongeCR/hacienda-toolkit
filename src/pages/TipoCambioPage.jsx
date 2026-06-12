import { useMemo, useState } from "react"
import { IC } from "../constants/icons.jsx"
import { formatFechaCR } from "../utils/formatters.js"
import { ConversorWise } from "../components/ConversorWise.jsx"
import { TcSparkline } from "../components/TcSparkline.jsx"

export function TipoCambioPage({ fx, fxEur, fxLoading, fetchFx, tcHistory, tcHistLoading, fetchTcHistory }) {
  const [convFrom,   setConvFrom]   = useState("usd")
  const [convTo,     setConvTo]     = useState("crc")
  const [convAmount, setConvAmount] = useState("")

  const convResult = useMemo(() => {
    const n = convAmount === "" ? NaN : parseFloat(convAmount)
    if (!fx || isNaN(n) || n < 0) return null
    const eurRate = fxEur?.colones ?? null
    const toCrc   = (id, a) => id === "crc" ? a : id === "usd" ? a * fx.venta : eurRate ? a * eurRate : null
    const fromCrc = (id, c) => id === "crc" ? c : id === "usd" ? c / fx.venta : eurRate ? c / eurRate : null
    const crc = toCrc(convFrom, n)
    if (crc == null) return null
    const thirdId = ["crc","usd","eur"].find(c => c !== convFrom && c !== convTo)
    return { to: fromCrc(convTo, crc), third: thirdId ? fromCrc(thirdId, crc) : null, thirdId }
  }, [fx, fxEur, convFrom, convTo, convAmount])

  const prev = tcHistory.length >= 2 ? tcHistory[tcHistory.length - 2] : null
  const usdChg  = (fx && prev) ? fx.venta - prev.venta : null
  const usdChgP = (usdChg != null && prev?.venta) ? (usdChg / prev.venta) * 100 : null

  return (
    <div className="pageWrap pageCentered">
      <div className="tcChipRow">
        <div className="tcChip">
          <div className="tcChipMain">
            <span className="tcChipFlag">🇺🇸</span>
            <div>
              <div className="tcChipRate">{fxLoading ? "…" : fx ? `₡${fx.venta.toLocaleString("es-CR")}` : "—"} <span className="tcChipCcy">USD</span></div>
              <div className="tcChipSub">Compra ₡{fx?.compra?.toLocaleString("es-CR") ?? "—"} · Venta ₡{fx?.venta?.toLocaleString("es-CR") ?? "—"}</div>
            </div>
          </div>
          {usdChg != null && (
            <div className={`tcChipVar ${usdChg >= 0 ? "tcChipUp" : "tcChipDown"}`}>
              <span className="tcChipVarPct">{usdChg >= 0 ? "▲" : "▼"} {Math.abs(usdChgP).toFixed(2)}%</span>
              <span className="tcChipVarAbs">{usdChg >= 0 ? "+" : ""}₡{usdChg.toFixed(2)} vs ayer</span>
            </div>
          )}
        </div>
        <div className="tcChip tcChipEur">
          <div className="tcChipMain">
            <span className="tcChipFlag">🇪🇺</span>
            <div>
              <div className="tcChipRate">{fxLoading ? "…" : fxEur ? `₡${fxEur.colones.toLocaleString("es-CR")}` : "—"} <span className="tcChipCcy">EUR</span></div>
              <div className="tcChipSub">Referencia Hacienda · {fxEur ? formatFechaCR(fxEur.fecha) : "—"}</div>
            </div>
          </div>
        </div>
        <button className="tcChipRefresh" onClick={() => { fetchFx(); fetchTcHistory() }} type="button" title="Actualizar">
          {IC.refresh}
        </button>
      </div>

      <ConversorWise
        fx={fx} fxEur={fxEur}
        convFrom={convFrom} setConvFrom={setConvFrom}
        convTo={convTo} setConvTo={setConvTo}
        convAmount={convAmount} setConvAmount={setConvAmount}
        convResult={convResult}
      />

      <TcSparkline data={tcHistory} loading={tcHistLoading} />
    </div>
  )
}
