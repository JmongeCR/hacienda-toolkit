import { useEffect, useMemo, useRef, useState } from "react"
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

  // Por si viniera algo raro
  if (isNaN(d)) return fecha

  return d.toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
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
    const items = json.results.map((x, i) => ({
      id: x?.cedula || x?.rawcedula || x?.id || String(i),
      cedula: x?.cedula || x?.rawcedula || "",
      nombre: x?.fullname || x?.nombre || x?.name || "",
      tipo: x?.guess_type || x?.tipo || x?.type || "",
      extra: x,
    }))
    return { items, raw: json }
  }

  if (Array.isArray(json)) {
    const items = json.map((x, i) => ({
      id: x?.cedula || x?.id || String(i),
      cedula: x?.cedula || "",
      nombre: x?.fullname || x?.nombre || x?.name || "",
      tipo: x?.guess_type || x?.tipo || x?.type || "",
      extra: x,
    }))
    return { items, raw: json }
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

  useEffect(() => {
    refreshApiStatus()
    fetchTipoCambio() 
    const interval = setInterval(() => refreshApiStatus(), 60_000)
    return () => clearInterval(interval)
  }, [])

  /* ================= TIPO DE CAMBIO (BCCR) ================= */
  const [fx, setFx] = useState(null)
  const [fxLoading, setFxLoading] = useState(false)
  const [fxError, setFxError] = useState("")

 async function fetchTipoCambio() {
  try {
    setFxError("")
    const json = await fetchJsonSafe("/hacienda/indicadores/tc")

    // Helper: si viene { fecha, valor } devolveme valor; si viene número/string, devolveme eso.
    const pickValor = (x) =>
      x && typeof x === "object" ? x.valor ?? "" : x ?? ""

    // Helper: si viene { fecha, valor } devolveme fecha; si viene string, devolveme eso.
    const pickFecha = (x) =>
      x && typeof x === "object" ? x.fecha ?? "" : x ?? ""

    // Soporta varias formas posibles de respuesta
    const compraRaw =
      json?.compra ??
      json?.tipoCambioCompra ??
      json?.dolar?.compra ??
      json?.data?.tipoCambioCompra

    const ventaRaw =
      json?.venta ??
      json?.tipoCambioVenta ??
      json?.dolar?.venta ??
      json?.data?.tipoCambioVenta

    const compra = pickValor(compraRaw)
    const venta = pickValor(ventaRaw)

    // fecha puede venir aparte o dentro del mismo objeto
    const fecha =
      json?.fecha ??
      json?.data?.fecha ??
      pickFecha(compraRaw) ??
      pickFecha(ventaRaw)

    if (!compra && !venta) throw new Error("Sin datos de tipo de cambio")

    setFx({ compra, venta, fecha })
  } catch (e) {
    setFx(null)
    setFxError("Tipo de cambio no disponible")
  }
}


  /* ================= CABYS ================= */
  const [cabysQ, setCabysQ] = useState("")
  const [cabysTop, setCabysTop] = useState(10)
  const [cabysData, setCabysData] = useState([])
  const [cabysLoading, setCabysLoading] = useState(false)
  const [cabysError, setCabysError] = useState("")
  const [cabysPage, setCabysPage] = useState(0)
  const [cabysLastTopRequested, setCabysLastTopRequested] = useState(0)

  const [cabysSuggest, setCabysSuggest] = useState([])
  const [cabysSuggestOpen, setCabysSuggestOpen] = useState(false)
  const [cabysSuggestLoading, setCabysSuggestLoading] = useState(false)
  const suggestBoxRef = useRef(null)

  const cabysQueryTrim = useMemo(() => cabysQ.trim(), [cabysQ])
  const cabysCanSearch = cabysQueryTrim.length > 0

  const pageSize = useMemo(() => {
    const n = Number(cabysTop)
    if (!Number.isFinite(n) || n <= 0) return 10
    return Math.min(50, Math.max(5, n))
  }, [cabysTop])

  async function consultarCabys({ resetPage = false } = {}) {
    if (!cabysCanSearch) return
    if (resetPage) setCabysPage(0)

    setCabysLoading(true)
    setCabysError("")
    try {
      const neededTop = Math.min(50, pageSize * ((resetPage ? 0 : cabysPage) + 1))
      setCabysLastTopRequested(neededTop)

      const res = await fetch(
        `/hacienda/fe/cabys?q=${encodeURIComponent(cabysQueryTrim)}&top=${neededTop}`,
        { cache: "no-store" }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setCabysData(json.cabys || [])
    } catch (e) {
      setCabysData([])
      setCabysError(e?.message || "Error consultando CABYS")
    } finally {
      setCabysLoading(false)
    }
  }

  //  useEffect(() => {
  //    const q = cabysQueryTrim
  //    if (q.length < 2) {
  //      setCabysSuggest([])
  //      setCabysSuggestOpen(false)
  //      return
  //    }
  //
  //    const t = setTimeout(async () => {
  //      setCabysSuggestLoading(true)
  //      try {
  //        const res = await fetch(`/hacienda/fe/cabys?q=${encodeURIComponent(q)}&top=10`, {
  //          cache: "no-store",
  //        })
  //        const json = await res.json()
  //        setCabysSuggest(json.cabys || [])
  //        setCabysSuggestOpen(true)
  //      } catch {
  //        setCabysSuggest([])
  //        setCabysSuggestOpen(false)
  //      } finally {
  //        setCabysSuggestLoading(false)
  //      }
  //    }, 400)
  //
  //    return () => clearTimeout(t)
  //  }, [cabysQueryTrim])

  useEffect(() => {
    function onDocClick(e) {
      if (!suggestBoxRef.current) return
      if (!suggestBoxRef.current.contains(e.target)) setCabysSuggestOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const cabysTotal = cabysData.length
  const cabysStart = cabysPage * pageSize
  const cabysEnd = cabysStart + pageSize
  const cabysPageRows = cabysData.slice(cabysStart, cabysEnd)
  const cabysHasPrev = cabysPage > 0
  const cabysHasNext =
    cabysEnd < cabysTotal ||
    (cabysTotal === cabysLastTopRequested && cabysLastTopRequested < 50)

  async function copyCabysCsv() {
    const rows = cabysPageRows.map((c) => [c.codigo, c.descripcion, `${c.impuesto}%`])
    const csv = toCsv(rows, ["codigo", "descripcion", "impuesto"])
    await copyText(csv)
  }

  function downloadCabysXlsx() {
    if (!cabysPageRows.length) return
    const rows = cabysPageRows.map((c) => ({
      codigo: c.codigo,
      descripcion: c.descripcion,
      impuesto: `${c.impuesto}%`,
    }))
    downloadXlsx("cabys.xlsx", "CABYS", rows, ["codigo", "descripcion", "impuesto"])
  }

  async function copyCabysCode(code) {
    await copyText(String(code || ""))
  }

  /* ================= AE ================= */
  const [aeId, setAeId] = useState("")
  const [aeData, setAeData] = useState(null)
  const [aeLoading, setAeLoading] = useState(false)
  const [aeError, setAeError] = useState("")

  const aeIdDigits = useMemo(() => onlyDigits(aeId), [aeId])
  const aeValid = useMemo(() => isValidAeId(aeId), [aeId])

  async function consultarAE() {
    if (!aeValid) return
    setAeLoading(true)
    setAeError("")
    try {
      const res = await fetch(`/hacienda/fe/ae?identificacion=${aeIdDigits}`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setAeData(json)
    } catch (e) {
      setAeData(null)
      setAeError(e?.message || "Error consultando AE")
    } finally {
      setAeLoading(false)
    }
  }

  // ✅ Cédula SIEMPRE desde el JSON (y solo cae al input si viniera vacío)
  const aeJsonId = useMemo(() => {
    const raw =
      aeData?.identificacion ??
      aeData?.identificacionTributaria ??
      aeData?.cedula ??
      aeData?.id ??
      ""
    const cleaned = onlyDigits(String(raw))
    return cleaned || aeIdDigits
  }, [aeData, aeIdDigits])

  async function copyAeSummary() {
    if (!aeData) return
    const s = aeData?.situacion || {}
    const lines = [
      `Contribuyente (AE)`,
      `Nombre: ${aeData.nombre || "-"}`,
      `Identificación: ${aeJsonId || "-"}`,
      `Régimen: ${aeData.regimen?.descripcion || "-"}`,
      `Estado: ${s.estado || "-"}`,
      `Moroso: ${s.moroso || "-"}`,
      `Omiso: ${s.omiso || "-"}`,
      `Administración Tributaria: ${s.administracionTributaria || "-"}`,
    ].join("\n")
    await copyText(lines)
  }

  async function copyAeActividadesCsv() {
    if (!aeData?.actividades?.length) return
    const rows = aeData.actividades.map((a) => [
      a.codigo,
      a.descripcion,
      a.tipo === "P" ? "Principal" : "Secundaria",
      a.estado === "A" ? "Activa" : "Inactiva",
    ])
    const csv = toCsv(rows, ["codigo", "descripcion", "tipo", "estado"])
    await copyText(csv)
  }

  function downloadAeActividadesXlsx() {
    if (!aeData?.actividades?.length) return
    const rows = aeData.actividades.map((a) => ({
      codigo: a.codigo,
      descripcion: a.descripcion,
      tipo: a.tipo === "P" ? "Principal" : "Secundaria",
      estado: a.estado === "A" ? "Activa" : "Inactiva",
    }))
    downloadXlsx("actividades_ae.xlsx", "Actividades", rows, [
      "codigo",
      "descripcion",
      "tipo",
      "estado",
    ])
  }

  /* ================= GOMETA CEDULAS ================= */
  const [cedQuery, setCedQuery] = useState("")
  const [cedLoading, setCedLoading] = useState(false)
  const [cedError, setCedError] = useState("")
  const [cedItems, setCedItems] = useState([])

  const cedQueryTrim = useMemo(() => cedQuery.trim(), [cedQuery])
  const cedCanSearch = cedQueryTrim.length > 0

  async function consultarCedulas() {
    if (!cedCanSearch) return
    setCedLoading(true)
    setCedError("")
    setCedItems([])
    try {
      const json = await fetchJsonSafe(`/gometa/cedulas/${encodeURIComponent(cedQueryTrim)}`)
      const norm = normalizeGometaResponse(json)
      setCedItems(norm.items)
    } catch (e) {
      setCedError(e?.message || "Error consultando Cédulas (gometa)")
    } finally {
      setCedLoading(false)
    }
  }

  function downloadCedulasXlsx() {
    if (!cedItems.length) return
    const rows = cedItems.map((x) => ({
      cedula: x.cedula,
      nombre: x.nombre,
      tipo: x.tipo,
    }))
    downloadXlsx("cedulas_gometa.xlsx", "Cedulas", rows, ["cedula", "nombre", "tipo"])
  }

  return (
    <div className="page">
      <div className="container">
        <header className="top">
          <div className="topLeft">
            <h1>Herramienta de consulta</h1>
            <p>CABYS y consulta de status contribuyente</p>
          </div>

          {/* ================= TIPO DE CAMBIO (BCCR) ================= */}
          <div className="fxCard" title="Tipo de cambio (USD)">
            <div className="fxTitle">Tipo de cambio</div>

            {fxLoading ? (
              <div className="fxRow muted">Cargando…</div>
            ) : fx ? (
              <>
                <div className="fxRow">
                  <span className="fxLabel">Compra</span>
                  <span className="fxValue">₡{fx.compra}</span>
                </div>
                <div className="fxRow">
                  <span className="fxLabel">Venta</span>
                  <span className="fxValue">₡{fx.venta}</span>
                </div>
                <div className="fxDate muted">Actualizado al: {formatFechaCR(fx.fecha)}</div>
              </>
            ) : (
              <div className="fxRow bad">{fxError || "No disponible"}</div>
            )}
          </div>
        </header>

        {/* ================= API STATUS CARD ================= */}
        <section className="card apiStatusCard">
          <div className="apiHead">
            <div>
              <div className="apiTitle">Estado de los APIs</div>
              <div className="apiSub">Hacienda (proxy /hacienda) — Auto cada 1 minuto</div>
            </div>

            <button className="btnGhost" onClick={refreshApiStatus} type="button">
              🔄 Revisar ahora
            </button>
          </div>

          <div className="apiBody">
            {apiStatus?.ok ? (
              <div className="apiOk">
                <span className="dot ok" />
                <span className="apiLine">
                  Operacional — respuesta en <b>{apiStatus.ms} ms</b>
                </span>
              </div>
            ) : (
              <div className="apiBad">
                <span className="dot bad" />
                <span className="apiLine">Sin respuesta</span>
              </div>
            )}

            {apiStatus?.at && (
              <div className="muted">Última revisión: {apiStatus.at.toLocaleString()}</div>
            )}
          </div>
        </section>

        {/* ================= MAIN GRID ================= */}
        <main className="grid2">
          {/* CABYS */}
          <section className="card">
            <h2>Consulta de CABYS</h2>

            <label>Búsqueda por nombre</label>
            <div className="suggestWrap" ref={suggestBoxRef}>
              <input
                value={cabysQ}
                onChange={(e) => {
                  setCabysQ(e.target.value)
                  setCabysPage(0)
                }}
                //                onFocus={() => {
                //                  if (cabysSuggest.length > 0) setCabysSuggestOpen(true)
                //                }}
                placeholder="Ej: arroz"
              />

              {cabysSuggestLoading && <div className="suggestHint muted">Buscando…</div>}

              {cabysSuggestOpen && cabysSuggest.length > 0 && (
                <div className="suggestList">
                  {cabysSuggest.map((s) => (
                    <button
                      type="button"
                      key={s.codigo}
                      className="suggestItem"
                      onClick={() => {
                        setCabysQ(s.descripcion || "")
                        setCabysSuggestOpen(false)
                        setTimeout(() => consultarCabys({ resetPage: true }), 0)
                      }}
                    >
                      <span className="mono">{s.codigo}</span>
                      <span className="suggestText">{s.descripcion}</span>
                      <span className="suggestTax">{s.impuesto}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label>Resultados por página</label>
            <input
              type="number"
              min="5"
              max="50"
              value={cabysTop}
              onChange={(e) => {
                setCabysTop(e.target.value)
                setCabysPage(0)
              }}
            />

            <div className="row">
              <button
                className="btnPrimary"
                onClick={() => consultarCabys({ resetPage: true })}
                disabled={!cabysCanSearch || cabysLoading}
                type="button"
              >
                {cabysLoading ? "Consultando…" : "Consultar"}
              </button>

              <button
                className="btnGhost"
                onClick={copyCabysCsv}
                disabled={!cabysPageRows.length}
                type="button"
              >
                Copiar CSV
              </button>

              <button
                className="btnGhost"
                onClick={downloadCabysXlsx}
                disabled={!cabysPageRows.length}
                type="button"
              >
                Descargar XLSX
              </button>
            </div>

            {cabysError && <div className="alert">⚠️ {cabysError}</div>}

            {cabysTotal > 0 && (
              <div className="pager">
                <button
                  className="btnGhost"
                  disabled={!cabysHasPrev}
                  onClick={() => setCabysPage((p) => Math.max(0, p - 1))}
                  type="button"
                >
                  ◀ Anterior
                </button>

                <div className="muted">
                  Página {cabysPage + 1} — Mostrando {Math.min(cabysEnd, cabysTotal)} de {cabysTotal}
                </div>

                <button
                  className="btnGhost"
                  disabled={!cabysHasNext}
                  onClick={async () => {
                    const nextPage = cabysPage + 1
                    const needTop = Math.min(50, pageSize * (nextPage + 1))

                    if (cabysData.length < needTop) {
                      setCabysLoading(true)
                      setCabysError("")
                      try {
                        const res = await fetch(
                          `/hacienda/fe/cabys?q=${encodeURIComponent(
                            cabysQueryTrim
                          )}&top=${needTop}`,
                          { cache: "no-store" }
                        )
                        if (!res.ok) throw new Error(`HTTP ${res.status}`)
                        const json = await res.json()
                        const items = json.cabys || []
                        setCabysData(items)
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
                  }}
                  type="button"
                >
                  Siguiente ▶
                </button>
              </div>
            )}

            {cabysPageRows.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Impuesto</th>
                    <th className="thRight">Copiar</th>
                  </tr>
                </thead>
                <tbody>
                  {cabysPageRows.map((c) => (
                    <tr key={c.codigo}>
                      <td className="mono">{c.codigo}</td>
                      <td>{c.descripcion}</td>
                      <td>{c.impuesto}%</td>
                      <td className="tdRight">
                        <button
                          className="iconBtn"
                          type="button"
                          title="Copiar código"
                          onClick={() => copyCabysCode(c.codigo)}
                        >
                          📋
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* AE */}
          <section className="card">
            <h2>Consulta de Contribuyente</h2>

            <label>Identificación</label>
            <input
              value={aeId}
              onChange={(e) => setAeId(onlyDigits(e.target.value))}
              placeholder="Solo números (111111111)"
              inputMode="numeric"
            />

            {!aeValid && aeId.length > 0 && (
              <div className="hint bad">La identificación debe tener 9, 10 u 11 dígitos.</div>
            )}

            <div className="row">
              <button
                className="btnPrimary"
                onClick={consultarAE}
                disabled={!aeValid || aeLoading}
                type="button"
              >
                {aeLoading ? "Consultando…" : "Consultar"}
              </button>

              <button className="btnGhost" onClick={copyAeSummary} disabled={!aeData} type="button">
                Copiar resumen
              </button>

              <button
                className="btnGhost"
                onClick={copyAeActividadesCsv}
                disabled={!aeData?.actividades?.length}
                type="button"
              >
                Copiar CSV actividades
              </button>

              <button
                className="btnGhost"
                onClick={downloadAeActividadesXlsx}
                disabled={!aeData?.actividades?.length}
                type="button"
              >
                Descargar XLSX actividades
              </button>
            </div>

            {aeError && <div className="alert">⚠️ {aeError}</div>}

            {aeData && (
              <>
                {/* ===== BLOQUE SAGRADO (NO CAMBIAR UI) ===== */}
                <div className="ae-box">
                  <div className="ae-header">
                    <div className="ae-col">
                      <div className="label">Nombre</div>
                      <div className="value">{aeData.nombre}</div>
                    </div>

                    <div className="ae-col">
                      <div className="label">Identificación</div>
                      {/* ✅ SIEMPRE la cédula del JSON */}
                      <div className="value mono">{aeJsonId}</div>
                    </div>

                    <div className="ae-col">
                      <div className="label">Régimen</div>
                      <div className="value">{aeData.regimen?.descripcion}</div>
                    </div>
                  </div>

                  {/* 👇 chips en pastillas (no texto corrido) */}
                  <div className="ae-chips">
                    <span className="chip">Estado: {aeData.situacion?.estado}</span>
                    <span className="chip">Moroso: {aeData.situacion?.moroso}</span>
                    <span className="chip">Omiso: {aeData.situacion?.omiso}</span>
                    <span className="chip">AT: {aeData.situacion?.administracionTributaria}</span>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(aeData.actividades || []).map((a) => (
                      <tr key={`${a.codigo}-${a.tipo}-${a.estado}`}>
                        <td className="mono">{a.codigo}</td>
                        <td>{a.descripcion}</td>
                        <td>{a.tipo === "P" ? "Principal" : "Secundaria"}</td>
                        <td>{a.estado === "A" ? "Activa" : "Inactiva"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          {/* GOMETA */}
          <section className="card">
            <h2>Consulta de cédula TSE</h2>

            <label>Búsqueda</label>
            <input
              value={cedQuery}
              onChange={(e) => setCedQuery(e.target.value)}
              placeholder="Cédula física/jurídica o palabras"
            />

            <div className="row">
              <button
                className="btnPrimary"
                onClick={consultarCedulas}
                disabled={!cedCanSearch || cedLoading}
                type="button"
              >
                {cedLoading ? "Consultando…" : "Consultar"}
              </button>

              <button className="btnGhost" onClick={downloadCedulasXlsx} disabled={!cedItems.length} type="button">
                Descargar XLSX
              </button>
            </div>

            {cedError && <div className="alert">⚠️ {cedError}</div>}

            {cedItems.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Cédula</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th className="thRight">Copiar</th>
                  </tr>
                </thead>
                <tbody>
                  {cedItems.map((x) => (
                    <tr key={x.id}>
                      <td className="mono">{x.cedula}</td>
                      <td>{x.nombre}</td>
                      <td className="mono">{x.tipo}</td>
                      <td className="tdRight">
                        <button
                          className="iconBtn"
                          type="button"
                          title="Copiar cédula"
                          onClick={() => copyText(String(x.cedula || ""))}
                        >
                          📋
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </main>

        <footer className="muted footer"></footer>
      </div>
    </div>
  )
}
