import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IC, ACT_ICONS, ACT_LABELS } from "../constants/icons.jsx"
import { relTime } from "../utils/formatters.js"

export function CommandPalette({ open, onClose, activities, navigate, navigateToCabys, navigateToContribuyente }) {
  const [q, setQ] = useState("")
  const inputRef = useRef(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  const isLikelyCedula = (s) => /^\d{9,11}$/.test(s.replace(/[-\s]/g,""))
  const isLikelyFe     = (s) => /^\d{30,50}$/.test(s.replace(/\s/g,""))

  const smartActions = useMemo(() => {
    const t = q.trim()
    if (!t) return []
    const results = []
    if (isLikelyCedula(t)) {
      results.push({ type:"smart", icon: IC.user,    label: `Consultar contribuyente: ${t}`, action: () => navigateToContribuyente(t) })
    } else if (isLikelyFe(t)) {
      results.push({ type:"smart", icon: IC.receipt, label: `Validar factura electrónica`,   action: () => navigate("factura") })
    } else {
      results.push({ type:"smart", icon: IC.search,  label: `Buscar CABYS: "${t}"`,          action: () => navigateToCabys(t) })
    }
    return results
  }, [q, navigate, navigateToCabys, navigateToContribuyente])

  const filteredActions = useMemo(() => {
    const all = [
      { id:"factura",       icon: IC.xml,      label: "Validador XML",               desc: "Cargá un comprobante y revisá CABYS e IVA" },
      { id:"cabys",         icon: IC.search,   label: "Asistente CABYS",             desc: "Buscá códigos por actividad o producto" },
      { id:"contribuyente", icon: IC.user,     label: "Verificar Contribuyente",     desc: "Estado fiscal y actividades económicas" },
      { id:"exoneraciones", icon: IC.shield,   label: "Exoneraciones",               desc: "Verificá exoneraciones de impuestos" },
      { id:"tipocambio",    icon: IC.currency, label: "Tipo de Cambio",              desc: "USD/CRC en tiempo real" },
    ]
    if (!q.trim()) return all
    const low = q.toLowerCase()
    return all.filter(a => a.label.toLowerCase().includes(low) || a.desc.toLowerCase().includes(low))
  }, [q])

  const recentItems = useMemo(() => {
    if (!activities?.length) return []
    return activities.slice(0, 5)
  }, [activities])

  const handleAction = useCallback((fn) => { fn(); onClose() }, [onClose])

  if (!open) return null
  return (
    <div className="cmdOverlay" onClick={onClose}>
      <div className="cmdModal" onClick={e => e.stopPropagation()}>
        <div className="cmdSearch">
          <span className="cmdSearchIcon">{IC.search}</span>
          <input ref={inputRef} className="cmdInput" value={q}
            placeholder="Buscar empresa, CABYS, factura…"
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") onClose()
              if (e.key === "Enter" && smartActions.length) handleAction(smartActions[0].action)
            }} />
          <button className="cmdClose" type="button" onClick={onClose}>{IC.x}</button>
        </div>

        <div className="cmdBody">
          {smartActions.length > 0 && (
            <div className="cmdSection">
              <div className="cmdSectionLabel">Acción directa</div>
              {smartActions.map((a, i) => (
                <button key={i} className="cmdItem cmdItemSmart" type="button" onClick={() => handleAction(a.action)}>
                  <span className="cmdItemIcon">{a.icon}</span>
                  <span className="cmdItemLabel">{a.label}</span>
                  <span className="cmdItemHint">{IC.arrowRight}</span>
                </button>
              ))}
            </div>
          )}

          {filteredActions.length > 0 && (
            <div className="cmdSection">
              <div className="cmdSectionLabel">{q.trim() ? "Herramientas" : "Acciones rápidas"}</div>
              {filteredActions.map(a => (
                <button key={a.id} className="cmdItem" type="button" onClick={() => handleAction(() => navigate(a.id))}>
                  <span className="cmdItemIcon">{a.icon}</span>
                  <div className="cmdItemText">
                    <span className="cmdItemLabel">{a.label}</span>
                    <span className="cmdItemDesc">{a.desc}</span>
                  </div>
                  <span className="cmdItemHint">{IC.arrowRight}</span>
                </button>
              ))}
            </div>
          )}

          {!q.trim() && recentItems.length > 0 && (
            <div className="cmdSection">
              <div className="cmdSectionLabel">Recientes</div>
              {recentItems.map((a, i) => (
                <button key={i} className="cmdItem" type="button" onClick={() => handleAction(() => {
                  if (a.type === "cabys") navigateToCabys(a.q)
                  else if (a.type === "contribuyente") navigateToContribuyente(a.q)
                  else navigate(a.type)
                })}>
                  <span className="cmdItemIcon">{ACT_ICONS[a.type] || IC.search}</span>
                  <div className="cmdItemText">
                    <span className="cmdItemLabel">{a.q}</span>
                    <span className="cmdItemDesc">{ACT_LABELS[a.type]} · {relTime(a.ts)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cmdFooter">
          <span>↵ ejecutar</span>
          <span>Esc cerrar</span>
        </div>
      </div>
    </div>
  )
}
