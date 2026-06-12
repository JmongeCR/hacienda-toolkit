import { useMemo, useState } from "react"
import { IC, ACT_ICONS, ACT_LABELS } from "../constants/icons.jsx"
import { HOME_FAVS_DEFAULT, ACT_KEY, loadHomeFavs, saveHomeFavs } from "../constants/storage.js"
import { saludo, relTime } from "../utils/formatters.js"

export function HomePage({ navigate, activities, setActivities, navigateToCabys, navigateToContribuyente }) {
  const [homeSearch,    setHomeSearch]    = useState("")
  const [homeFavs,      setHomeFavs]      = useState(() => loadHomeFavs())

  const homeSearchIntent = useMemo(() => {
    const q = homeSearch.trim()
    if (!q) return null
    const digits = q.replace(/[-\s]/g, "")
    if (/^\d{9,11}$/.test(digits)) return { type: "cedula",  label: "Verificar contribuyente",      icon: "user" }
    if (/^\d{30,50}$/.test(digits)) return { type: "factura", label: "Validar factura electrónica", icon: "receipt" }
    if (q.length >= 2)              return { type: "cabys",   label: "Buscar en Asistente CABYS",   icon: "search" }
    return null
  }, [homeSearch])

  const executeHomeSearch = () => {
    const q = homeSearch.trim(); if (!q || !homeSearchIntent) return
    if (homeSearchIntent.type === "cedula") {
      navigateToContribuyente(q.replace(/[-\s]/g, ""))
    } else if (homeSearchIntent.type === "factura") {
      navigate("factura", { prefillKey: q.replace(/\D/g, "") })
    } else {
      navigateToCabys(q)
    }
    setHomeSearch("")
  }

  const QUICK_CARDS = [
    { id:"factura",       icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l-3 3 3 3M16 6l3 3-3 3M13 3L7 17"/></svg>,
      label:"Validador XML",       desc:"CABYS, IVA e inconsistencias",  color:"#f5f3ff", iconColor:"#7c3aed" },
    { id:"cabys",         icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L5 11h4v7l6-9h-4L10 2z" fill="currentColor"/></svg>,
      label:"Asistente CABYS",     desc:"Códigos y tarifas de IVA",      color:"#f0f9ff", iconColor:"#2563eb" },
    { id:"contribuyente", icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="7" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M7 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
      label:"Contribuyentes",      desc:"Estado fiscal y actividades",   color:"#f0fdf4", iconColor:"#16a34a" },
    { id:"tipocambio",    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 8h12M13 5l3 3-3 3M16 12H4M7 15l-3-3 3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      label:"Tipo de Cambio",      desc:"USD y EUR en tiempo real",      color:"#fdf4ff", iconColor:"#9333ea" },
  ]

  return (
    <div className="homeWrap">
      {/* Hero */}
      <div className="homeHero">
        <div className="homeGreeting">{saludo()}</div>
        <h1 className="homeTitle">Revisión de comprobantes XML</h1>
        <p className="homeSub">Cargá un XML de Hacienda para validar CABYS, IVA y detectar inconsistencias. También consultá contribuyentes, exoneraciones y tipo de cambio.</p>
      </div>

      {/* Buscador inteligente */}
      <div className="homeSearchWrap">
        <div className="homeSearchBar">
          <span className="homeSearchIcon">{IC.search}</span>
          <input
            className="homeSearchInput"
            value={homeSearch}
            placeholder="Buscar empresa, CABYS, actividad económica o factura..."
            onChange={e => setHomeSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") executeHomeSearch() }}
            autoComplete="off"
          />
          <button type="button" className="homeSearchBtn" onClick={executeHomeSearch} disabled={!homeSearchIntent}>
            {IC.arrowRight} Buscar
          </button>
        </div>
        <div className="homeSearchHint">
          {homeSearchIntent ? (
            <>
              <span className="homeSearchHintDot" />
              {homeSearchIntent.type === "cedula"  && <>{IC.user}    Cédula detectada → <strong>Verificar contribuyente</strong></>}
              {homeSearchIntent.type === "factura" && <>{IC.receipt} Clave FE detectada → <strong>Validar factura</strong></>}
              {homeSearchIntent.type === "cabys"   && <>{IC.search}  Texto libre → <strong>Buscar en Asistente CABYS</strong></>}
            </>
          ) : (
            <span className="homeSearchHintEmpty">Ingrese una cédula, clave de factura o cualquier término</span>
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="homeSectionTitle">Accesos rápidos</div>
      <div className="homeQuickGrid">
        {QUICK_CARDS.map(q => (
          <button key={q.id} type="button" className="homeQuickCard" onClick={() => navigate(q.id)}>
            <div className="homeQuickIcon" style={{ background: q.color, color: q.iconColor }}>{q.icon}</div>
            <div className="homeQuickLabel">{q.label}</div>
            <div className="homeQuickDesc">{q.desc}</div>
          </button>
        ))}
      </div>

      {/* Favoritos */}
      <div className="homeSectionTitle">⭐ Favoritos</div>
      <div className="homeFavsRow">
        {homeFavs.map(f => (
          <button key={f.id} type="button" className="homeFavChip"
            onClick={() => navigateToCabys(f.query)}>
            <span className="homeFavIcon">⭐</span>
            <span>{f.label}</span>
            <span className="homeFavRemove" onClick={e => {
              e.stopPropagation()
              const next = homeFavs.filter(x => x.id !== f.id)
              setHomeFavs(next); saveHomeFavs(next)
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </span>
          </button>
        ))}
        {homeFavs.length === 0 && (
          <button type="button" className="homeFavChip homeFavReset"
            onClick={() => { setHomeFavs(HOME_FAVS_DEFAULT); saveHomeFavs(HOME_FAVS_DEFAULT) }}>
            Restaurar favoritos por defecto
          </button>
        )}
      </div>

      {/* Recientes */}
      {activities.length > 0 && (
        <>
          <div className="homeSectionTitle" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span>🕒 Recientes</span>
            <button type="button" className="homeClearBtn" onClick={() => {
              localStorage.removeItem(ACT_KEY); setActivities([])
            }}>Limpiar</button>
          </div>
          <div className="homeRecentList">
            {activities.slice(0, 7).map((a, i) => (
              <button key={i} type="button" className="homeRecentItem" onClick={() => navigate(a.type)}>
                <span className="homeRecentIcon">{ACT_ICONS[a.type] || IC.search}</span>
                <div className="homeRecentBody">
                  <div className="homeRecentLabel">{a.q}</div>
                  <div className="homeRecentType">{ACT_LABELS[a.type]}</div>
                </div>
                <span className="homeRecentTime">{relTime(a.ts)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
