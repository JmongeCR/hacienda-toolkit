import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"

/* ─── Constants ─── */
import { IC } from "./constants/icons.jsx"
import { NAV, NAV_MAP, NAV_GROUPS } from "./constants/navigation.jsx"
import { loadActs, appendAct, loadFavs, saveFavs } from "./constants/storage.js"

/* ─── Utils ─── */
import { fetchJsonSafe } from "./utils/xmlHelpers.js"

/* ─── Hooks ─── */
import { useCopyFlash } from "./hooks/useCopyFlash.js"

/* ─── Components ─── */
import { CommandPalette } from "./components/CommandPalette.jsx"

/* ─── Pages ─── */
import { HomePage }           from "./pages/HomePage.jsx"
import { XmlValidatorPage }   from "./pages/XmlValidatorPage.jsx"
import { CabysPage }          from "./pages/CabysPage.jsx"
import { ContribuyentesPage } from "./pages/ContribuyentesPage.jsx"
import { ExoneracionesPage }  from "./pages/ExoneracionesPage.jsx"
import { TipoCambioPage }     from "./pages/TipoCambioPage.jsx"
import { ClientesPage }       from "./pages/ClientesPage.jsx"
import { AcercaPage }         from "./pages/AcercaPage.jsx"

/* ─── API Status helper ─── */
async function checkApiStatus() {
  const start = performance.now()
  const res = await fetch("/hacienda/fe/cabys?q=sal&top=1", { cache: "no-store" })
  const ms = Math.round(performance.now() - start)
  if (!res.ok) throw new Error("API down")
  return ms
}

