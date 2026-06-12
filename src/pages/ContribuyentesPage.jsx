import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IC } from "../constants/icons.jsx"
import { loadH, saveH } from "../constants/storage.js"
import { toCsv, downloadXlsx } from "../utils/exportHelpers.js"
import { onlyDigits, isValidAeId } from "../utils/stringHelpers.js"
import { PageHeader } from "../components/PageHeader.jsx"
import { EmptyState } from "../components/EmptyState.jsx"
import { FichaContribuyente } from "../components/FichaContribuyente.jsx"

export function ContribuyentesPage({ fl, flash, navigateToCabys, logActivity, prefillId }) {
  const [aeId,       setAeId]       = useState(prefillId || "")
  const [aeData,     setAeData]     = useState(null)
  const [aeLoading,  setAeLoading]  = useState(false)
  const [aeError,    setAeError]    = useState("")
  const [aeSearched, setAeSearched] = useState(false)
  const [_aeHist,    setAeHist]     = useState(() => loadH("ht_ae"))
  const aeLastQ = useRef("")

  const aeDigits = useMemo(() => onlyDigits(aeId), [aeId])
  const aeValid  = useMemo(() => isValidAeId(aeId), [aeId])

  // Auto-search when prefillId prop changes (cross-page navigation)
  const prevPrefillRef = useRef(prefillId || "")
  useEffect(() => {
    if (prefillId && prefillId !== prevPrefillRef.current) {
      prevPrefillRef.current = prefillId
      setAeId(prefillId)
      // defer so consultarAE closure has updated aeDigits
      setTimeout(() => consultarAE(prefillId), 30)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillId])

  const consultarAE = useCallback(async (idOv) => {
    const digits = idOv ? onlyDigits(idOv) : aeDigits
    if (!isValidAeId(digits)) return
    setAeLoading(true); setAeError(""); setAeSearched(true)
    try {
      const res = await fetch(`/hacienda/fe/ae?identificacion=${digits}`, { cache: "no-store" })
      if (res.status === 404) { setAeData(null); aeLastQ.current = digits; return }
      if (!res.ok) throw new Error(`Error consultando Hacienda (${res.status})`)
      const json = await res.json()
      if (json?.code === 404 || json?.status?.toLowerCase().includes("not available")) { setAeData(null); aeLastQ.current = digits; return }
      setAeData(json)
      aeLastQ.current = digits; saveH("ht_ae", digits); setAeHist(loadH("ht_ae"))
      logActivity("contribuyente", digits)
    } catch (e) { setAeData(null); setAeError(e?.message || "Error consultando contribuyente") }
    finally { setAeLoading(false) }
  }, [aeDigits, logActivity])

  const aeJsonId = useMemo(() => {
    const raw = aeData?.identificacion ?? aeData?.identificacionTributaria ?? aeData?.cedula ?? aeData?.id ?? ""
    return onlyDigits(String(raw)) || aeLastQ.current
  }, [aeData])

  const aeResumen = () => {
    if (!aeData) return ""; const s = aeData?.situacion || {}
    return [`Contribuyente`, `Nombre: ${aeData.nombre || "-"}`, `Identificación: ${aeJsonId || "-"}`,
      `Régimen: ${aeData.regimen?.descripcion || "-"}`, `Estado: ${s.estado || "-"}`,
      `Moroso: ${s.moroso || "-"}`, `Omiso: ${s.omiso || "-"}`,
      `AT: ${s.administracionTributaria || "-"}`].join("\n")
  }

  const aeActCsv = () => {
    if (!aeData?.actividades?.length) return ""
    return toCsv(aeData.actividades.map(a => [a.codigo, a.descripcion, a.tipo === "P" ? "Principal" : "Secundaria", a.estado === "A" ? "Activa" : "Inactiva"]), ["codigo", "descripcion", "tipo", "estado"])
  }

  return (
    <div className="pageWrap pageCentered">
      <PageHeader icon={IC.user} title="Verificar Contribuyente"
        description="Consultá el estado fiscal, régimen y actividades económicas. Desde una actividad podés buscar sus códigos CABYS directamente."
        onClear={(aeData || aeError) ? () => { setAeData(null); setAeId(""); setAeError("") } : null} />

      <div className="toolCard">
        <div className="toolSection">
          <label className="lbl">Cédula, NITE o número de identificación</label>
          <div className="inputRow">
            <input className="inp" value={aeId} inputMode="numeric" placeholder="Cédula, NITE o DIMEX (9–12 dígitos)"
              onChange={e => setAeId(onlyDigits(e.target.value))}
              onKeyDown={e => { if (e.key === "Enter") consultarAE() }} />
            <button className="btn btnPrimary" onClick={() => consultarAE()} disabled={!aeValid || aeLoading} type="button">
              {aeLoading ? "Consultando…" : "Consultar"}
            </button>
          </div>
          {!aeValid && aeId.length > 0 && <div className="hintBad">Cédula (9 dígitos), jurídica (10), NITE (10) o DIMEX (12).</div>}
        </div>
      </div>

      {aeError && <div className="alertBox">{IC.warning} {aeError}</div>}
      {aeSearched && !aeLoading && !aeError && !aeData && aeLastQ.current && (
        <EmptyState msg={`No se encontró contribuyente para "${aeLastQ.current}"`} />
      )}

      {aeData && (
        <FichaContribuyente
          data={aeData}
          aeJsonId={aeJsonId}
          onBuscarCabys={navigateToCabys}
          fl={fl} flash={flash}
          aeResumen={aeResumen}
          aeActCsv={aeActCsv}
          downloadActs={() => {
            if (!aeData?.actividades?.length) return
            downloadXlsx("actividades_ae.xlsx", "Actividades",
              aeData.actividades.map(a => ({ codigo: a.codigo, descripcion: a.descripcion, tipo: a.tipo === "P" ? "Principal" : "Secundaria", estado: a.estado === "A" ? "Activa" : "Inactiva" })),
              ["codigo", "descripcion", "tipo", "estado"])
          }}
        />
      )}
    </div>
  )
}
