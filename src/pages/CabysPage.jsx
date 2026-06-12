import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IC } from "../constants/icons.jsx"
import { CABYS_SUGERENCIAS, AE_MAP } from "../constants/cabys.js"
import { loadH, saveH } from "../constants/storage.js"
import { taxClass } from "../utils/formatters.js"
import { restoreAccents, extractAeTerms, matchAe } from "../utils/stringHelpers.js"
import { toCsv, downloadBlob, downloadXlsx } from "../utils/exportHelpers.js"
import { cabysEsServicio } from "../utils/cabysHelpers.js"
import { CabysCard } from "../components/CabysCard.jsx"
import { CabysDrawer } from "../components/CabysDrawer.jsx"
import { EmptyState } from "../components/EmptyState.jsx"
import { SortableTH } from "../components/SortableTH.jsx"

export function CabysPage({ fl, flash, favs, onToggleFav, consultarCabysRef, initialQuery, logActivity }) {
  const [cabysQ,        setCabysQ]        = useState(initialQuery?.q || "")
  const [cabysData,     setCabysData]     = useState([])
  const [cabysLoading,  setCabysLoading]  = useState(false)
  const [cabysError,    setCabysError]    = useState("")
  const [cabysPage,     setCabysPage]     = useState(0)
  const [cabysLastTop,  setCabysLastTop]  = useState(0)
  const [cabysSearched, setCabysSearched] = useState(false)
  const [_cabysHist,    setCabysHist]     = useState(() => loadH("ht_cabys"))
  const [cabysSort,     setCabysSort]     = useState({ col: null, dir: "asc" })
  const [cabysView,     setCabysView]     = useState("cards")
  const [cabysNorm,     setCabysNorm]     = useState("")
  const [cabysMode,     setCabysMode]     = useState("libre")
  const [aeDesc,        setAeDesc]        = useState("")
  const [cabysAeMatch,  setCabysAeMatch]  = useState(null)
  const [selectedCabys, setSelectedCabys] = useState(null)
  const [cabysTop]                        = useState(12)

  const cabysQ_ = useMemo(() => cabysQ.trim(), [cabysQ])
  const pageSize = useMemo(() => {
    const n = Number(cabysTop); return Number.isFinite(n) && n > 0 ? Math.min(50, Math.max(6, n)) : 12
  }, [cabysTop])

  const consultarCabys = useCallback(async ({ reset = false, q: qOv } = {}) => {
    const rawQ = (qOv ?? cabysQ_).trim(); if (!rawQ) return
    const q = restoreAccents(rawQ)
    setCabysNorm(q !== rawQ ? q : "")
    if (reset) setCabysPage(0)
    setCabysLoading(true); setCabysError(""); setCabysSearched(true)
    const esCodigo = /^\d{5,13}$/.test(rawQ.replace(/\s/g, ""))
    try {
      const pg = reset ? 0 : cabysPage
      const top = Math.min(50, pageSize * (pg + 1)); setCabysLastTop(top)
      const url = esCodigo
        ? `/hacienda/fe/cabys?codigo=${encodeURIComponent(rawQ.replace(/\s/g, ""))}`
        : `/hacienda/fe/cabys?q=${encodeURIComponent(q)}&top=${top}`
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setCabysData(Array.isArray(json) ? json : (json.cabys || []))
      if (reset) { saveH("ht_cabys", rawQ); setCabysHist(loadH("ht_cabys")); setCabysPage(0); logActivity("cabys", rawQ) }
    } catch (e) { setCabysData([]); setCabysError(e?.message || "Error") }
    finally { setCabysLoading(false) }
  }, [cabysQ_, cabysPage, pageSize, logActivity])

  const consultarCabysAe = useCallback(() => {
    const ae = matchAe(aeDesc, AE_MAP)
    const terms = ae ? ae.q : extractAeTerms(aeDesc)
    if (!terms) return
    const normalized = restoreAccents(terms)
    setCabysAeMatch(ae || null)
    setCabysQ(normalized)
    setCabysMode("libre")
    consultarCabysRef.current?.({ reset: true, q: normalized })
  }, [aeDesc, consultarCabysRef])

  // Registra la función en el ref global para búsquedas cross-página
  useEffect(() => { consultarCabysRef.current = consultarCabys }, [consultarCabys, consultarCabysRef])

  // Ejecuta búsqueda inicial si viene de HomePage/Clientes
  const lastInitialQuery = useRef(null)
  useEffect(() => {
    if (initialQuery && initialQuery !== lastInitialQuery.current) {
      lastInitialQuery.current = initialQuery
      setCabysQ(initialQuery.q)
      setCabysPage(0)
      consultarCabys({ reset: true, q: initialQuery.q })
    }
  }, [initialQuery, consultarCabys])

  const cabysNext = async () => {
    const np = cabysPage + 1, need = Math.min(50, pageSize * (np + 1))
    if (cabysData.length < need) {
      setCabysLoading(true); setCabysError("")
      try {
        const esCod = /^\d{5,13}$/.test(cabysQ_.replace(/\s/g,""))
        const res = await fetch(esCod
          ? `/hacienda/fe/cabys?codigo=${encodeURIComponent(cabysQ_)}`
          : `/hacienda/fe/cabys?q=${encodeURIComponent(cabysQ_)}&top=${need}`,
          { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setCabysData(Array.isArray(json) ? json : (json.cabys || [])); setCabysLastTop(need)
      } catch (e) { setCabysError(e?.message || "Error"); setCabysLoading(false); return }
      finally { setCabysLoading(false) }
    } else { setCabysLastTop(need) }
    setCabysPage(np)
  }

  const cabysTotal = cabysData.length
  const cabysStart = cabysPage * pageSize, cabysEnd = cabysStart + pageSize
  const cabysRaw   = cabysData.slice(cabysStart, cabysEnd)
  const cabysRows  = useMemo(() => {
    if (!cabysSort.col) return cabysRaw
    return [...cabysRaw].sort((a, b) => {
      const av = String(a[cabysSort.col] ?? ""), bv = String(b[cabysSort.col] ?? "")
      const r = av.localeCompare(bv, "es", { numeric: cabysSort.col !== "descripcion" })
      return cabysSort.dir === "asc" ? r : -r
    })
  }, [cabysRaw, cabysSort])
  const cabysHasNext = cabysEnd < cabysTotal || (cabysTotal === cabysLastTop && cabysLastTop < 50)

  const handleCabysSort = (col) => {
    setCabysSort(s => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" })
  }

  return (
    <div className="pageWrap pageCentered" style={{ maxWidth: 960 }}>
      {/* Favoritos */}
      {favs.length > 0 && !cabysSearched && (
        <div className="favSection">
          <div className="favSectionTitle">{IC.star} Favoritos guardados</div>
          <div className="cabysGrid">
            {favs.map(item => (
              <CabysCard key={item.codigo} item={item} score={null}
                fl={fl} flash={flash} favs={favs} onToggleFav={onToggleFav}
                onSelect={setSelectedCabys} />
            ))}
          </div>
        </div>
      )}

      <div className="assistantHero">
        <h1 className="assistantTitle">Asistente CABYS</h1>
        <p className="assistantSub">Describí tu actividad, producto o giro de negocio</p>

        <div className="cabysModeRow">
          <button type="button" className={`cabysModeBtn${cabysMode === "libre" ? " active" : ""}`} onClick={() => setCabysMode("libre")}>
            🔍 Búsqueda libre
          </button>
          <button type="button" className={`cabysModeBtn${cabysMode === "ae" ? " active" : ""}`} onClick={() => setCabysMode("ae")}>
            🏢 Mi actividad económica
          </button>
        </div>

        {cabysMode === "libre" ? (
          <>
            <div className="assistantSearchWrap">
              <input className="assistantSearchInput" value={cabysQ}
                placeholder="Ej: vendo ropa en tienda, servicios contables, arroz blanco…"
                onChange={e => { setCabysQ(e.target.value); setCabysPage(0) }}
                onKeyDown={e => { if (e.key === "Enter") consultarCabys({ reset: true }) }} />
              <button className="assistantSearchBtn" onClick={() => consultarCabys({ reset: true })}
                disabled={!cabysQ_.length || cabysLoading} type="button">
                {cabysLoading ? "Buscando…" : "Buscar"}
              </button>
            </div>
            <div className="quickChipsRow">
              {CABYS_SUGERENCIAS.map(s => (
                <button key={s.q} type="button" className="quickChip"
                  onClick={() => { setCabysQ(s.q); setCabysPage(0); consultarCabys({ reset: true, q: s.q }) }}>
                  {s.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="aeSearchBlock">
            <p className="aeSearchHint">Escribí la descripción de tu actividad económica tal como aparece en Hacienda — el sistema extraerá los términos clave y buscará los códigos CABYS más relevantes.</p>
            <div className="assistantSearchWrap">
              <input className="assistantSearchInput" value={aeDesc}
                placeholder="Ej: Actividades de restaurantes y de servicio móvil de comidas"
                onChange={e => setAeDesc(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") consultarCabysAe() }} />
              <button className="assistantSearchBtn" onClick={consultarCabysAe}
                disabled={!aeDesc.trim() || cabysLoading} type="button">
                {cabysLoading ? "Buscando…" : "Sugerir CABYS"}
              </button>
            </div>
            {aeDesc.trim() && (
              <p className="aeTermsPreview">
                Términos clave: <strong>{extractAeTerms(aeDesc) || "—"}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {cabysNorm && (
        <div className="cabysNormHint">
          {IC.search} Buscando con tildes: <strong>{cabysNorm}</strong>
        </div>
      )}

      {cabysAeMatch && cabysSearched && (
        <div className="aeMatchBanner">
          <span className="aeMatchLabel">AE relacionada:</span>
          <span className="aeMatchCiiu">{cabysAeMatch.ciiu}</span>
          <span className="aeMatchName">{cabysAeMatch.label}</span>
        </div>
      )}

      {cabysError && (
        <div className="alertBox" style={{ marginTop: 16 }}>
          {IC.warning} {cabysError}
          <button type="button" className="clearInlineBtn" onClick={() => { setCabysData([]); setCabysError(""); setCabysSearched(false); setCabysQ(""); setCabysAeMatch(null) }}>✕ Limpiar</button>
        </div>
      )}
      {cabysSearched && !cabysLoading && !cabysError && !cabysTotal && (
        <div>
          <EmptyState msg={`Sin resultados para "${cabysQ_}" — intentá con términos más generales`} />
          <div style={{ textAlign:"center", marginTop: 12 }}>
            <button type="button" className="newQueryBtn" onClick={() => { setCabysData([]); setCabysSearched(false); setCabysQ(""); setCabysAeMatch(null) }}>← Nueva búsqueda</button>
          </div>
        </div>
      )}

      {cabysTotal > 0 && (
        <>
          <div className="resultsHeader" style={{ marginTop: 20 }}>
            <span className="resultsHeaderText">
              <strong>{cabysTotal}</strong> resultado{cabysTotal !== 1 ? "s" : ""} para "<strong>{cabysNorm || cabysQ_}</strong>"
            </span>
            <div className="resultsHeaderActions">
              <button type="button" className="newQueryBtn" onClick={() => { setCabysData([]); setCabysSearched(false); setCabysQ(""); setCabysAeMatch(null) }}>← Nueva búsqueda</button>
              <div className="viewModeToggle">
                <button type="button" className={`viewModeBtn${cabysView === "cards" ? " active" : ""}`} onClick={() => setCabysView("cards")}>{IC.grid}</button>
                <button type="button" className={`viewModeBtn${cabysView === "table" ? " active" : ""}`} onClick={() => setCabysView("table")}>{IC.table}</button>
              </div>
              <button className="btn btnGhost" type="button" disabled={!cabysRows.length}
                onClick={() => {
                  if (!cabysRows.length) return
                  const csv = toCsv(cabysRows.map(c => [c.codigo, c.descripcion, `${c.impuesto}%`, cabysEsServicio(c.codigo) ? "Servicio" : "Artículo"]), ["codigo", "descripcion", "impuesto", "tipo"])
                  downloadBlob("cabys.csv", new Blob([csv], { type: "text/csv;charset=utf-8;" }))
                }}>CSV</button>
              <button className="btn btnGhost" type="button" onClick={() => {
                if (!cabysRows.length) return
                downloadXlsx("cabys.xlsx", "CABYS", cabysRows.map(c => ({ codigo: c.codigo, descripcion: c.descripcion, impuesto: `${c.impuesto}%` })), ["codigo", "descripcion", "impuesto"])
              }}>XLSX</button>
            </div>
          </div>

          {cabysView === "cards" ? (
            <div className="cabysGrid">
              {cabysRows.map(c => (
                <CabysCard key={c.codigo} item={c} score={null}
                  fl={fl} flash={flash} favs={favs} onToggleFav={onToggleFav}
                  onSelect={setSelectedCabys} />
              ))}
            </div>
          ) : (
            <div className="tableWrap">
              <div className="tableToolbar">
                <span className="tableToolbarLeft">{cabysTotal} resultado{cabysTotal !== 1 ? "s" : ""}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <SortableTH col="codigo" sort={cabysSort} onSort={handleCabysSort}>Código</SortableTH>
                    <SortableTH col="descripcion" sort={cabysSort} onSort={handleCabysSort}>Descripción</SortableTH>
                    <SortableTH col="impuesto" sort={cabysSort} onSort={handleCabysSort}>Impuesto</SortableTH>
                    <th>Tipo</th>
                    <th className="thR">Copiar</th>
                  </tr>
                </thead>
                <tbody>
                  {cabysRows.map(c => (
                    <tr key={c.codigo}>
                      <td className="mono">{c.codigo}</td>
                      <td>{c.descripcion}</td>
                      <td><span className={`taxBadgeV2 ${taxClass(c.impuesto)}`}>{c.impuesto}%</span></td>
                      <td><span className={`cabysTypeBadge${cabysEsServicio(c.codigo) ? " cabysTypeSvc" : " cabysTypeArt"}`}>{cabysEsServicio(c.codigo) ? "Servicio" : "Artículo"}</span></td>
                      <td className="thR">
                        <button className={`iconBtn${fl === `cc-${c.codigo}` ? " flashed" : ""}`} type="button"
                          onClick={() => flash(`cc-${c.codigo}`, String(c.codigo || ""))}>
                          {fl === `cc-${c.codigo}` ? "✓" : "📋"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pager">
            <button className="btn btnGhost btnSm" disabled={cabysPage === 0}
              onClick={() => setCabysPage(p => Math.max(0, p - 1))} type="button">{IC.chevronLeft}</button>
            <span className="muted">Pág. {cabysPage + 1} · {Math.min(cabysEnd, cabysTotal)} de {cabysTotal}</span>
            <button className="btn btnGhost btnSm" disabled={!cabysHasNext}
              onClick={cabysNext} type="button">{IC.chevronRight}</button>
          </div>
        </>
      )}

      <CabysDrawer
        item={selectedCabys}
        relatedItems={cabysData}
        fl={fl} flash={flash}
        favs={favs}
        onToggleFav={onToggleFav}
        onClose={() => setSelectedCabys(null)}
        onSelectRelated={(r) => setSelectedCabys(r)}
      />
    </div>
  )
}