export default function App() {
  /* ─── Navigation ─── */
  const [page,          setPage]          = useState("home")
  const [sideOpen,      setSideOpen]      = useState(false)
  const [sideCollapsed, setSideCollapsed] = useState(false)
  const [cmdOpen,       setCmdOpen]       = useState(false)

  /* ─── Cross-page prefill state ─── */
  const [cabysInitialQuery,    setCabysInitialQuery]    = useState(null) // { q, ts }
  const [contribuyentePrefill, setContribuyentePrefill] = useState(null) // { id, ts }
  const [facturaPrefill,       setFacturaPrefill]       = useState(null) // { key, ts }

  /* ─── navigate(id, opts?) ─── */
  const navigate = useCallback((id, opts) => {
    setPage(id)
    setSideOpen(false)
    setCmdOpen(false)
    if (opts?.prefillId)  setContribuyentePrefill({ id: opts.prefillId, ts: Date.now() })
    if (opts?.prefillKey) setFacturaPrefill({ key: opts.prefillKey, ts: Date.now() })
  }, [])

  /* ─── navigateToCabys(q) ─── */
  const navigateToCabys = useCallback((q) => {
    setPage("cabys")
    setSideOpen(false)
    setCmdOpen(false)
    setCabysInitialQuery({ q, ts: Date.now() })
  }, [])

  /* ─── navigateToContribuyente(id) ─── */
  const navigateToContribuyente = useCallback((id) => {
    setPage("contribuyente")
    setSideOpen(false)
    setCmdOpen(false)
    setContribuyentePrefill({ id, ts: Date.now() })
  }, [])

  /* ─── ⌘K / Ctrl+K ─── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(o => !o) }
      if (e.key === "Escape") setCmdOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  /* ─── Activities ─── */
  const [activities, setActivities] = useState(() => loadActs())
  const logActivity = useCallback((type, q) => {
    appendAct(type, q)
    setActivities(loadActs())
  }, [])

  /* ─── CABYS favorites ─── */
  const [cabysF_avs, setCabysF_avs] = useState(() => loadFavs())
  const toggleFav = useCallback((item) => {
    setCabysF_avs(prev => {
      const exists = prev.some(f => f.codigo === item.codigo)
      const next = exists ? prev.filter(f => f.codigo !== item.codigo) : [item, ...prev]
      saveFavs(next); return next
    })
  }, [])

  /* ─── consultarCabysRef (cross-page trigger) ─── */
  const consultarCabysRef = useRef(null)

  /* ─── Copy Flash ─── */
  const { fl, flash } = useCopyFlash()

  /* ─── API Status ─── */
  const [apiStatus, setApiStatus] = useState(null)
  const refreshApi = useCallback(async () => {
    try { const ms = await checkApiStatus(); setApiStatus({ ok: true, ms, at: new Date() }) }
    catch { setApiStatus({ ok: false, at: new Date() }) }
  }, [])

  /* ─── Tipo de Cambio ─── */
  const [fx,        setFx]        = useState(null)
  const [fxLoading, setFxLoading] = useState(false)
  const [fxEur,     setFxEur]     = useState(null)

  const fetchFx = useCallback(async () => {
    setFxLoading(true)
    try {
      const json = await fetchJsonSafe("/hacienda/indicadores/tc")
      const pV = x => x && typeof x === "object" ? x.valor ?? "" : x ?? ""
      const pF = x => x && typeof x === "object" ? x.fecha ?? "" : x ?? ""
      const cR = json?.compra ?? json?.tipoCambioCompra ?? json?.dolar?.compra ?? json?.data?.tipoCambioCompra
      const vR = json?.venta  ?? json?.tipoCambioVenta  ?? json?.dolar?.venta  ?? json?.data?.tipoCambioVenta
      const compra = Number(pV(cR)), venta = Number(pV(vR))
      if (!compra && !venta) throw new Error("Sin datos")
      const fechaUsd = json?.fecha ?? json?.data?.fecha ?? pF(cR) ?? pF(vR)
      setFx({ compra, venta, fecha: fechaUsd })
      try {
        const pV2 = x => x && typeof x === "object" ? x.valor ?? x : x
        const eurColones = json?.euro?.colones
        const eurFecha = json?.euro?.fecha ?? fechaUsd
        const eurVal = eurColones ? Number(pV2(eurColones)) : null
        if (eurVal) setFxEur({ colones: eurVal, fecha: eurFecha })
      } catch { /* silencioso */ }
    } catch { setFx(null) }
    finally { setFxLoading(false) }
  }, [])

  /* ─── TC Histórico ─── */
  const [tcHistory,     setTcHistory]     = useState([])
  const [tcHistLoading, setTcHistLoading] = useState(false)
  const fetchTcHistory = useCallback(async () => {
    setTcHistLoading(true)
    try {
      const fmtD = d => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
      const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 45)
      const base = `/bccr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicos`
      const p = ind => `?Indicador=${ind}&FechaInicio=${fmtD(start)}&FechaFinal=${fmtD(end)}&Nombre=ht&SubNiveles=N&CorreoElectronico=no@no.com&Token=NONE`
      const [rC, rV] = await Promise.all([fetch(base + p(317), { cache: "no-store" }), fetch(base + p(318), { cache: "no-store" })])
      const [tC, tV] = await Promise.all([rC.text(), rV.text()])
      const parseHist = xml => [...xml.matchAll(/<DES_FECHA>([\d/]+)<\/DES_FECHA>[\s\S]*?<NUM_VALOR>([\d.,]+)<\/NUM_VALOR>/g)]
        .map(([, f, v]) => ({ fecha: f, val: parseFloat(v.replace(",", ".")) }))
      const comp = parseHist(tC), vent = parseHist(tV)
      const map = {}
      comp.forEach(d => { map[d.fecha] = { fecha: d.fecha, compra: d.val } })
      vent.forEach(d => { if (map[d.fecha]) map[d.fecha].venta = d.val })
      setTcHistory(Object.values(map).filter(d => d.compra && d.venta).slice(-30))
    } catch { /* silencioso */ }
    finally { setTcHistLoading(false) }
  }, [])

  useEffect(() => {
    refreshApi(); fetchFx(); fetchTcHistory()
    const t = setInterval(refreshApi, 60_000)
    return () => clearInterval(t)
  }, [refreshApi, fetchFx, fetchTcHistory])

  /* ────────────────────────────────────
     RENDER — estructura idéntica a V2.0
  ──────────────────────────────────── */
  return (
    <div className={`layout${sideCollapsed ? " sideCollapsed" : ""}`}>
      {sideOpen && <div className="sideOverlay" onClick={() => setSideOpen(false)} />}

      {/* ── Command Palette ── */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        activities={activities}
        navigate={navigate}
        navigateToCabys={navigateToCabys}
        navigateToContribuyente={navigateToContribuyente}
      />

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar${sideOpen ? " sideOpen" : ""}`}>
        <div className="sideTop">
          <div className="sideBrand">
            <div className="sideLogo">{IC.bolt}</div>
            <span className="sideName">HaciendaKit</span>
          </div>
        </div>

        <nav className="sideNav">
          {NAV_GROUPS.map((g, gi) => (
            <div key={gi} className="navGroup">
              {g.label && <div className="navGroupLabel">{g.label}</div>}
              {g.items.map(id => {
                const n = NAV_MAP[id]; if (!n) return null
                return (
                  <button key={n.id} type="button"
                    className={`navItem${page === n.id ? " navActive" : ""}`}
                    title={n.label}
                    onClick={() => navigate(n.id)}>
                    <span className="navIcon">{n.icon}</span>
                    <span className="navLabel">{n.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sideBottom">
          <button type="button"
            className={`navItem navItemAcerca${page === "acerca" ? " navActive" : ""}`}
            onClick={() => navigate("acerca")}>
            <span className="navIcon">{IC.info}</span>
            <span className="navLabel">Acerca de</span>
          </button>
          <div className="sideBottomSep" />
          <button type="button" className="cmdTriggerBtn" onClick={() => setCmdOpen(true)}>
            {IC.search}
            <span className="cmdTriggerLabel">Búsqueda rápida</span>
          </button>
          <button type="button" className="sideCollapseBtn"
            onClick={() => setSideCollapsed(c => !c)}>
            {sideCollapsed ? IC.expandRight : IC.collapseLeft}
          </button>
          <div className={`apiPill${apiStatus == null ? "" : apiStatus.ok ? " apiPillOk" : " apiPillBad"}`}>
            <span className={`dot${apiStatus?.ok ? " ok" : apiStatus == null ? " loading" : " bad"}`} />
            <span className="apiPillText">
              {apiStatus == null ? "…" : apiStatus.ok ? `Hacienda · ${apiStatus.ms}ms` : "Sin respuesta"}
            </span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="mainArea">
        <header className="topbar">
          <button className="menuBtn" type="button" onClick={() => setSideOpen(s => !s)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 4.5h14M2 9h14M2 13.5h14"/>
            </svg>
          </button>

          <div className="topbarBread">
            <span className="topbarApp">HaciendaKit</span>
            <span className="topbarSep">/</span>
            <span className="topbarPage">{NAV_MAP[page]?.label}</span>
          </div>

          <button type="button" className="topbarCmdBtn" onClick={() => setCmdOpen(true)}>
            <span className="topbarCmdIcon">{IC.search}</span>
            <span className="topbarCmdPlaceholder">Buscar…</span>
          </button>

          <div className="topbarRight">
            <span className={`apiDot${apiStatus?.ok ? " apiDotOk" : apiStatus == null ? "" : " apiDotBad"}`}
              title={apiStatus?.ok ? `Hacienda ${apiStatus.ms}ms` : "Sin respuesta"} />
            {fx && (
              <div className="topbarFx" onClick={() => navigate("tipocambio")} style={{ cursor: "pointer" }}>
                <span className="topbarFxLabel">USD</span>
                <span className="topbarFxVal">₡{fx.venta.toLocaleString("es-CR")}</span>
              </div>
            )}
            {fxEur && (
              <div className="topbarFx topbarFxEur" onClick={() => navigate("tipocambio")} style={{ cursor: "pointer" }}>
                <span className="topbarFxLabel">EUR</span>
                <span className="topbarFxVal">₡{fxEur.colones.toLocaleString("es-CR")}</span>
              </div>
            )}
          </div>
        </header>

        <main className="content">

          {page === "home" && (
            <HomePage
              navigate={navigate}
              activities={activities}
              setActivities={setActivities}
              navigateToCabys={navigateToCabys}
              navigateToContribuyente={navigateToContribuyente}
            />
          )}

          {page === "factura" && (
            <XmlValidatorPage
              fl={fl} flash={flash}
              cabysF_avs={cabysF_avs}
              toggleFav={toggleFav}
              logActivity={logActivity}
              navigate={navigate}
              prefillKey={facturaPrefill?.key || ""}
            />
          )}

          {page === "cabys" && (
            <CabysPage
              fl={fl} flash={flash}
              favs={cabysF_avs}
              onToggleFav={toggleFav}
              consultarCabysRef={consultarCabysRef}
              initialQuery={cabysInitialQuery}
              logActivity={logActivity}
            />
          )}

          {page === "contribuyente" && (
            <ContribuyentesPage
              fl={fl} flash={flash}
              navigateToCabys={navigateToCabys}
              logActivity={logActivity}
              prefillId={contribuyentePrefill?.id || ""}
            />
          )}

          {page === "exoneraciones" && (
            <ExoneracionesPage logActivity={logActivity} />
          )}

          {page === "tipocambio" && (
            <TipoCambioPage
              fx={fx} fxEur={fxEur}
              fxLoading={fxLoading}
              fetchFx={fetchFx}
              tcHistory={tcHistory}
              tcHistLoading={tcHistLoading}
              fetchTcHistory={fetchTcHistory}
            />
          )}

          {page === "clientes" && (
            <ClientesPage
              navigate={navigate}
              navigateToCabys={navigateToCabys}
            />
          )}

          {page === "acerca" && (
            <AcercaPage activities={activities} />
          )}

        </main>
      </div>
    </div>
  )
}
