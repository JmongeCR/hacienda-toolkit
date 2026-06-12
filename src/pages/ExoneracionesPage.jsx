import { useCallback, useState } from "react"
import { IC } from "../constants/icons.jsx"
import { onlyDigits } from "../utils/stringHelpers.js"
import { PageHeader } from "../components/PageHeader.jsx"

export function ExoneracionesPage({ logActivity }) {
  const [exoQ,        setExoQ]        = useState("")
  const [exoTipo,     setExoTipo]     = useState("01")
  const [exoData,     setExoData]     = useState(null)
  const [exoLoading,  setExoLoading]  = useState(false)
  const [exoError,    setExoError]    = useState("")
  const [exoSearched, setExoSearched] = useState(false)

  const consultarExo = useCallback(async () => {
    const num = onlyDigits(exoQ); if (!num) return
    setExoLoading(true); setExoError(""); setExoSearched(true); setExoData(null)
    try {
      const res = await fetch(`/hacienda/fe/exoneraciones?tipoDocumento=${exoTipo}&numDocumento=${num}`, { cache: "no-store" })
      if (res.status === 404) { setExoData([]); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setExoData(Array.isArray(json) ? json : json.exoneraciones || json.data || [json])
      logActivity("exoneraciones", num)
    } catch (e) { setExoError(e?.message || "Error consultando exoneraciones") }
    finally { setExoLoading(false) }
  }, [exoQ, exoTipo, logActivity])

  return (
    <div className="pageWrap pageCentered" style={{ maxWidth: 760 }}>
      <PageHeader icon={IC.shield} title="Exoneraciones"
        description="Verificá si una entidad tiene exoneración de impuestos registrada en Hacienda."
        onClear={(exoData || exoError) ? () => { setExoData(null); setExoQ(""); setExoError(""); setExoSearched(false) } : null} />

      <div className="toolCard">
        <div className="toolRow">
          <div className="toolField" style={{ flex: "0 0 160px" }}>
            <label className="lbl">Tipo de documento</label>
            <select className="inp" value={exoTipo} onChange={e => setExoTipo(e.target.value)}>
              <option value="01">Cédula física (01)</option>
              <option value="02">Cédula jurídica (02)</option>
              <option value="03">DIMEX (03)</option>
              <option value="04">NITE (04)</option>
            </select>
          </div>
          <div className="toolField" style={{ flex: 1 }}>
            <label className="lbl">Número de documento</label>
            <input className="inp mono" value={exoQ} placeholder="Ej: 106780456"
              onChange={e => setExoQ(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") consultarExo() }} />
          </div>
        </div>
        <div className="toolActions">
          <button className="btn btnPrimary" onClick={consultarExo}
            disabled={!onlyDigits(exoQ).length || exoLoading} type="button">
            {exoLoading ? "Consultando…" : "Verificar exoneraciones"}
          </button>
        </div>

        {exoError && <div className="alertBox" style={{ marginTop: 16 }}>{IC.warning} {exoError}</div>}

        {exoSearched && !exoLoading && !exoError && exoData !== null && exoData.length === 0 && (
          <div className="exoEmpty">
            <div className="exoEmptyIcon">{IC.shield}</div>
            <div className="exoEmptyTitle">Sin exoneraciones registradas</div>
            <div className="exoEmptyDesc">Este contribuyente no tiene exoneraciones activas en Hacienda.</div>
          </div>
        )}

        {exoData && exoData.length > 0 && (
          <div className="exoResults">
            <div className="exoResultsTitle">{exoData.length} exoneración{exoData.length !== 1 ? "es" : ""} encontrada{exoData.length !== 1 ? "s" : ""}</div>
            {exoData.map((ex, i) => (
              <div key={i} className="exoCard">
                {ex.nombreContribuyente && <div className="exoCardName">{ex.nombreContribuyente}</div>}
                <div className="exoCardGrid">
                  {ex.tipoExoneracion  && <div className="exoField"><span className="lbl">Tipo</span><span>{ex.tipoExoneracion}</span></div>}
                  {ex.porcentajeExoneracion != null && <div className="exoField"><span className="lbl">Porcentaje</span><span className="exoBadge">{ex.porcentajeExoneracion}%</span></div>}
                  {ex.fechaInicio       && <div className="exoField"><span className="lbl">Inicio</span><span>{ex.fechaInicio}</span></div>}
                  {ex.fechaFin          && <div className="exoField"><span className="lbl">Vencimiento</span><span>{ex.fechaFin}</span></div>}
                  {ex.estado            && <div className="exoField"><span className="lbl">Estado</span><span className={`exoEstadoBadge ${(ex.estado||"").toUpperCase() === "ACTIVO" ? "exoActivo" : "exoInactivo"}`}>{ex.estado}</span></div>}
                  {ex.numDocumento      && <div className="exoField"><span className="lbl">Documento</span><span className="mono">{ex.numDocumento}</span></div>}
                </div>
                {Object.keys(ex).filter(k => !["nombreContribuyente","tipoExoneracion","porcentajeExoneracion","fechaInicio","fechaFin","estado","numDocumento"].includes(k)).map(k => (
                  <div key={k} className="exoField"><span className="lbl">{k}</span><span>{String(ex[k])}</span></div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
