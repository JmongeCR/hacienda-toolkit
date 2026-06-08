import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import "./App.css"

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
async function checkApiStatus() {
  const start = performance.now()
  const res = await fetch("/hacienda/fe/ae?identificacion=110220294", { cache: "no-store" })
  const ms = Math.round(performance.now() - start)
  if (!res.ok) throw new Error("API down")
  return ms
}

function formatFechaCR(fecha) {
  if (!fecha) return ""
  const d = new Date(fecha)
  if (isNaN(d)) return fecha
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })
}

function onlyDigits(s) { return (s || "").replace(/\D+/g, "") }
function isValidAeId(s) { const v = onlyDigits(s); return v.length === 9 || v.length === 10 || v.length === 11 }

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {}
  try {
    const ta = document.createElement("textarea")
    ta.value = text; document.body.appendChild(ta); ta.select()
    document.execCommand("copy"); document.body.removeChild(ta); return true
  } catch { return false }
}

function toCsv(rows, headers) {
  const esc = (v) => { const s = String(v ?? ""); const t = s.replace(/"/g,'""'); return /[",\n]/.test(t)?`"${t}"`:t }
  return `${headers.map(esc).join(",")}\n${rows.map(r=>r.map(esc).join(",")).join("\n")}\n`
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href=url; a.download=filename
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

function downloadXlsx(filename, sheetName, rows, headerOrder) {
  const data = rows.map(r => { const o={}; headerOrder.forEach(h=>(o[h]=r[h]??"")); return o })
  const ws = XLSX.utils.json_to_sheet(data, { header: headerOrder })
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  downloadBlob(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
}

async function fetchJsonSafe(url) {
  const res = await fetch(url, { cache: "no-store" })
  const ct = (res.headers.get("content-type") || "").toLowerCase()
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (!ct.includes("application/json")) throw new Error(`Respuesta no es JSON: ${text.slice(0,100)}`)
  try { return JSON.parse(text) } catch { throw new Error(`JSON inválido: ${text.slice(0,100)}`) }
}

function normalizeGometa(json) {
  if (!json) return []
  const arr = Array.isArray(json?.results) ? json.results : Array.isArray(json) ? json : [json]
  return arr.map((x,i) => ({
    id: x?.cedula||x?.rawcedula||x?.id||String(i),
    cedula: x?.cedula||x?.rawcedula||"",
    nombre: x?.fullname||x?.nombre||x?.name||"",
    tipo: x?.guess_type||x?.tipo||x?.type||"",
  })).filter(x=>x.cedula||x.nombre)
}

/* ─── Historial localStorage ─── */
const H = 5
const loadH = k => { try { return JSON.parse(localStorage.getItem(k)||"[]") } catch { return [] } }
const saveH = (k,v) => { if(!v?.trim()) return; const p=loadH(k); localStorage.setItem(k,JSON.stringify([v,...p.filter(x=>x!==v)].slice(0,H))) }

/* ─── Copy flash hook ─── */
function useCopyFlash() {
  const [fl, setFl] = useState(null)
  const t = useRef({})
  const flash = useCallback(async (id, fn) => {
    const text = typeof fn === "function" ? await fn() : fn
    if (!await copyText(text)) return
    clearTimeout(t.current[id]); setFl(id)
    t.current[id] = setTimeout(() => setFl(f => f===id?null:f), 1500)
  }, [])
  return { fl, flash }
}

/* ─── Chip con color ─── */
function ChipStatus({ label, value }) {
  if (!value) return null
  const v = String(value).toUpperCase()
  const cls = v==="NO" ? "chipGood" : (v==="SI"||v==="NO INSCRITO") ? "chipBad" : v==="INSCRITO" ? "chipGood" : ""
  return <span className={`chip ${cls}`}>{label}: {value}</span>
}

/* ─── CopyBtn ─── */
function CopyBtn({ id, label, getText, disabled, fl, flash }) {
  const active = fl === id
  return (
    <button className={`btn btnGhost${active?" btnFlashed":""}`} onClick={()=>flash(id,getText)}
      disabled={disabled||active} type="button">
      {active ? "✓ Copiado" : label}
    </button>
  )
}

/* ─── HistoryRow ─── */
function HistoryRow({ items, onSelect }) {
  if (!items.length) return null
  return (
    <div className="historyRow">
      {items.map(h => (
        <button key={h} type="button" className="historyChip" onClick={() => onSelect(h)}>{h}</button>
      ))}
    </div>
  )
}

/* ─── EmptyState ─── */
function EmptyState({ msg }) {
  return <div className="emptyState"><span className="emptyIcon">○</span><span>{msg}</span></div>
}

/* ─── PageHeader ─── */
function PageHeader({ icon, title, description }) {
  return (
    <div className="pageHeader">
      <div className="pageHeaderIcon">{icon}</div>
      <div>
        <h1 className="pageTitle">{title}</h1>
        <p className="pageDesc">{description}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   NAV CONFIG
───────────────────────────────────────────── */
const NAV = [
  { id: "home",          icon: "⊞",  label: "Inicio" },
  { id: "cabys",         icon: "🔍", label: "CABYS" },
  { id: "contribuyente", icon: "👤", label: "Contribuyente" },
  { id: "cedulas",       icon: "🪪",  label: "Cédulas TSE" },
  { id: "tipocambio",    icon: "💱", label: "Tipo de Cambio" },
  { id: "factura",       icon: "🧾", label: "Factura Electrónica" },
]

/* ═════════════════════════════════════════════
   APP ROOT
═════════════════════════════════════════════ */
export default function App() {
  const [page, setPage] = useState("home")
  const [sideOpen, setSideOpen] = useState(false)

  const navigate = (id) => { setPage(id); setSideOpen(false) }

  /* ─── API STATUS ─── */
  const [apiStatus, setApiStatus] = useState(null)
  const refreshApi = async () => {
    try { const ms = await checkApiStatus(); setApiStatus({ ok: true, ms, at: new Date() }) }
    catch { setApiStatus({ ok: false, at: new Date() }) }
  }

  /* ─── TIPO DE CAMBIO ─── */
  const [fx, setFx] = useState(null)
  const [fxLoading, setFxLoading] = useState(false)
  const [fxError, setFxError] = useState("")

  const fetchFx = useCallback(async () => {
    setFxLoading(true); setFxError("")
    try {
      const json = await fetchJsonSafe("/hacienda/indicadores/tc")
      const pV = x => x && typeof x==="object" ? x.valor??""  : x??""
      const pF = x => x && typeof x==="object" ? x.fecha??""  : x??""
      const cR = json?.compra??json?.tipoCambioCompra??json?.dolar?.compra??json?.data?.tipoCambioCompra
      const vR = json?.venta ??json?.tipoCambioVenta ??json?.dolar?.venta ??json?.data?.tipoCambioVenta
      const compra = Number(pV(cR)), venta = Number(pV(vR))
      if (!compra && !venta) throw new Error("Sin datos")
      setFx({ compra, venta, fecha: json?.fecha??json?.data?.fecha??pF(cR)??pF(vR) })
    } catch { setFx(null); setFxError("No disponible") }
    finally { setFxLoading(false) }
  }, [])

  useEffect(() => {
    refreshApi(); fetchFx()
    const t = setInterval(refreshApi, 60_000)
    return () => clearInterval(t)
  }, [fetchFx])

  /* ─── CONVERSOR ─── */
  const [fxInput, setFxInput] = useState("")
  const [fxDir,   setFxDir]   = useState("usd2crc")
  const fxResult = useMemo(() => {
    if (!fx || fxInput === "") return null
    const n = parseFloat(fxInput.replace(/,/g,""))
    if (isNaN(n) || n < 0) return null
    return fxDir === "usd2crc"
      ? (n * fx.venta).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (n / fx.compra).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [fx, fxInput, fxDir])

  /* ─── COPY FLASH ─── */
  const { fl, flash } = useCopyFlash()

  /* ─── TC HISTÓRICO ─── */
  const todayStr = useMemo(() => new Date().toISOString().slice(0,10), [])
  const [tcFecha,   setTcFecha]   = useState(todayStr)
  const [tcData,    setTcData]    = useState(null)
  const [tcLoading, setTcLoading] = useState(false)
  const [tcError,   setTcError]   = useState("")
  const [tcSearched,setTcSearched]= useState(false)

  const consultarTc = async () => {
    if (!tcFecha) return
    setTcLoading(true); setTcError(""); setTcSearched(true)
    try {
      const [y,m,d] = tcFecha.split("-"); const f = `${d}/${m}/${y}`
      const base = `/bccr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicos`
      const p = ind => `?Indicador=${ind}&FechaInicio=${f}&FechaFinal=${f}&Nombre=ht&SubNiveles=N&CorreoElectronico=no@no.com&Token=NONE`
      const [rC, rV] = await Promise.all([fetch(base+p(317),{cache:"no-store"}), fetch(base+p(318),{cache:"no-store"})])
      const [tC, tV] = await Promise.all([rC.text(), rV.text()])
      const xv = xml => { const m = xml.match(/<NUM_VALOR>([\d.,]+)<\/NUM_VALOR>/); return m ? parseFloat(m[1].replace(",",".")) : null }
      const compra = xv(tC), venta = xv(tV)
      if (!compra && !venta) throw new Error("Sin datos para esa fecha — puede ser feriado o fin de semana")
      setTcData({ compra, venta, fecha: tcFecha })
    } catch(e) { setTcData(null); setTcError(e?.message||"Error") }
    finally { setTcLoading(false) }
  }

  /* ─── CABYS ─── */
  const [cabysQ,        setCabysQ]       = useState("")
  const [cabysTop,      setCabysTop]     = useState(10)
  const [cabysData,     setCabysData]    = useState([])
  const [cabysLoading,  setCabysLoading] = useState(false)
  const [cabysError,    setCabysError]   = useState("")
  const [cabysPage,     setCabysPage]    = useState(0)
  const [cabysLastTop,  setCabysLastTop] = useState(0)
  const [cabysSearched, setCabysSearched]= useState(false)
  const [cabysHist,     setCabysHist]    = useState(() => loadH("ht_cabys"))

  const cabysQ_   = useMemo(() => cabysQ.trim(), [cabysQ])
  const pageSize  = useMemo(() => { const n=Number(cabysTop); return Number.isFinite(n)&&n>0 ? Math.min(50,Math.max(5,n)) : 10 }, [cabysTop])

  const consultarCabys = async ({ reset=false, q: qOv }={}) => {
    const q = (qOv??cabysQ_).trim(); if(!q) return
    if(reset) setCabysPage(0)
    setCabysLoading(true); setCabysError(""); setCabysSearched(true)
    try {
      const pg = reset ? 0 : cabysPage
      const top = Math.min(50, pageSize*(pg+1)); setCabysLastTop(top)
      const res = await fetch(`/hacienda/fe/cabys?q=${encodeURIComponent(q)}&top=${top}`,{cache:"no-store"})
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json(); setCabysData(json.cabys||[])
      if(reset) { saveH("ht_cabys",q); setCabysHist(loadH("ht_cabys")); setCabysPage(0) }
    } catch(e) { setCabysData([]); setCabysError(e?.message||"Error") }
    finally { setCabysLoading(false) }
  }

  const cabysNext = async () => {
    const np = cabysPage+1, need = Math.min(50, pageSize*(np+1))
    if(cabysData.length < need) {
      setCabysLoading(true); setCabysError("")
      try {
        const res = await fetch(`/hacienda/fe/cabys?q=${encodeURIComponent(cabysQ_)}&top=${need}`,{cache:"no-store"})
        if(!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json(); setCabysData(json.cabys||[]); setCabysLastTop(need)
      } catch(e) { setCabysError(e?.message||"Error"); setCabysLoading(false); return }
      finally { setCabysLoading(false) }
    } else { setCabysLastTop(need) }
    setCabysPage(np)
  }

  const cabysTotal = cabysData.length
  const cabysStart = cabysPage*pageSize, cabysEnd = cabysStart+pageSize
  const cabysRows  = cabysData.slice(cabysStart, cabysEnd)
  const cabysHasNext = cabysEnd<cabysTotal||(cabysTotal===cabysLastTop&&cabysLastTop<50)

  /* ─── AE ─── */
  const [aeId,       setAeId]      = useState("")
  const [aeData,     setAeData]    = useState(null)
  const [aeLoading,  setAeLoading] = useState(false)
  const [aeError,    setAeError]   = useState("")
  const [aeSearched, setAeSearched]= useState(false)
  const [aeHist,     setAeHist]    = useState(() => loadH("ht_ae"))
  const aeLastQ = useRef("")

  const aeDigits = useMemo(() => onlyDigits(aeId), [aeId])
  const aeValid  = useMemo(() => isValidAeId(aeId), [aeId])

  const consultarAE = async (idOv) => {
    const digits = idOv ? onlyDigits(idOv) : aeDigits
    if(!isValidAeId(digits)) return
    setAeLoading(true); setAeError(""); setAeSearched(true)
    try {
      const res = await fetch(`/hacienda/fe/ae?identificacion=${digits}`,{cache:"no-store"})
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json(); setAeData(json)
      aeLastQ.current = digits; saveH("ht_ae",digits); setAeHist(loadH("ht_ae"))
    } catch(e) { setAeData(null); setAeError(e?.message||"Error") }
    finally { setAeLoading(false) }
  }

  const aeJsonId = useMemo(() => {
    const raw = aeData?.identificacion??aeData?.identificacionTributaria??aeData?.cedula??aeData?.id??""
    return onlyDigits(String(raw)) || aeLastQ.current
  }, [aeData])

  const aeResumen = () => {
    if(!aeData) return ""; const s=aeData?.situacion||{}
    return [`Contribuyente (AE)`,`Nombre: ${aeData.nombre||"-"}`,`Identificación: ${aeJsonId||"-"}`,
      `Régimen: ${aeData.regimen?.descripcion||"-"}`,`Estado: ${s.estado||"-"}`,
      `Moroso: ${s.moroso||"-"}`,`Omiso: ${s.omiso||"-"}`,
      `AT: ${s.administracionTributaria||"-"}`].join("\n")
  }

  const aeActCsv = () => {
    if(!aeData?.actividades?.length) return ""
    return toCsv(aeData.actividades.map(a=>[a.codigo,a.descripcion,a.tipo==="P"?"Principal":"Secundaria",a.estado==="A"?"Activa":"Inactiva"]),["codigo","descripcion","tipo","estado"])
  }

  /* ─── CÉDULAS ─── */
  const [cedQ,       setCedQ]      = useState("")
  const [cedItems,   setCedItems]  = useState([])
  const [cedLoading, setCedLoading]= useState(false)
  const [cedError,   setCedError]  = useState("")
  const [cedSearched,setCedSearched]=useState(false)
  const [cedHist,    setCedHist]   = useState(() => loadH("ht_ced"))

  const cedQ_ = useMemo(() => cedQ.trim(), [cedQ])

  const consultarCed = async (qOv) => {
    const q = (qOv??cedQ_).trim(); if(!q) return
    setCedLoading(true); setCedError(""); setCedItems([]); setCedSearched(true)
    try {
      const json = await fetchJsonSafe(`/gometa/cedulas/${encodeURIComponent(q)}`)
      setCedItems(normalizeGometa(json))
      saveH("ht_ced",q); setCedHist(loadH("ht_ced"))
    } catch(e) { setCedError(e?.message||"Error") }
    finally { setCedLoading(false) }
  }

  /* ─── FACTURA ─── */
  const [feKey,      setFeKey]     = useState("")
  const [feData,     setFeData]    = useState(null)
  const [feNotFound, setFeNotFound]= useState(false)
  const [feLoading,  setFeLoading] = useState(false)
  const [feError,    setFeError]   = useState("")
  const [feSearched, setFeSearched]= useState(false)

  const feClean = useMemo(() => onlyDigits(feKey), [feKey])
  const feValid = feClean.length === 50

  /* Decodifica los campos de la clave numérica de 50 dígitos */
  const feDecoded = useMemo(() => {
    if (feClean.length !== 50) return null
    // Formato oficial Hacienda CR (50 dígitos):
    // 1-3: país (506), 4-5: día, 6-7: mes, 8-9: año,
    // 10-21: cédula emisor (12d), 22-24: terminal (3d),
    // 25-41: consecutivo (17d), 42: situación, 43-50: seguridad
    const pais      = feClean.slice(0, 3)             // 506
    const dia       = feClean.slice(3, 5)
    const mes       = feClean.slice(5, 7)
    const anio      = feClean.slice(7, 9)
    const cedula    = feClean.slice(9, 21).replace(/^0+/, "")
    const terminal  = feClean.slice(21, 24)
    const consec    = feClean.slice(24, 41)
    const situacion = feClean.slice(41, 42)
    const seguridad = feClean.slice(42, 50)
    // Los primeros 3 dígitos del consecutivo = tipo de comprobante
    const tipoConsec = consec.slice(0, 3)
    const tipos = { "001":"Factura Electrónica","002":"Nota de Débito","003":"Nota de Crédito","004":"Tiquete Electrónico","008":"FE de Compra","009":"FE de Exportación" }
    const sits  = { "1":"Normal","2":"Contingencia","3":"Sin internet" }
    return {
      pais,
      tipo: tipos[tipoConsec] || `Comprobante ${tipoConsec}`,
      fecha: `${dia}/${mes}/20${anio}`,
      cedula,
      terminal,
      consecutivo: consec.replace(/^0+/, ""),
      situacion: sits[situacion] || situacion,
      seguridad,
    }
  }, [feClean])

  const consultarFe = async () => {
    if(!feValid) return
    setFeLoading(true); setFeError(""); setFeSearched(true); setFeData(null); setFeNotFound(false)
    try {
      const res = await fetch(`/hacienda/fe/documento?clave=${feClean}`,{cache:"no-store"})
      if(res.status===404) { setFeNotFound(true); return }
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if(json?.code===404) { setFeNotFound(true); return }
      setFeData(json)
    } catch(e) { setFeError(e?.message||"Error consultando la API") }
    finally { setFeLoading(false) }
  }

  const feResumen = () => {
    if(!feData) return ""
    return [`Factura Electrónica`,`Clave: ${feClean}`,
      `Estado: ${feData?.ind_estado||feData?.estado||"-"}`,
      feData?.emisor?.nombre  ? `Emisor: ${feData.emisor.nombre}`   : "",
      feData?.receptor?.nombre? `Receptor: ${feData.receptor.nombre}`: "",
      feData?.fecha           ? `Fecha: ${feData.fecha}`             : "",
      feData?.totalComprobante? `Total: ₡${Number(feData.totalComprobante).toLocaleString("es-CR",{minimumFractionDigits:2})}` : "",
    ].filter(Boolean).join("\n")
  }

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="layout">
      {/* ── Overlay mobile ── */}
      {sideOpen && <div className="sideOverlay" onClick={()=>setSideOpen(false)} />}

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar${sideOpen?" sideOpen":""}`}>
        <div className="sideTop">
          <div className="sideBrand">
            <span className="sideLogo">⚡</span>
            <span className="sideName">HaciendaKit</span>
          </div>
        </div>

        <nav className="sideNav">
          {NAV.map(n => (
            <button key={n.id} type="button"
              className={`navItem${page===n.id?" navActive":""}`}
              onClick={() => navigate(n.id)}>
              <span className="navIcon">{n.icon}</span>
              <span className="navLabel">{n.label}</span>
              {page===n.id && <span className="navDot"/>}
            </button>
          ))}
        </nav>

        <div className="sideBottom">
          <div className={`apiPill${apiStatus?.ok?" apiPillOk":" apiPillBad"}`}>
            <span className={`dot${apiStatus?.ok?" ok":" bad"}`}/>
            <span>{apiStatus?.ok ? `API OK · ${apiStatus.ms}ms` : "API sin respuesta"}</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="mainArea">
        {/* Topbar */}
        <header className="topbar">
          <button className="menuBtn" type="button" onClick={()=>setSideOpen(s=>!s)}>☰</button>
          <div className="topbarBread">
            <span className="topbarApp">HaciendaKit</span>
            <span className="topbarSep">›</span>
            <span className="topbarPage">{NAV.find(n=>n.id===page)?.label}</span>
          </div>
          {fx && (
            <div className="topbarFx">
              <span className="topbarFxLabel">USD/CRC</span>
              <span className="topbarFxVal">₡{fx.venta.toLocaleString("es-CR")}</span>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="content">

          {/* ══ INICIO ══ */}
          {page === "home" && (
            <div className="pageWrap">
              <PageHeader icon="⊞" title="Inicio" description="Panel general — estado del sistema y tipo de cambio en tiempo real." />

              <div className="homeGrid">
                {/* API status */}
                <div className="statCard">
                  <div className="statLabel">Estado API Hacienda</div>
                  <div className={`statVal${apiStatus?.ok?" statGood":" statBad"}`}>
                    {apiStatus == null ? "Verificando…" : apiStatus.ok ? "Operacional" : "Sin respuesta"}
                  </div>
                  {apiStatus?.ok && <div className="statSub">{apiStatus.ms} ms · última revisión {apiStatus.at.toLocaleTimeString()}</div>}
                  <button className="btn btnGhost" style={{marginTop:12}} onClick={refreshApi} type="button">↻ Revisar ahora</button>
                </div>

                {/* TC compra */}
                <div className="statCard">
                  <div className="statLabel">Tipo de cambio — Compra</div>
                  <div className="statVal statPurple">
                    {fxLoading ? "…" : fx ? `₡${fx.compra.toLocaleString("es-CR")}` : "—"}
                  </div>
                  {fx && <div className="statSub">Al {formatFechaCR(fx.fecha)}</div>}
                </div>

                {/* TC venta */}
                <div className="statCard">
                  <div className="statLabel">Tipo de cambio — Venta</div>
                  <div className="statVal statPurple">
                    {fxLoading ? "…" : fx ? `₡${fx.venta.toLocaleString("es-CR")}` : "—"}
                  </div>
                  {fx && <div className="statSub">Fuente: BCCR</div>}
                </div>

                {/* Accesos rápidos */}
                <div className="quickCard">
                  <div className="statLabel" style={{marginBottom:12}}>Acceso rápido</div>
                  <div className="quickGrid">
                    {NAV.filter(n=>n.id!=="home").map(n=>(
                      <button key={n.id} type="button" className="quickBtn" onClick={()=>navigate(n.id)}>
                        <span className="quickIcon">{n.icon}</span>
                        <span>{n.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Conversor en Inicio */}
              {fx && (
                <div className="sectionBlock">
                  <h2 className="sectionTitle">Conversor USD ↔ CRC</h2>
                  <ConversorUI fx={fx} fxInput={fxInput} setFxInput={setFxInput}
                    fxDir={fxDir} setFxDir={setFxDir} fxResult={fxResult} />
                </div>
              )}
            </div>
          )}

          {/* ══ CABYS ══ */}
          {page === "cabys" && (
            <div className="pageWrap">
              <PageHeader icon="🔍" title="Consulta CABYS"
                description="Buscá productos y servicios del Catálogo de Bienes y Servicios para facturación electrónica." />
              <div className="toolCard">
                <div className="toolSection">
                  <label className="lbl">Búsqueda por nombre o código</label>
                  <div className="inputRow">
                    <input className="inp" value={cabysQ} placeholder="Ej: arroz · servicios contables · 1010101…"
                      onChange={e=>{setCabysQ(e.target.value);setCabysPage(0)}}
                      onKeyDown={e=>{if(e.key==="Enter")consultarCabys({reset:true})}} />
                    <button className="btn btnPrimary" onClick={()=>consultarCabys({reset:true})}
                      disabled={!cabysQ_.length||cabysLoading} type="button">
                      {cabysLoading?"Buscando…":"Buscar"}
                    </button>
                  </div>
                  <HistoryRow items={cabysHist} onSelect={h=>{setCabysQ(h);setCabysPage(0);consultarCabys({reset:true,q:h})}} />
                </div>

                <div className="toolSection toolRow">
                  <div>
                    <label className="lbl">Resultados por página</label>
                    <input className="inp inpSmall" type="number" min="5" max="50" value={cabysTop}
                      onChange={e=>{setCabysTop(e.target.value);setCabysPage(0)}} />
                  </div>
                  <div className="toolActions">
                    <CopyBtn id="cabys-csv" label="Copiar CSV" fl={fl} flash={flash}
                      getText={()=>toCsv(cabysRows.map(c=>[c.codigo,c.descripcion,`${c.impuesto}%`]),["codigo","descripcion","impuesto"])}
                      disabled={!cabysRows.length} />
                    <button className="btn btnGhost" onClick={()=>{
                      if(!cabysRows.length) return
                      downloadXlsx("cabys.xlsx","CABYS",cabysRows.map(c=>({codigo:c.codigo,descripcion:c.descripcion,impuesto:`${c.impuesto}%`})),["codigo","descripcion","impuesto"])
                    }} type="button">Descargar XLSX</button>
                  </div>
                </div>

                {cabysError && <div className="alertBox">⚠️ {cabysError}</div>}
                {cabysSearched && !cabysLoading && !cabysError && !cabysTotal && <EmptyState msg={`Sin resultados para "${cabysQ_}"`} />}

                {cabysTotal > 0 && (
                  <div className="pager">
                    <button className="btn btnGhost" disabled={cabysPage===0} onClick={()=>setCabysPage(p=>Math.max(0,p-1))} type="button">◀</button>
                    <span className="muted">Pág. {cabysPage+1} · {Math.min(cabysEnd,cabysTotal)} de {cabysTotal}</span>
                    <button className="btn btnGhost" disabled={!cabysHasNext} onClick={cabysNext} type="button">▶</button>
                  </div>
                )}

                {cabysRows.length > 0 && (
                  <div className="tableWrap">
                    <table>
                      <thead><tr><th>Código</th><th>Descripción</th><th>Impuesto</th><th className="thR">Copiar</th></tr></thead>
                      <tbody>
                        {cabysRows.map(c=>(
                          <tr key={c.codigo}>
                            <td className="mono">{c.codigo}</td>
                            <td>{c.descripcion}</td>
                            <td><span className="taxBadge">{c.impuesto}%</span></td>
                            <td className="thR">
                              <button className={`iconBtn${fl===`cc-${c.codigo}`?" flashed":""}`} type="button"
                                onClick={()=>flash(`cc-${c.codigo}`,String(c.codigo||""))}>
                                {fl===`cc-${c.codigo}`?"✓":"📋"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ CONTRIBUYENTE ══ */}
          {page === "contribuyente" && (
            <div className="pageWrap">
              <PageHeader icon="👤" title="Consulta de Contribuyente"
                description="Verificá el estado tributario, régimen, actividades económicas y situación fiscal de un contribuyente." />
              <div className="toolCard">
                <div className="toolSection">
                  <label className="lbl">Número de identificación</label>
                  <div className="inputRow">
                    <input className="inp" value={aeId} inputMode="numeric" placeholder="Solo números — 9, 10 u 11 dígitos"
                      onChange={e=>setAeId(onlyDigits(e.target.value))}
                      onKeyDown={e=>{if(e.key==="Enter")consultarAE()}} />
                    <button className="btn btnPrimary" onClick={()=>consultarAE()} disabled={!aeValid||aeLoading} type="button">
                      {aeLoading?"Consultando…":"Consultar"}
                    </button>
                  </div>
                  {!aeValid && aeId.length>0 && <div className="hintBad">Debe tener 9, 10 u 11 dígitos.</div>}
                  <HistoryRow items={aeHist} onSelect={h=>{setAeId(h);consultarAE(h)}} />
                </div>

                {aeData && (
                  <div className="toolSection toolActions">
                    <CopyBtn id="ae-res" label="Copiar resumen" fl={fl} flash={flash} getText={aeResumen} disabled={!aeData} />
                    <CopyBtn id="ae-csv" label="Copiar CSV actividades" fl={fl} flash={flash} getText={aeActCsv} disabled={!aeData?.actividades?.length} />
                    <button className="btn btnGhost" onClick={()=>{
                      if(!aeData?.actividades?.length) return
                      downloadXlsx("actividades_ae.xlsx","Actividades",
                        aeData.actividades.map(a=>({codigo:a.codigo,descripcion:a.descripcion,tipo:a.tipo==="P"?"Principal":"Secundaria",estado:a.estado==="A"?"Activa":"Inactiva"})),
                        ["codigo","descripcion","tipo","estado"])
                    }} type="button">Descargar XLSX</button>
                  </div>
                )}

                {aeError && <div className="alertBox">⚠️ {aeError}</div>}
                {aeSearched && !aeLoading && !aeError && !aeData && <EmptyState msg={`No se encontró contribuyente para "${aeDigits}"`} />}

                {aeData && (
                  <>
                    <div className="aeBox">
                      <div className="aeHeader">
                        <div className="aeField"><div className="lbl">Nombre</div><div className="aeVal">{aeData.nombre}</div></div>
                        <div className="aeField"><div className="lbl">Identificación</div><div className="aeVal mono">{aeJsonId}</div></div>
                        <div className="aeField"><div className="lbl">Régimen</div><div className="aeVal">{aeData.regimen?.descripcion||"—"}</div></div>
                      </div>
                      <div className="aeChips">
                        <ChipStatus label="Estado" value={aeData.situacion?.estado} />
                        <ChipStatus label="Moroso" value={aeData.situacion?.moroso} />
                        <ChipStatus label="Omiso"  value={aeData.situacion?.omiso} />
                        {aeData.situacion?.administracionTributaria && (
                          <span className="chip">AT: {aeData.situacion.administracionTributaria}</span>
                        )}
                      </div>
                      <a href="https://ovitribucr.hacienda.go.cr/ConsultaPublica/" target="_blank" rel="noopener noreferrer" className="linkExterno">
                        Ver en Hacienda ↗
                      </a>
                    </div>

                    {aeData.actividades?.length > 0 && (
                      <div className="tableWrap">
                        <table>
                          <thead><tr><th>Código</th><th>Descripción</th><th>Tipo</th><th>Estado</th></tr></thead>
                          <tbody>
                            {aeData.actividades.map(a=>(
                              <tr key={`${a.codigo}-${a.tipo}`}>
                                <td className="mono">{a.codigo}</td>
                                <td>{a.descripcion}</td>
                                <td>{a.tipo==="P"?"Principal":"Secundaria"}</td>
                                <td><span className={`estadoBadge${a.estado==="A"?" activa":" inactiva"}`}>{a.estado==="A"?"Activa":"Inactiva"}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ CÉDULAS TSE ══ */}
          {page === "cedulas" && (
            <div className="pageWrap">
              <PageHeader icon="🪪" title="Consulta de Cédulas TSE"
                description="Buscá personas físicas y jurídicas registradas en el Tribunal Supremo de Elecciones." />
              <div className="toolCard">
                <div className="toolSection">
                  <label className="lbl">Búsqueda por cédula o nombre</label>
                  <div className="inputRow">
                    <input className="inp" value={cedQ} placeholder="Ej: 116740278 o Juan Pérez García"
                      onChange={e=>setCedQ(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")consultarCed()}} />
                    <button className="btn btnPrimary" onClick={()=>consultarCed()} disabled={!cedQ_.length||cedLoading} type="button">
                      {cedLoading?"Buscando…":"Buscar"}
                    </button>
                  </div>
                  <HistoryRow items={cedHist} onSelect={h=>{setCedQ(h);consultarCed(h)}} />
                </div>

                {cedItems.length > 0 && (
                  <div className="toolSection toolActions">
                    <button className="btn btnGhost" onClick={()=>downloadXlsx("cedulas_tse.xlsx","Cedulas",cedItems.map(x=>({cedula:x.cedula,nombre:x.nombre,tipo:x.tipo})),["cedula","nombre","tipo"])} type="button">
                      Descargar XLSX
                    </button>
                  </div>
                )}

                {cedError && <div className="alertBox">⚠️ {cedError}</div>}
                {cedSearched && !cedLoading && !cedError && !cedItems.length && <EmptyState msg={`Sin resultados para "${cedQ_}"`} />}

                {cedItems.length > 0 && (
                  <div className="tableWrap">
                    <table>
                      <thead><tr><th>Cédula</th><th>Nombre</th><th>Tipo</th><th className="thR">Copiar</th></tr></thead>
                      <tbody>
                        {cedItems.map(x=>(
                          <tr key={x.id}>
                            <td className="mono">{x.cedula}</td>
                            <td>{x.nombre}</td>
                            <td className="mono">{x.tipo}</td>
                            <td className="thR">
                              <button className={`iconBtn${fl===`ced-${x.id}`?" flashed":""}`} type="button"
                                onClick={()=>flash(`ced-${x.id}`,String(x.cedula||""))}>
                                {fl===`ced-${x.id}`?"✓":"📋"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ TIPO DE CAMBIO ══ */}
          {page === "tipocambio" && (
            <div className="pageWrap">
              <PageHeader icon="💱" title="Tipo de Cambio"
                description="Tipo de cambio USD/CRC del Banco Central de Costa Rica — actual, histórico y conversor." />

              {/* Actual */}
              <div className="sectionBlock">
                <h2 className="sectionTitle">Tipo de cambio actual</h2>
                <div className="tcActualGrid">
                  <div className="tcActualCard">
                    <div className="lbl">Compra</div>
                    <div className="tcActualVal">{fxLoading?"…":fx?`₡${fx.compra.toLocaleString("es-CR")}`:"—"}</div>
                  </div>
                  <div className="tcActualCard">
                    <div className="lbl">Venta</div>
                    <div className="tcActualVal">{fxLoading?"…":fx?`₡${fx.venta.toLocaleString("es-CR")}`:"—"}</div>
                  </div>
                  <div className="tcActualCard tcActualDate">
                    <div className="lbl">Actualizado al</div>
                    <div className="tcActualValSm">{fx?formatFechaCR(fx.fecha):"—"}</div>
                    <button className="btn btnGhost" style={{marginTop:8}} onClick={fetchFx} type="button">↻ Actualizar</button>
                  </div>
                </div>
              </div>

              {/* Conversor */}
              {fx && (
                <div className="sectionBlock">
                  <h2 className="sectionTitle">Conversor USD ↔ CRC</h2>
                  <ConversorUI fx={fx} fxInput={fxInput} setFxInput={setFxInput}
                    fxDir={fxDir} setFxDir={setFxDir} fxResult={fxResult} />
                </div>
              )}

              {/* Histórico */}
              <div className="sectionBlock">
                <h2 className="sectionTitle">Consulta histórica por fecha</h2>
                <div className="toolCard">
                  <div className="toolSection">
                    <label className="lbl">Fecha</label>
                    <div className="inputRow">
                      <input className="inp" type="date" value={tcFecha} max={todayStr}
                        onChange={e=>setTcFecha(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")consultarTc()}} />
                      <button className="btn btnPrimary" onClick={consultarTc} disabled={!tcFecha||tcLoading} type="button">
                        {tcLoading?"Consultando…":"Consultar"}
                      </button>
                      {tcData && (
                        <CopyBtn id="tc-hist" label="Copiar" fl={fl} flash={flash} disabled={false}
                          getText={()=>{const[y,m,d]=tcData.fecha.split("-");return`TC BCCR ${d}/${m}/${y}\nCompra: ₡${tcData.compra.toLocaleString("es-CR")}\nVenta: ₡${tcData.venta.toLocaleString("es-CR")}`}} />
                      )}
                    </div>
                  </div>

                  {tcError && <div className="alertBox">⚠️ {tcError}</div>}
                  {tcSearched && !tcLoading && !tcError && !tcData && <EmptyState msg="Sin datos para esa fecha" />}

                  {tcData && (
                    <div className="tcHistBox">
                      <div className="muted" style={{fontSize:13,marginBottom:10}}>
                        {(()=>{const[y,m,d]=tcData.fecha.split("-");return`${d}/${m}/${y}`})()}
                      </div>
                      <div className="tcHistRow">
                        <div className="tcHistCell"><div className="lbl">Compra</div><div className="tcHistVal">₡{tcData.compra.toLocaleString("es-CR",{minimumFractionDigits:2})}</div></div>
                        <div className="tcHistDivider"/>
                        <div className="tcHistCell"><div className="lbl">Venta</div><div className="tcHistVal">₡{tcData.venta.toLocaleString("es-CR",{minimumFractionDigits:2})}</div></div>
                      </div>
                      <div className="muted" style={{fontSize:11,marginTop:8}}>Fuente: Banco Central de Costa Rica</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ FACTURA ══ */}
          {page === "factura" && (
            <div className="pageWrap">
              <PageHeader icon="🧾" title="Validación de Factura Electrónica"
                description="Verificá si un comprobante electrónico fue aceptado o rechazado por el Ministerio de Hacienda de Costa Rica." />
              <div className="toolCard">
                <div className="toolSection">
                  <label className="lbl">Clave numérica del comprobante</label>
                  <div className="inputRow">
                    <input className="inp" value={feKey} inputMode="numeric" maxLength={50}
                      placeholder="50 dígitos — ej: 50623011800310…"
                      onChange={e=>setFeKey(onlyDigits(e.target.value))}
                      onKeyDown={e=>{if(e.key==="Enter")consultarFe()}} />
                    <button className="btn btnPrimary" onClick={consultarFe} disabled={!feValid||feLoading} type="button">
                      {feLoading?"Verificando…":"Verificar"}
                    </button>
                  </div>
                  <div className={`keyCounter${feValid?" keyOk":""}`}>{feClean.length}/50 dígitos{feClean.length>0&&!feValid?" — debe ser exactamente 50":""}</div>
                </div>

                {feData && (
                  <div className="toolSection toolActions">
                    <CopyBtn id="fe-res" label="Copiar resultado" fl={fl} flash={flash} getText={feResumen} disabled={!feData} />
                  </div>
                )}

                {feError && <div className="alertBox">⚠️ {feError}</div>}

                {/* Info decodificada de la clave — siempre visible si es válida */}
                {feValid && feDecoded && (
                  <div className="feDecodedBox">
                    <div className="feDecodedTitle">Información de la clave</div>
                    <div className="feDecodedGrid">
                      <div className="feField"><div className="lbl">Tipo comprobante</div><div className="feVal">{feDecoded.tipo}</div></div>
                      <div className="feField"><div className="lbl">Fecha emisión</div><div className="feVal">{feDecoded.fecha}</div></div>
                      <div className="feField"><div className="lbl">Cédula emisor</div><div className="feVal mono">{feDecoded.cedula}</div></div>
                      <div className="feField"><div className="lbl">Terminal</div><div className="feVal mono">{feDecoded.terminal}</div></div>
                      <div className="feField"><div className="lbl">Situación</div><div className="feVal">{feDecoded.situacion}</div></div>
                      <div className="feField"><div className="lbl">Código seguridad</div><div className="feVal mono">{feDecoded.seguridad}</div></div>
                    </div>
                  </div>
                )}

                {/* No encontrado */}
                {feNotFound && (
                  <div className="feNotFound">
                    <div className="feNotFoundIcon">○</div>
                    <div>
                      <div className="feNotFoundTitle">No disponible en la API pública de Hacienda</div>
                      <div className="feNotFoundDesc">
                        La API pública de Hacienda no indexa todos los comprobantes — especialmente facturas recientes o emitidas por proveedores como ICE, Claro, etc. La información decodificada de arriba sí pertenece a esta clave.
                        <br/><br/>
                        Para verificar el estado oficial sin necesidad de iniciar sesión, usá <strong>ATV Hacienda</strong> (Administración Tributaria Virtual):
                      </div>
                      <div className="feNotFoundLinks">
                        <a href="https://atv.hacienda.go.cr/ATV/frmConsultaFactura.aspx" target="_blank" rel="noopener noreferrer" className="feExternalBtn feExternalBtnPrimary">
                          ATV Hacienda (sin login) ↗
                        </a>
                        <a href={`https://verificatufactura.com/verificacion-simple`} target="_blank" rel="noopener noreferrer" className="feExternalBtn">
                          VerificaTuFactura.com ↗
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {feData && (
                  <div className="feBox">
                    {(feData?.ind_estado||feData?.estado) && (
                      <div className="feEstado">
                        <span className={`feEstadoBadge ${(feData?.ind_estado||feData?.estado||"").toUpperCase().includes("ACEPT")?"feAceptado":"feRechazado"}`}>
                          {feData?.ind_estado||feData?.estado}
                        </span>
                      </div>
                    )}
                    <div className="feGrid">
                      {feData?.emisor?.nombre   && <div className="feField"><div className="lbl">Emisor</div><div className="feVal">{feData.emisor.nombre}</div></div>}
                      {feData?.receptor?.nombre && <div className="feField"><div className="lbl">Receptor</div><div className="feVal">{feData.receptor.nombre}</div></div>}
                      {feData?.fecha            && <div className="feField"><div className="lbl">Fecha</div><div className="feVal">{formatFechaCR(feData.fecha)}</div></div>}
                      {feData?.totalComprobante && <div className="feField"><div className="lbl">Total</div><div className="feVal mono">₡{Number(feData.totalComprobante).toLocaleString("es-CR",{minimumFractionDigits:2})}</div></div>}
                    </div>
                    {!feData?.emisor && !feData?.estado && !feData?.ind_estado && (
                      <pre className="feRaw">{JSON.stringify(feData,null,2)}</pre>
                    )}
                  </div>
                )}

                {/* Info educativa */}
                <div className="infoBox">
                  <div className="infoTitle">¿Cómo encontrar la clave?</div>
                  <div className="infoText">La clave numérica de 50 dígitos aparece impresa en el PDF de tu factura electrónica, generalmente bajo el título "Clave" o "Número de clave".</div>
                </div>
              </div>
            </div>
          )}

        </main>

        <footer className="footerBar">
          Datos: Ministerio de Hacienda · BCCR · TSE · Gometa
        </footer>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   CONVERSOR COMPONENT (reutilizado en 2 páginas)
───────────────────────────────────────────── */
function ConversorUI({ fx, fxInput, setFxInput, fxDir, setFxDir, fxResult }) {
  return (
    <div className="toolCard">
      <div className="conversorRow">
        <div className="conversorInputWrap">
          <span className="conversorPrefix">{fxDir==="usd2crc"?"$":"₡"}</span>
          <input className="conversorInput" type="number" min="0" placeholder="0.00"
            value={fxInput} onChange={e=>setFxInput(e.target.value)} />
        </div>
        <button className="conversorSwap" type="button" title="Cambiar dirección"
          onClick={()=>{setFxDir(d=>d==="usd2crc"?"crc2usd":"usd2crc");setFxInput("")}}>⇄</button>
        <div className="conversorResult">
          {fxResult !== null
            ? <><span className="conversorPrefix">{fxDir==="usd2crc"?"₡":"$"}</span><span className="conversorValue">{fxResult}</span></>
            : <span className="muted">{fxDir==="usd2crc"?"₡ —":"$ —"}</span>}
        </div>
      </div>
      <div className="muted" style={{marginTop:8,fontSize:12}}>
        {fxDir==="usd2crc"?`Usando tipo de cambio venta ₡${fx.venta.toLocaleString("es-CR")}`:`Usando tipo de cambio compra ₡${fx.compra.toLocaleString("es-CR")}`}
      </div>
    </div>
  )
}
