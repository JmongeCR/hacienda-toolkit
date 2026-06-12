import { useEffect, useRef, useState } from "react"

const CURRENCIES = [
  { id: "crc", flag: "🇨🇷", code: "CRC", name: "Colón costarricense", symbol: "₡" },
  { id: "usd", flag: "🇺🇸", code: "USD", name: "Dólar estadounidense", symbol: "$" },
  { id: "eur", flag: "🇪🇺", code: "EUR", name: "Euro",                  symbol: "€" },
]

export { CURRENCIES }

export function CurrencySelector({ value, onChange, exclude = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const opts = CURRENCIES.filter(c => !exclude.includes(c.id))
  const sel  = CURRENCIES.find(c => c.id === value)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  return (
    <div className="currSel" ref={ref}>
      <button type="button" className="currSelBtn" onClick={() => setOpen(o => !o)}>
        <span className="currSelFlag">{sel.flag}</span>
        <span className="currSelCode">{sel.code}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`currSelArrow${open ? " open" : ""}`}>
          <path d="M1.5 3.5l3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="currSelDrop">
          {opts.map(c => (
            <button key={c.id} type="button"
              className={`currSelOpt${c.id === value ? " currSelOptAct" : ""}`}
              onClick={() => { onChange(c.id); setOpen(false) }}>
              <span className="currSelOptFlag">{c.flag}</span>
              <div>
                <div className="currSelOptCode">{c.code}</div>
                <div className="currSelOptName">{c.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
