import { useCallback, useEffect, useMemo, useState } from "react"
import { IC } from "../constants/icons.jsx"
import { formatFechaCR } from "../utils/formatters.js"
import { onlyDigits } from "../utils/stringHelpers.js"
import { parseXmlFe } from "../utils/xmlHelpers.js"
import { downloadXlsx } from "../utils/exportHelpers.js"
import { CopyBtn } from "../components/CopyBtn.jsx"
import { PageHeader } from "../components/PageHeader.jsx"
import { XmlFacturaResult } from "../components/XmlFacturaResult.jsx"
import { CabysDrawer } from "../components/CabysDrawer.jsx"
export function XmlValidatorPage({ fl, flash, cabysF_avs, toggleFav, logActivity, navigate, setAeIdExternal, consultarAEExternal, prefillKey }) {
  const [feTab,      setFeTab]      = useState("xml")
  const [feKey,      setFeKey]      = useState(prefillKey || "")
  const [feData,     setFeData]     = useState(null)
  const [feNotFound, setFeNotFound] = useState(false)
  const [feLoading,  setFeLoading]  = useState(false)
  const [feError,    setFeError]    = useState("")
  const [_feSearched, setFeSearched] = useState(false)
  const [feXmlData,       setFeXmlData]       = useState(null)
  const [feXmlError,      setFeXmlError]      = useState("")
  const [feXmlDrag,       setFeXmlDrag]       = useState(false)
  const [cabysValidation, setCabysValidation] = useState({})
  const [xmlDrawerItem,   setXmlDrawerItem]   = useState(null)
  const [soloInconsistencias, setSoloInconsistencias] = useState(false)

  const feClean = useMemo(() => onlyDigits(feKey), [feKey])
  const feValid = feClean.length === 50

  // Si viene con prefillKey, arrancar en tab "clave"
  useEffect(() => {
    if (prefillKey) setFeTab("clave")
  }, [prefillKey])

  // Validación CABYS al cargar XML
  useEffect(() => {
    if (!feXmlData?.lines?.length) { setCabysValidation({}); return }
    const codigos = [...new Set(feXmlData.lines.map(l => l.cabys).filter(Boolean))]
    if (!codigos.length) { setCabysValidation({}); return }
    setCabysValidation(Object.fromEntries(codigos.map(c => [c, { status: "loading", impuesto: null }])))
    Promise.all(codigos.map(async codigo => {
      try {
        const res = await fetch(`/hacienda/fe/cabys?codigo=${encodeURIComponent(codigo)}`, { cache: "no-store" })
        if (!res.ok) return [codigo, { status: "err", impuesto: null }]
        const json = await res.json()
        if (Array.isArray(json) && json.length > 0) {
          return [codigo, { status: "ok", impuesto: json[0].impuesto ?? null, descripcion: json[0].descripcion ?? "", categorias: json[0].categorias ?? [] }]
        }
        return [codigo, { status: "nf", impuesto: null, descripcion: "", categorias: [] }]
      } catch {
        return [codigo, { status: "err", impuesto: null, descripcion: "", categorias: [] }]
      }
    })).then(results => setCabysValidation(Object.fromEntries(results)))
  }, [feXmlData])

  useEffect(() => {
    setSoloInconsistencias(false)
    setXmlDrawerItem(null)
  }, [feXmlData])

  const feDecoded = useMemo(() => {
    if (feClean.length !== 50) return null
    const pais = feClean.slice(0, 3), dia = feClean.slice(3, 5), mes = feClean.slice(5, 7), anio = feClean.slice(7, 9)
    const cedula = feClean.slice(9, 21).replace(/^0+/, ""), terminal = feClean.slice(21, 24)
    const consec = feClean.slice(24, 41), situacion = feClean.slice(41, 42), seguridad = feClean.slice(42, 50)
    const tipos = { "001":"Factura Electrónica","002":"Nota de Débito","003":"Nota de Crédito","004":"Tiquete Electrónico","008":"FE de Compra","009":"FE de Exportación" }
    const sits  = { "1":"Normal","2":"Contingencia","3":"Sin internet" }
    return { pais, tipo: tipos[consec.slice(0, 3)] || `Comprobante ${consec.slice(0, 3)}`, fecha: `${dia}/${mes}/20${anio}`, cedula, terminal, consecutivo: consec.replace(/^0+/, ""), situacion: sits[situacion] || situacion, seguridad }
  }, [feClean])

  const consultarFe = useCallback(async () => {
    if (!feValid) return
    setFeLoading(true); setFeError(""); setFeSearched(true); setFeData(null); setFeNotFound(false)
    try {
      const res = await fetch(`/hacienda/fe/documento?clave=${feClean}`, { cache: "no-store" })
      if (res.status === 404) { setFeNotFound(true); logActivity("factura", feClean.slice(0, 20) + "…"); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json?.code === 404) { setFeNotFound(true); logActivity("factura", feClean.slice(0, 20) + "…"); return }
      setFeData(json); logActivity("factura", feClean.slice(0, 20) + "…")
    } catch (e) { setFeError(e?.message || "Error") }
    finally { setFeLoading(false) }
  }, [feValid, feClean, logActivity])

  const feResumen = useCallback(() => {
    if (!feData) return ""
    return [`Factura Electrónica`, `Clave: ${feClean}`, `Estado: ${feData?.ind_estado || feData?.estado || "-"}`,
      feData?.emisor?.nombre   ? `Emisor: ${feData.emisor.nombre}`    : "",
      feData?.receptor?.nombre ? `Receptor: ${feData.receptor.nombre}` : "",
      feData?.totalComprobante ? `Total: ₡${Number(feData.totalComprobante).toLocaleString("es-CR", { minimumFractionDigits: 2 })}` : "",
    ].filter(Boolean).join("\n")
  }, [feData, feClean])

  const handleXmlFile = (file) => {
    if (!file) return
    if (!file.name.endsWith(".xml") && file.type !== "text/xml" && file.type !== "application/xml") {
      setFeXmlError("Solo se aceptan archivos XML de factura electrónica."); return
    }
    setFeXmlError(""); setFeXmlData(null)
    const reader = new FileReader()
    reader.onload = e => {
      try { setFeXmlData(parseXmlFe(e.target.result)) }
      catch (err) { setFeXmlError(err.message) }
    }
    reader.readAsText(file, "utf-8")
  }

  const clearAll = () => {
    setFeData(null); setFeKey(""); setFeError(""); setFeSearched(false)
    setFeNotFound(false); setFeXmlData(null); setFeXmlError("")
  }

  return (
    <div className="pageWrap pageCentered">
      <PageHeader icon={IC.receipt} title="Factura Electrónica"
        description="Validá facturas por clave numérica o subí el XML para ver todos los detalles."
        onClear={(feData || feError || feNotFound || feXmlData || feXmlError) ? clearAll : null} />

      {/* Tabs */}
      <div className="feTabRow">
        <button type="button" className={`feTabBtn${feTab==="clave"?" active":""}`} onClick={() => setFeTab("clave")}>
          # Por clave (50 dígitos)
        </button>
        <button type="button" className={`feTabBtn${feTab==="xml"?" active":""}`} onClick={() => setFeTab("xml")}>
          {IC.xml} Cargar XML
        </button>
      </div>

      {/* ── Tab: Por clave ── */}
      {feTab === "clave" && (
        <div className="toolCard">
          <div className="toolSection">
            <label className="lbl">Clave numérica del comprobante (50 dígitos)</label>
            <div className="inputRow">
              <input className="inp" value={feKey} inputMode="numeric" maxLength={50}
                placeholder="50 dígitos — ej: 50623011800310…"
                onChange={e => setFeKey(onlyDigits(e.target.value))}
                onKeyDown={e => { if (e.key === "Enter") consultarFe() }} />
              <button className="btn btnPrimary" onClick={consultarFe} disabled={!feValid || feLoading} type="button">
                {feLoading ? "Verificando…" : "Verificar"}
              </button>
            </div>
            <div className={`keyCounter${feValid ? " keyOk" : ""}`}>{feClean.length}/50{feClean.length > 0 && !feValid ? " — faltan dígitos" : ""}</div>
          </div>
          {feData && <div className="toolActions"><CopyBtn id="fe-res" label="Copiar resultado" fl={fl} flash={flash} getText={feResumen} disabled={!feData} /></div>}
          {feError && <div className="alertBox">{IC.warning} {feError}</div>}

          {feValid && feDecoded && (
            <div className="feDecodedBox">
              <div className="feDecodedTitle">Información de la clave</div>
              <div className="feDecodedGrid">
                <div className="feField"><div className="lbl">Tipo</div><div className="feVal">{feDecoded.tipo}</div></div>
                <div className="feField"><div className="lbl">Fecha emisión</div><div className="feVal">{feDecoded.fecha}</div></div>
                <div className="feField"><div className="lbl">Cédula emisor</div><div className="feVal mono">{feDecoded.cedula}</div></div>
                <div className="feField"><div className="lbl">Terminal</div><div className="feVal mono">{feDecoded.terminal}</div></div>
                <div className="feField"><div className="lbl">Situación</div><div className="feVal">{feDecoded.situacion}</div></div>
                <div className="feField"><div className="lbl">Cód. seguridad</div><div className="feVal mono">{feDecoded.seguridad}</div></div>
              </div>
              {feDecoded.cedula && (
                <button type="button" className="btn btnGhost btnSm" style={{ marginTop: 12 }}
                  onClick={() => {
                    if (setAeIdExternal && consultarAEExternal) {
                      setAeIdExternal(feDecoded.cedula)
                      navigate("contribuyente")
                      setTimeout(() => consultarAEExternal(feDecoded.cedula), 50)
                    } else {
                      navigate("contribuyente", { prefillId: feDecoded.cedula })
                    }
                  }}>
                  {IC.user} Verificar emisor como contribuyente →
                </button>
              )}
            </div>
          )}

          {feNotFound && (
            <div className="feNotFound">
              <div className="feNotFoundIcon">{IC.warning}</div>
              <div>
                <div className="feNotFoundTitle">No disponible en la API pública de Hacienda</div>
                <div className="feNotFoundDesc">La API pública no indexa todos los comprobantes. La información decodificada arriba sí corresponde a esta clave. Para verificar el estado oficial:</div>
                <div className="feNotFoundLinks">
                  <a href="https://atv.hacienda.go.cr/ATV/frmConsultaFactura.aspx" target="_blank" rel="noopener noreferrer" className="feExternalBtn feExternalBtnPrimary">ATV Hacienda (sin login) ↗</a>
                  <a href="https://verificatufactura.com/verificacion-simple" target="_blank" rel="noopener noreferrer" className="feExternalBtn">VerificaTuFactura.com ↗</a>
                </div>
              </div>
            </div>
          )}

          {feData && (
            <div className="feBox">
              {(feData?.ind_estado || feData?.estado) && (
                <div className="feEstado">
                  <span className={`feEstadoBadge ${(feData?.ind_estado || feData?.estado || "").toUpperCase().includes("ACEPT") ? "feAceptado" : "feRechazado"}`}>
                    {feData?.ind_estado || feData?.estado}
                  </span>
                </div>
              )}
              <div className="feGrid">
                {feData?.emisor?.nombre   && <div className="feField"><div className="lbl">Emisor</div><div className="feVal">{feData.emisor.nombre}</div></div>}
                {feData?.receptor?.nombre && <div className="feField"><div className="lbl">Receptor</div><div className="feVal">{feData.receptor.nombre}</div></div>}
                {feData?.fecha            && <div className="feField"><div className="lbl">Fecha</div><div className="feVal">{formatFechaCR(feData.fecha)}</div></div>}
                {feData?.totalComprobante && <div className="feField"><div className="lbl">Total</div><div className="feVal mono">₡{Number(feData.totalComprobante).toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div></div>}
              </div>
              {!feData?.emisor && !feData?.estado && !feData?.ind_estado && <pre className="feRaw">{JSON.stringify(feData, null, 2)}</pre>}
            </div>
          )}

          <div className="infoBox">
            <div className="infoTitle">¿Cómo encontrar la clave?</div>
            <div className="infoText">La clave de 50 dígitos aparece en el PDF de tu factura bajo "Clave" o "Número de clave".</div>
          </div>
        </div>
      )}

      {/* ── Tab: XML ── */}
      {feTab === "xml" && (
        <div>
          {!feXmlData && (
            <div
              className={`fxvDrop${feXmlDrag?" fxvDropOver":""}`}
              onDragOver={e => { e.preventDefault(); setFeXmlDrag(true) }}
              onDragLeave={() => setFeXmlDrag(false)}
              onDrop={e => { e.preventDefault(); setFeXmlDrag(false); handleXmlFile(e.dataTransfer.files[0]) }}
              onClick={() => document.getElementById("xmlFileInput").click()}
            >
              <div className="fxvDropIco">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <rect width="44" height="44" rx="12" fill="var(--accent)" fillOpacity=".1"/>
                  <path d="M22 29V18M17 23l5-5 5 5" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 33h16" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="fxvDropTitle">Arrastre un XML aquí</div>
              <div className="fxvDropSub">o haga clic para seleccionar el archivo</div>
              <div className="fxvDropFormats">
                <span>XML</span><span>Hacienda CR</span><span>FE v4.4</span>
              </div>
              <input id="xmlFileInput" type="file" accept=".xml,text/xml,application/xml" style={{display:"none"}}
                onChange={e => handleXmlFile(e.target.files[0])} />
            </div>
          )}
          {feXmlError && <div className="alertBox">{IC.warning} {feXmlError}</div>}
          {feXmlData && (
            <>
              <XmlFacturaResult
                data={feXmlData}
                fl={fl} flash={flash}
                cabysValidation={cabysValidation}
                soloInconsistencias={soloInconsistencias}
                setSoloInconsistencias={setSoloInconsistencias}
                onCabysClick={(item) => setXmlDrawerItem(item)}
                onPrint={() => window.print()}
                onReset={() => { setFeXmlData(null); setFeXmlError(""); setCabysValidation({}) }}
                onExcelDownload={() => {
                  if (!feXmlData.lines.length) return
                  downloadXlsx("factura_detalle.xlsx", "Detalle",
                    feXmlData.lines.map(l => ({ descripcion:l.descripcion, cantidad:l.cantidad, unidad:l.unidad, precio:l.precio, iva:`${l.ivaPct}%`, total:l.total, cabys:l.cabys })),
                    ["descripcion","cantidad","unidad","precio","iva","total","cabys"])
                }}
              />
              <CabysDrawer
                item={xmlDrawerItem}
                relatedItems={[]}
                fl={fl} flash={flash}
                favs={cabysF_avs}
                onToggleFav={toggleFav}
                onClose={() => setXmlDrawerItem(null)}
                onSelectRelated={() => {}}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
