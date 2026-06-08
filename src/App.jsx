import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import "./App.css"

/* ================= API CHECK ================= */
async function checkApiStatus() {
  const start = performance.now()
  const res = await fetch("/hacienda/fe/ae?identificacion=110220294", { cache: "no-store" })
  const ms = Math.round(performance.now() - start)
  if (!res.ok) throw new Error("API down")
  return ms
}

/* ================= HELPERS ================= */
function formatFechaCR(fecha) {
  if (!fecha) return ""
  const d = new Date(fecha)
  if (isNaN(d)) return fecha
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })
}

function onlyDigits(s) {
  return (s || "").replace(/\D+/g, "")
}

function isValidAeId(s) {
  const v = onlyDigits(s)
  return v.length === 9 || v.length === 10 || v.length === 11
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

function toCsv(rows, headers) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v)
    const t = s.replace(/"/g, '""')
    return /[",\n]/.test(t) ? `"${t}"` : t
  }
  const head = headers.map(esc).join(",")
  const body = rows.map((r) => r.map(esc).join(",")).join("\n")
  return `${head}\n${body}\n`
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function downloadXlsx(filename, sheetName, rows, headerOrder) {
  const data = rows.map((r) => {
    const obj = {}
    headerOrder.forEach((h) => (obj[h] = r[h] ?? ""))
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data, { header: headerOrder })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  downloadBlob(filename, blob)
}

/* ================= SAFE JSON FETCH ================= */
async function fetchJsonSafe(url) {
  const res = await fetch(url, { cache: "no-store" })
  const ct = (res.headers.get("content-type") || "").toLowerCase()
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (!ct.includes("application/json")) {
    const preview = text.slice(0, 120).replace(/\s+/g, " ")
    throw new Error(`Respuesta no es JSON (${ct || "sin content-type"}): ${preview}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    const preview = text.slice(0, 120).replace(/\s+/g, " ")
    throw new Error(`JSON inválido: ${preview}`)
  }
}

/* ============ GOMETA NORMALIZER ============ */
function normalizeGometaResponse(json) {
  if (!json) return { items: [], raw: json }
  if (Array.isArray(json?.results)) {
    return {
      items: json.results.map((x, i) => ({
        id: x?.cedula || x?.rawcedula || x?.id || String(i),
        cedula: x?.cedula || x?.rawcedula || "",
        nombre: x?.fullname || x?.nombre || x?.name || "",
        tipo: x?.guess_type || x?.tipo || x?.type || "",
        extra: x,
      })),
      raw: json,
    }
  }
  if (Array.isArray(json)) {
    return {
      items: json.map((x, i) => ({
        id: x?.cedula || x?.id || String(i),
        cedula: x?.cedula || "",
        nombre: x?.fullname || x?.nombre || x?.name || "",
        tipo: x?.guess_type || x?.tipo || x?.type || "",
        extra: x,
      })),
      raw: json,
    }
  }
  const one = {
    id: json?.cedula || json?.rawcedula || json?.id || "1",
    cedula: json?.cedula || json?.rawcedula || "",
    nombre: json?.fullname || json?.nombre || json?.name || "",
    tipo: json?.guess_type || json?.tipo || json?.type || "",
    extra: json,
  }
  return { items: [one].filter((x) => x.cedula || x.nombre || x.tipo), raw: json }
}

/* ============ HISTORIAL (localStorage) ============ */
const HISTORY_MAX = 5

function loadHistory(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]") } catch { return [] }
}

function saveHistory(key, value) {
  if (!value.trim()) return
  const prev = loadHistory(key)
  const next = [value, ...prev.filter((x) => x !== value)].slice(0, HISTORY_MAX)
  localStorage.setItem(key, JSON.stringify(next))
}

/* ============ COPY FLASH HOOK ============ */
function useCopyFlash() {
  const [flashing, setFlashing] = useState(null)
  const timers = useRef({})

  const flash = useCallback(async (id, textOrFn) => {
    const text = typeof textOrFn === "function" ? await textOrFn() : textOrFn
    const ok = await copyText(text)
    if (!ok) return
    clearTimeout(timers.current[id])
    setFlashing(id)
    timers.current[id] = setTimeout(() => setFlashing((f) => (f === id ? null : f)), 1500)
  }, [])

  return { flashing, flash }
}

/* ============ CHIP CON COLOR ============ */
function ChipStatus({ label, value }) {
  if (!value) return null
  const val = String(value).toUpperCase()
  let mod = ""
  if (val === "NO") mod = "chipGood"
  else if (val === "SI" || val === "NO INSCRITO") mod = "chipBad"
  else if (val === "INSCRITO") mod = "chipGood"
  return <span className={`chip ${mod}`}>{label}: {value}</span>
}

export default function App() {
  /* ================= API STATUS ================= */
  const [apiStatus, setApiStatus] = useState(null)

  async function refreshApiStatus() {
    try {
      const ms = await checkApiStatus()
      setApiStatus({ ok: true, ms, at: new Date() })
    } catch {
      setApiStatus({ ok: false, at: new Date() })
    }
  }

  /* ================= TIPO DE CAMBIO (BCCR) ================= */
  const [fx, setFx] = useState(null)
  const [fxLoading, setFxLoading] = useState(false)
  const [fxError, setFxError] = useState("")

  const fetchTipoCambio = useCallback(async () => {
    setFxLoading(true)
    setFxError("")
    try {
      const json = await fetchJsonSafe("/hacienda/indicadores/tc")
      const pickValor = (x) => (x && typeof x === "object" ? x.valor ?? "" : x ?? "")
      const pickFecha = (x) => (x && typeof x === "object" ? x.fecha ?? "" : x ?? "")
      const compraRaw = json?.compra ?? json?.tipoCambioCompra ?? json?.dolar?.compra ?? json?.data?.tipoCambioCompra
      const ventaRaw  = json?.venta  ?? json?.tipoCambioVenta  ?? json?.dolar?.venta  ?? json?.data?.tipoCambioVenta
      const compra = pickValor(compraRaw)
      const venta  = pickValor(ventaRaw)
      const fecha  = json?.fecha ?? json?.data?.fecha ?? pickFecha(compraRaw) ?? pickFecha(ventaRaw)
      if (!compra && !venta) throw new Error("Sin datos de tipo de cambio")
      setFx({ compra: Number(compra), venta: Number(venta), fecha })
    } catch {
      setFx(null)
      setFxError("Tipo de cambio no disponible")
    } finally {
      setFxLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshApiStatus()
    fetchTipoCambio()
    const interval = setInterval(() => refreshApiStatus(), 60_000)
    return () => clearInterval(interval)
  }, [fetchTipoCambio])

  /* ================= CONVERSOR USD / CRC ================= */
  const [fxInput, setFxInput] = useState("")
  const [fxDir, setFxDir] = useState("usd2crc") // "usd2crc" | "crc2usd"

  const fxResult = useMemo(() => {
    if (!fx || fxInput === "") return null
    const n = parseFloat(fxInput.replace(/,/g, ""))
    if (isNaN(n) || n < 0) return null
    if (fxDir === "usd2crc") return (n * fx.venta).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (n / fx.compra).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [fx, fxInput, fxDir])

  /* ================= COPY FLASH ================= */
  const { flashing, flash } = useCopyFlash()

  function CopyBtn({ id, label = "Copiar CSV", getText, disabled }) {
    const active = flashing === id
    return (
      <button
        className={`btnGhost${active ? " btnFlashed" : ""}`}
        onClick={() => flash(id, getText)}
        disabled={disabled || active}
        type="button"
      >
        {active ? "✓ Copiado" : label}
      </button>
    )
  }

  /* ================= CABYS ================= */
  const [cabysQ, setCabysQ] = useState("")
  const [cabysTop, setCabysTop] = useState(10)
  const [cabysData, setCabysData] = useState([])
  const [cabysLoading, setCabysLoading] = useState(false)
  const [cabysError, setCabysError] = useState("")
  const [cabysPage, setCabysPage] = useState(0)
  const [cabysLastTopRequested, setCabysLastTopRequested] = useState(0)
  const [cabysSearched, setCabysSearched] = useState(false)
  const [cabysHistory, setCabysHistory] = useState(() => loadHistory("ht_cabys"))
  const suggestBoxRef = useRef(null)

  const cabysQueryTrim = useMemo(() => cabysQ.trim(), [cabysQ])
  const cabysCanSearch = cabysQueryTrim.length > 0

  const pageSize = useMemo(() => {
    const n = Number(cabysTop)
    if (!Number.isFinite(n) || n <= 0) return 10
    return Math.min(50, Math.max(5, n))
  }, [cabysTop])

  async function consultarCabys({ resetPage = false, queryOverride } = {}) {
    const q = (queryOverride ?? cabysQueryTrim).trim()
    if (!q) return
    if (resetPage) setCabysPage(0)
    setCabysLoading(true)
    setCabysError("")
    setCabysSearched(true)
    try {
      const page = resetPage ? 0 : cabysPage
      const neededTop = Math.min(50, pageSize * (page + 1))
      setCabysLastTopRequested(neededTop)
      const res = await fetch(`/hacienda/fe/cabys?q=${encodeURIComponent(q)}&top=${neededTop}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setCabysData(json.cabys || [])
      if (resetPage) {
        saveHistory("ht_cabys", q)
        setCabysHistory(loadHistory("ht_cabys"))
        setCabysPage(0)
      }
    } catch (e) {
      setCabysData([])
      setCabysError(e?.message || "Error consultando CABYS")
    } finally {
      setCabysLoading(false)
    }
  }

  async function cabysNextPage() {
    const nextPage = cabysPage + 1
    const needTop = Math.min(50, pageSize * (nextPage + 1))
    if (cabysData.length < needTop) {
      setCabysLoading(true)
      setCabysError("")
      try {
        const res = await fetch(`/hacienda/fe/cabys?q=${encodeURIComponent(cabysQueryTrim)}&top=${needTop}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setCabysData(json.cabys || [])
        setCabysLastTopRequested(needTop)
      } catch (e) {
        setCabysError(e?.message || "Error consultando CABYS")
        setCabysLoading(false)
        return
      } finally {
        setCabysLoading(false)
      }
    } else {
      setCabysLastTopRequested(needTop)
    }
    setCabysPage(nextPage)
  }

  const cabysTotal    = cabysData.length
  const cabysStart    = cabysPage * pageSize
  const cabysEnd      = cabysStart + pageSize
  const cabysPageRows = cabysData.slice(cabysStart, cabysEnd)
  const cabysHasPrev  = cabysPage > 0
  const cabysHasNext  = cabysEnd < cabysTotal || (cabysTotal === cabysLastTopRequested && cabysLastTopRequested < 50)

  function downloadCabysXlsx() {
    if (!cabysPageRows.length) return
    downloadXlsx("cabys.xlsx", "CABYS",
      cabysPageRows.map((c) => ({ codigo: c.codigo, descripcion: c.descripcion, impuesto: `${c.impuesto}%` })),
      ["codigo", "descripcion", "impuesto"]
    )
  }

  /* ================= AE ================= */
  const [aeId, setAeId] = useState("")
  const [aeData, setAeData] = useState(null)
  const [aeLoading, setAeLoading] = useState(false)
  const [aeError, setAeError] = useState("")
  const [aeSearched, setAeSearched] = useState(false)
  const [aeHistory, setAeHistory] = useState(() => loadHistory("ht_ae"))

  const aeIdDigits = useMemo(() => onlyDigits(aeId), [aeId])
  const aeValid    = useMemo(() => isValidAeId(aeId), [aeId])

  /* idOverride permite llamar desde el chip de historial sin esperar actualización de estado */
  async function consultarAE(idOverride) {
    const digits = idOverride ? onlyDigits(idOverride) : aeIdDigits
    if (!isValidAeId(digits)) return
    setAeLoading(true)
    setAeError("")
    setAeSearched(true)
    try {
      const res = await fetch(`/hacienda/fe/ae?identificacion=${digits}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setAeData(json)
      saveHistory("ht_ae", digits)
      setAeHistory(loadHistory("ht_ae"))
    } catch (e) {
      setAeData(null)
      setAeError(e?.message || "Error consultando AE")
    } finally {
      setAeLoading(false)
    }
  }

  const aeJsonId = useMemo(() => {
    const raw = aeData?.identificacion ?? aeData?.identificacionTributaria ?? aeData?.cedula ?? aeData?.id ?? ""
    return onlyDigits(String(raw)) || aeIdDigits
  }, [aeData, aeIdDigits])

  function getAeSummaryText() {
    if (!aeData) return ""
    const s = aeData?.situacion || {}
    return [
      `Contribuyente (AE)`,
      `Nombre: ${aeData.nombre || "-"}`,
      `Identificación: ${aeJsonId || "-"}`,
      `Régimen: ${aeData.regimen?.descripcion || "-"}`,
      `Estado: ${s.estado || "-"}`,
      `Moroso: ${s.moroso || "-"}`,
      `Omiso: ${s.omiso || "-"}`,
      `Administración Tributaria: ${s.administracionTributaria || "-"}`,
    ].join("\n")
  }

  function getAeActividadesCsvText() {
    if (!aeData?.actividades?.length) return ""
    return toCsv(
      aeData.actividades.map((a) => [a.codigo, a.descripcion, a.tipo === "P" ? "Principal" : "Secundaria", a.estado === "A" ? "Activa" : "Inactiva"]),
      ["codigo", "descripcion", "tipo", "estado"]
    )
  }

  function downloadAeActividadesXlsx() {
    if (!aeData?.actividades?.length) return
    downloadXlsx("actividades_ae.xlsx", "Actividades",
      aeData.actividades.map((a) => ({
        codigo: a.codigo,
        descripcion: a.descripcion,
        tipo: a.tipo === "P" ? "Principal" : "Secundaria",
        estado: a.estado === "A" ? "Activa" : "Inactiva",
      })),
      ["codigo", "descripcion", "tipo", "estado"]
    )
  }

  /* ================= GOMETA CEDULAS ================= */
  const [cedQuery, setCedQuery] = useState("")
  const [cedLoading, setCedLoading] = useState(false)
  const [cedError, setCedError] = useState("")
  const [cedItems, setCedItems] = useState([])
  const [cedSearched, setCedSearched] = useState(false)
  const [cedHistory, setCedHistory] = useState(() => loadHistory("ht_ced"))

  const cedQueryTrim = useMemo(() => cedQuery.trim(), [cedQuery])
  const cedCanSearch = cedQueryTrim.length > 0

  async function consultarCedulas(queryOverride) {
    const q = (queryOverride ?? cedQueryTrim).trim()
    if (!q) return
    setCedLoading(true)
    setCedError("")
    setCedItems([])
    setCedSearched(true)
    try {
      const json = await fetchJsonSafe(`/gometa/cedulas/${encodeURIComponent(q)}`)
      const norm = normalizeGometaResponse(json)
      setCedItems(norm.items)
      saveHistory("ht_ced", q)
      setCedHistory(loadHistory("ht_ced"))
    } catch (e) {
      setCedError(e?.message || "Error consultando Cédulas (gometa)")
    } finally {
      setCedLoading(false)
    }
  }

  function downloadCedulasXlsx() {
    if (!cedItems.length) return
    downloadXlsx("cedulas_gometa.xlsx", "Cedulas",
      cedItems.map((x) => ({ cedula: x.cedula, nombre: x.nombre, tipo: x.tipo })),
      ["cedula", "nombre", "tipo"]
    )
  }

  /* ================= RENDER ================= */
  return (
    <div className="page">
      <div className="container">
        <header className="top">
          <div className="topLeft">
            <h1>Herramienta de consulta</h1>
            <p>CABYS · Contribuyentes · Cédulas TSE · Tipo de cambio</p>
          </div>

          {/* TIPO DE CAMBIO */}
          <div className="fxCard" title="Tipo de cambio BCCR">
            <div className="fxTitle">
              Tipo de cambio
              <button className="fxRefresh" onClick={fetchTipoCambio} type="button" title="Actualizar">↻</button>
            </div>
            {fxLoading ? (
              <div className="fxRow muted">Cargando…</div>
            ) : fx ? (
              <>
                <div className="fxRow">
                  <span className="fxLabel">Compra</span>
                  <span className="fxValue">₡{fx.compra.toLocaleString("es-CR")}</span>
                </div>
                <div className="fxRow">
                  <span className="fxLabel">Venta</span>
                  <span className="fxValue">₡{fx.venta.toLocaleString("es-CR")}</span>
                </div>
                <div className="fxDate muted">Al {formatFechaCR(fx.fecha)}</div>
              </>
            ) : (
              <div className="fxRow bad">{fxError || "No disponible"}</div>
            )}
          </div>
        </header>

        {/* API STATUS */}
        <section className="card apiStatusCard">
          <div className="apiHead">
            <div>
              <div className="apiTitle">Estado de los APIs</div>
              <div className="apiSub">Hacienda · Gometa — Auto cada 1 minuto</div>
            </div>
            <button className="btnGhost" onClick={refreshApiStatus} type="button">
              ↻ Revisar ahora
            </button>
          </div>
          <div className="apiBody">
            {apiStatus?.ok ? (
              <div className="apiOk">
                <span className="dot ok" />
                <span className="apiLine">Operacional — respuesta en <b>{apiStatus.ms} ms</b></span>
              </div>
            ) : (
              <div className="apiBad">
                <span className="dot bad" />
                <span className="apiLine">Sin respuesta</span>
              </div>
            )}
            {apiStatus?.at && <div className="muted">Última revisión: {apiStatus.at.toLocaleString()}</div>}
          </div>
        </section>

        {/* CONVERSOR USD / CRC */}
        {fx && (
          <section className="card conversorCard">
            <h2 className="conversorTitle">Conversor USD ↔ CRC</h2>
            <div className="conversorRow">
              <div className="conversorInputWrap">
                <span className="conversorPrefix">{fxDir === "usd2crc" ? "$" : "₡"}</span>
                <input
                  className="conversorInput"
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={fxInput}
                  onChange={(e) => setFxInput(e.target.value)}
                />
              </div>
              <button
                className="conversorSwap"
                type="button"
                title="Cambiar dirección"
                onClick={() => { setFxDir((d) => d === "usd2crc" ? "crc2usd" : "usd2crc"); setFxInput("") }}
              >
                ⇄
              </button>
              <div className="conversorResult">
                {fxResult !== null ? (
                  <>
                    <span className="conversorPrefix">{fxDir === "usd2crc" ? "₡" : "$"}</span>
                    <span className="conversorValue">{fxResult}</span>
                  </>
                ) : (
                  <span className="muted">{fxDir === "usd2crc" ? "₡ —" : "$ —"}</span>
                )}
              </div>
            </div>
            <div className="conversorHint muted">
              {fxDir === "usd2crc"
                ? `Usando tipo de cambio venta ₡${fx.venta.toLocaleString("es-CR")}`
                : `Usando tipo de cambio compra ₡${fx.compra.toLocaleString("es-CR")}`}
            </div>
          </section>
        )}

        {/* MAIN GRID */}
        <main className="grid2">
          {/* ===== CABYS ===== */}
          <section className="card">
            <h2>Consulta de CABYS</h2>

            <label>Búsqueda por nombre o código</label>
            <div className="suggestWrap" ref={suggestBoxRef}>
              <input
                value={cabysQ}
                onChange={(e) => { setCabysQ(e.target.value); setCabysPage(0) }}
                onKeyDown={(e) => { if (e.key === "Enter") consultarCabys({ resetPage: true }) }}
                placeholder="Ej: arroz o 1010101010000"
              />
            </div>

            {cabysHistory.length > 0 && (
              <div className="historyRow">
                {cabysHistory.map((h) => (
                  <button key={h} type="button" className="historyChip"
                    onClick={() => { setCabysQ(h); setCabysPage(0); consultarCabys({ resetPage: true, queryOverride: h }) }}
                  >{h}</button>
                ))}
              </div>
            )}

            <label>Resultados por página</label>
            <input
              type="number" min="5" max="50" value={cabysTop}
              onChange={(e) => { setCabysTop(e.target.value); setCabysPage(0) }}
            />

            <div className="row">
              <button className="btnPrimary" onClick={() => consultarCabys({ resetPage: true })}
                disabled={!cabysCanSearch || cabysLoading} type="button">
                {cabysLoading ? "Consultando…" : "Consultar"}
              </button>
              <CopyBtn id="cabys-csv" label="Copiar CSV"
                getText={() => toCsv(cabysPageRows.map((c) => [c.codigo, c.descripcion, `${c.impuesto}%`]), ["codigo", "descripcion", "impuesto"])}
                disabled={!cabysPageRows.length}
              />
              <button className="btnGhost" onClick={downloadCabysXlsx} disabled={!cabysPageRows.length} type="button">
                Descargar XLSX
              </button>
            </div>

            {cabysError && <div className="alert">⚠️ {cabysError}</div>}
            {cabysSearched && !cabysLoading && !cabysError && cabysTotal === 0 && (
              <div className="emptyState">Sin resultados para "{cabysQueryTrim}"</div>
            )}

            {cabysTotal > 0 && (
              <div className="pager">
                <button className="btnGhost" disabled={!cabysHasPrev}
                  onClick={() => setCabysPage((p) => Math.max(0, p - 1))} type="button">◀ Anterior</button>
                <div className="muted">Pág. {cabysPage + 1} · {Math.min(cabysEnd, cabysTotal)} de {cabysTotal}</div>
                <button className="btnGhost" disabled={!cabysHasNext} onClick={cabysNextPage} type="button">
                  Siguiente ▶
                </button>
              </div>
            )}

            {cabysPageRows.length > 0 && (
              <table>
                <thead>
                  <tr><th>Código</th><th>Descripción</th><th>Impuesto</th><th className="thRight">Copiar</th></tr>
                </thead>
                <tbody>
                  {cabysPageRows.map((c) => (
                    <tr key={c.codigo}>
                      <td className="mono">{c.codigo}</td>
                      <td>{c.descripcion}</td>
                      <td><span className="taxBadge">{c.impuesto}%</span></td>
                      <td className="tdRight">
                        <button
                          className={`iconBtn${flashing === `cabys-code-${c.codigo}` ? " flashed" : ""}`}
                          type="button" title="Copiar código"
                          onClick={() => flash(`cabys-code-${c.codigo}`, String(c.codigo || ""))}
                        >
                          {flashing === `cabys-code-${c.codigo}` ? "✓" : "📋"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ===== AE ===== */}
          <section className="card">
            <h2>Consulta de Contribuyente</h2>

            <label>Identificación</label>
            <input
              value={aeId}
              onChange={(e) => setAeId(onlyDigits(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") consultarAE() }}
              placeholder="Solo números (111111111)"
              inputMode="numeric"
            />

            {!aeValid && aeId.length > 0 && (
              <div className="hint bad">La identificación debe tener 9, 10 u 11 dígitos.</div>
            )}

            {aeHistory.length > 0 && (
              <div className="historyRow">
                {aeHistory.map((h) => (
                  <button key={h} type="button" className="historyChip"
                    onClick={() => { setAeId(h); consultarAE(h) }}
                  >{h}</button>
                ))}
              </div>
            )}

            <div className="row">
              <button className="btnPrimary" onClick={() => consultarAE()} disabled={!aeValid || aeLoading} type="button">
                {aeLoading ? "Consultando…" : "Consultar"}
              </button>
              <CopyBtn id="ae-summary" label="Copiar resumen" getText={getAeSummaryText} disabled={!aeData} />
              <CopyBtn id="ae-csv" label="Copiar CSV" getText={getAeActividadesCsvText} disabled={!aeData?.actividades?.length} />
              <button className="btnGhost" onClick={downloadAeActividadesXlsx} disabled={!aeData?.actividades?.length} type="button">
                Descargar XLSX
              </button>
            </div>

            {aeError && <div className="alert">⚠️ {aeError}</div>}
            {aeSearched && !aeLoading && !aeError && !aeData && (
              <div className="emptyState">No se encontró contribuyente para "{aeIdDigits}"</div>
            )}

            {aeData && (
              <>
                <div className="ae-box">
                  <div className="ae-header">
                    <div className="ae-col">
                      <div className="label">Nombre</div>
                      <div className="value">{aeData.nombre}</div>
                    </div>
                    <div className="ae-col">
                      <div className="label">Identificación</div>
                      <div className="value mono">{aeJsonId}</div>
                    </div>
                    <div className="ae-col">
                      <div className="label">Régimen</div>
                      <div className="value">{aeData.regimen?.descripcion || "—"}</div>
                    </div>
                  </div>
                  <div className="ae-chips">
                    <ChipStatus label="Estado"  value={aeData.situacion?.estado} />
                    <ChipStatus label="Moroso"  value={aeData.situacion?.moroso} />
                    <ChipStatus label="Omiso"   value={aeData.situacion?.omiso} />
                    {aeData.situacion?.administracionTributaria && (
                      <span className="chip">AT: {aeData.situacion.administracionTributaria}</span>
                    )}
                  </div>
                  <div className="ae-link">
                    <a href="https://www.hacienda.go.cr/ATV/frmConsultaContribuyentes.aspx"
                      target="_blank" rel="noopener noreferrer" className="linkExterno">
                      Ver en Hacienda ↗
                    </a>
                  </div>
                </div>

                {aeData.actividades?.length > 0 && (
                  <table>
                    <thead>
                      <tr><th>Código</th><th>Descripción</th><th>Tipo</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {aeData.actividades.map((a) => (
                        <tr key={`${a.codigo}-${a.tipo}-${a.estado}`}>
                          <td className="mono">{a.codigo}</td>
                          <td>{a.descripcion}</td>
                          <td>{a.tipo === "P" ? "Principal" : "Secundaria"}</td>
                          <td>
                            <span className={a.estado === "A" ? "estadoBadge activa" : "estadoBadge inactiva"}>
                              {a.estado === "A" ? "Activa" : "Inactiva"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>

          {/* ===== GOMETA ===== */}
          <section className="card">
            <h2>Consulta de cédula TSE</h2>

            <label>Búsqueda por cédula o nombre</label>
            <input
              value={cedQuery}
              onChange={(e) => setCedQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") consultarCedulas() }}
              placeholder="Ej: 116740278 o Juan Pérez"
            />

            {cedHistory.length > 0 && (
              <div className="historyRow">
                {cedHistory.map((h) => (
                  <button key={h} type="button" className="historyChip"
                    onClick={() => { setCedQuery(h); consultarCedulas(h) }}
                  >{h}</button>
                ))}
              </div>
            )}

            <div className="row">
              <button className="btnPrimary" onClick={() => consultarCedulas()} disabled={!cedCanSearch || cedLoading} type="button">
                {cedLoading ? "Consultando…" : "Consultar"}
              </button>
              <button className="btnGhost" onClick={downloadCedulasXlsx} disabled={!cedItems.length} type="button">
                Descargar XLSX
              </button>
            </div>

            {cedError && <div className="alert">⚠️ {cedError}</div>}
            {cedSearched && !cedLoading && !cedError && cedItems.length === 0 && (
              <div className="emptyState">Sin resultados para "{cedQueryTrim}"</div>
            )}

            {cedItems.length > 0 && (
              <table>
                <thead>
                  <tr><th>Cédula</th><th>Nombre</th><th>Tipo</th><th className="thRight">Copiar</th></tr>
                </thead>
                <tbody>
                  {cedItems.map((x) => (
                    <tr key={x.id}>
                      <td className="mono">{x.cedula}</td>
                      <td>{x.nombre}</td>
                      <td className="mono">{x.tipo}</td>
                      <td className="tdRight">
                        <button
                          className={`iconBtn${flashing === `ced-${x.id}` ? " flashed" : ""}`}
                          type="button" title="Copiar cédula"
                          onClick={() => flash(`ced-${x.id}`, String(x.cedula || ""))}
                        >
                          {flashing === `ced-${x.id}` ? "✓" : "📋"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </main>

        <footer className="footer muted">
          Datos: Ministerio de Hacienda · BCCR · TSE
        </footer>
      </div>
    </div>
  )
}
