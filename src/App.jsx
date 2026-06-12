import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import "./App.css"

/* ─── Constants ─── */
import { IC } from "./constants/icons.jsx"
import { NAV, NAV_GROUPS } from "./constants/navigation.jsx"
import { loadActs, appendAct, loadFavs, saveFavs } from "./constants/storage.js"

/* ─── Utils ─── */
import { fetchJsonSafe } from "./utils/xmlHelpers.js"

/* ─── Hooks ─── */
import { useCopyFlash } from "./hooks/useCopyFlash.js"

/* ─── Components ─── */
import { CommandPalette } from "./components/CommandPalette.jsx"

/* ─── Pages ─── */
import { HomePage }          from "./pages/HomePage.jsx"
import { XmlValidatorPage }  from "./pages/XmlValidatorPage.jsx"
import { CabysPage }         from "./pages/CabysPage.jsx"
import { ContribuyentesPage } from "./pages/ContribuyentesPage.jsx"
import { ExoneracionesPage } from "./pages/ExoneracionesPage.jsx"
import { TipoCambioPage }    from "./pages/TipoCambioPage.jsx"
import { ClientesPage }      from "./pages/ClientesPage.jsx"
import { AcercaPage }        from "./pages/AcercaPage.jsx"

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
  const [cabysInitialQuery,    setCabysInitialQuery]    = useState(null)  // { q, ts }
  const [contribuyentePrefill, setContribuyentePrefill] = useState(null)  // { id, ts }
  const [facturaPrefill,       setFacturaPrefill]       = useState(null)  // { key, ts }

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

  /* ─── Sidebar active nav detection ─── */
  const activeGroup = useMemo(() => {
    return NAV_GROUPS.find(g => g.items?.includes(page))
  }, [page])

  /* ────────────────────────────────────
     RENDER
  ──────────────────────────────────── */
  return (
    <div className={`appShell${sideCollapsed ? " sideCollapsed" : ""}`}>

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sideOpen ? " sidebarOpen" : ""}`}>
        <div className="sidebarHeader">
          <div className="sidebarLogo">
            <span className="sidebarLogoIco">{IC.bolt}</span>
            {!sideCollapsed && <span className="sidebarLogoText">HaciendaKit</span>}
          </div>
          <button className="sidebarCollapseBtn" type="button" title="Colapsar menú"
            onClick={() => setSideCollapsed(c => !c)}>
            {sideCollapsed ? IC.arrowRight : IC.arrowLeft}
          </button>
        </div>

        <nav className="sidebarNav">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="navGroup">
              {group.label && !sideCollapsed && <div className="navGroupLabel">{group.label}</div>}
              {group.items.map(id => {
                const item = NAV.find(n => n.id === id)
                if (!item) return null
                return (
                  <button key={id} type="button"
                    className={`navItem${page === id ? " navItemActive" : ""}`}
                    onClick={() => navigate(id)}
                    title={sideCollapsed ? item.label : undefined}>
                    <span className="navItemIcon">{item.icon}</span>
                    {!sideCollapsed && <span className="navItemLabel">{item.label}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebarFooter">
          <button type="button" className={`cmdTrigger${sideCollapsed ? " cmdTriggerCollapsed" : ""}`}
            onClick={() => setCmdOpen(true)} title="Búsqueda rápida (⌘K)">
            {IC.search}
            {!sideCollapsed && <><span>Búsqueda rápida</span><kbd>⌘K</kbd></>}
          </button>
          {apiStatus && !sideCollapsed && (
            <div className={`apiStatusChip${apiStatus.ok ? " apiOk" : " apiErr"}`}
              title={`Hacienda API — ${apiStatus.ok ? `${apiStatus.ms}ms` : "No disponible"}`}
              onClick={refreshApi}>
              <span className="apiDot" />
              {apiStatus.ok ? `API ${apiStatus.ms}ms` : "API sin respuesta"}
            </div>
          )}
        </div>
      </aside>

      {/* ── Topbar ── */}
      <div className="topbar">
        <button className="topbarMenuBtn" type="button" onClick={() => setSideOpen(o => !o)}>
          {IC.menu}
        </button>
        <div className="topbarBreadcrumb">
          {activeGroup?.label && <span className="topbarGroup">{activeGroup.label}</span>}
          {activeGroup?.label && <span className="topbarSep">/</span>}
          <span className="topbarPage">{NAV.find(n => n.id === page)?.label || "HaciendaKit"}</span>
        </div>
        <div className="topbarRight">
          {fx && (
            <div className="topbarFx" title={`Compra ₡${fx.compra?.toLocaleString("es-CR")} · Venta ₡${fx.venta?.toLocaleString("es-CR")}`}>
              <span className="topbarFxFlag">🇺🇸</span>
              <span className="topbarFxRate">₡{fx.venta?.toLocaleString("es-CR")}</span>
            </div>
          )}
          {fxEur && (
            <div className="topbarFx" title={`EUR referencia Hacienda`}>
              <span className="topbarFxFlag">🇪🇺</span>
              <span className="topbarFxRate">₡{fxEur.colones?.toLocaleString("es-CR")}</span>
            </div>
          )}
          <button type="button" className="topbarCmdBtn" onClick={() => setCmdOpen(true)} title="Búsqueda rápida ⌘K">
            {IC.search}
          </button>
        </div>
      </div>

      {/* ── Overlay móvil ── */}
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

      {/* ── Main content ── */}
      <main className="mainContent">
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
  )
}
