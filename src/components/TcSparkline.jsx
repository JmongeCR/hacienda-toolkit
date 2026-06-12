export function TcSparkline({ data, loading }) {
  if (loading) return (
    <div className="sparkCard sparkLoading">
      <div className="sparkLoadingDots"><span /><span /><span /></div>
      <div className="sparkLoadingText">Cargando historial 30 días…</div>
    </div>
  )
  if (!data || data.length < 5) return null
  const vals = data.map(d => d.venta)
  const min = Math.min(...vals), max = Math.max(...vals), avg = vals.reduce((a,b) => a+b,0)/vals.length
  const first = vals[0], last = vals[vals.length-1]
  const change = last - first, changePct = (change/first)*100, isUp = change >= 0
  const W = 600, H = 90, padX = 2, padY = 6
  const sx = i => padX + (i/(vals.length-1))*(W-padX*2)
  const sy = v => padY + ((max-v)/((max-min)||1))*(H-padY*2)
  const pathD  = vals.map((v,i) => `${i===0?"M":"L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")
  const areaD  = `${pathD} L${sx(vals.length-1).toFixed(1)},${H} L${sx(0).toFixed(1)},${H} Z`
  const color  = isUp ? "#2563eb" : "#dc2626"
  const fmtV = v => `₡${v.toLocaleString("es-CR",{ minimumFractionDigits:2, maximumFractionDigits:2 })}`
  return (
    <div className="sparkCard">
      <div className="sparkHeader">
        <div>
          <div className="sparkTitle">🇺🇸 Dólar — últimos 30 días</div>
          <div className="sparkSub">Tipo de cambio venta · Banco Central de Costa Rica</div>
        </div>
        <div className={`sparkTrend ${isUp ? "sparkTrendUp" : "sparkTrendDown"}`}>
          <span className="sparkTrendPct">{isUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%</span>
          <span className="sparkTrendAbs">{isUp?"+":""}₡{change.toFixed(2)} en 30 días</span>
        </div>
      </div>
      <div className="sparkChartWrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="sparkSvg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#sg)"/>
          <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round"/>
          <circle cx={sx(vals.length-1)} cy={sy(last)} r="4" fill={color} stroke="#fff" strokeWidth="2"/>
        </svg>
        <div className="sparkYaxis">
          <span>{fmtV(max)}</span>
          <span>{fmtV(min)}</span>
        </div>
      </div>
      <div className="sparkStats">
        {[
          { label: "Mínimo",   val: fmtV(min) },
          { label: "Promedio", val: fmtV(avg) },
          { label: "Máximo",   val: fmtV(max) },
          { label: "Actual",   val: fmtV(last), accent: true },
        ].map(s => (
          <div key={s.label} className={`sparkStat${s.accent ? " sparkStatAccent" : ""}`}>
            <div className="sparkStatLabel">{s.label}</div>
            <div className="sparkStatVal">{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
