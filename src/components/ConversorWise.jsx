import { CURRENCIES, CurrencySelector } from "./CurrencySelector.jsx"

export function ConversorWise({ fx, fxEur, convFrom, setConvFrom, convTo, setConvTo, convAmount, setConvAmount, convResult }) {
  const fmtOut = (n, id) => {
    if (n == null || isNaN(n)) return ""
    const dec = id === "crc" ? 2 : 4
    return n.toLocaleString("es-CR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
  }
  const thirdCurr = CURRENCIES.find(c => c.id !== convFrom && c.id !== convTo)
  const handleSwap = () => {
    const tmp = convFrom; setConvFrom(convTo); setConvTo(tmp); setConvAmount("")
  }
  const handleFromChange = (id) => {
    if (id === convTo) setConvTo(convFrom)
    setConvFrom(id); setConvAmount("")
  }
  const handleToChange = (id) => {
    if (id === convFrom) setConvFrom(convTo)
    setConvTo(id)
  }
  const fromCurr = CURRENCIES.find(c => c.id === convFrom)
  const toCurr   = CURRENCIES.find(c => c.id === convTo)
  return (
    <div className="wiseCard">
      <div className="wiseSection wiseSectionFrom">
        <div className="wiseSectionLabel">Tengo</div>
        <div className="wiseInputRow">
          <CurrencySelector value={convFrom} onChange={handleFromChange} exclude={[convTo]} />
          <input
            className="wiseAmountInput"
            type="number" min="0" placeholder="0"
            value={convAmount}
            onChange={e => setConvAmount(e.target.value)}
            autoFocus
          />
        </div>
        {convAmount && <div className="wiseAmountHint">{fromCurr.flag} {fromCurr.name}</div>}
      </div>

      <div className="wiseSwapBar">
        <div className="wiseSwapLine" />
        <button type="button" className="wiseSwapBtn" onClick={handleSwap} title="Invertir">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2v14M5 5.5L9 2l4 3.5M13 12.5L9 16l-4-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="wiseSwapLine" />
      </div>

      <div className="wiseSection wiseSectionTo">
        <div className="wiseSectionLabel">Recibo</div>
        <div className="wiseInputRow">
          <CurrencySelector value={convTo} onChange={handleToChange} exclude={[convFrom]} />
          <div className="wiseOutputVal">
            {convResult?.to != null
              ? <span className="wiseResultNum">{fmtOut(convResult.to, convTo)}</span>
              : <span className="wiseResultEmpty">—</span>}
          </div>
        </div>
        {convResult?.to != null && <div className="wiseAmountHint">{toCurr.flag} {toCurr.name}</div>}
      </div>

      {thirdCurr && convResult?.third != null && (
        <div className="wiseThirdRow">
          <span className="wiseThirdLabel">También en {thirdCurr.flag} {thirdCurr.code}:</span>
          <span className="wiseThirdVal">{thirdCurr.symbol} {fmtOut(convResult.third, thirdCurr.id)}</span>
        </div>
      )}

      <div className="wiseRateBar">
        {fx && (
          <span>
            <strong>1 USD</strong> = ₡{fx.venta.toLocaleString("es-CR")} venta · ₡{fx.compra.toLocaleString("es-CR")} compra
          </span>
        )}
        {fxEur && (
          <span>
            <strong>1 EUR</strong> = ₡{fxEur.colones.toLocaleString("es-CR")} referencia
          </span>
        )}
        <button className="wiseClearBtn" type="button" onClick={() => setConvAmount("")}>Limpiar</button>
      </div>
    </div>
  )
}
