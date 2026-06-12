import { IC } from "../constants/icons.jsx"
import { formatFechaCR, taxClass } from "../utils/formatters.js"
import { cabysEsServicio } from "../utils/cabysHelpers.js"
import { CopyBtn } from "./CopyBtn.jsx"
import { CopyIco } from "./CopyIco.jsx"

// IC needed for xml tag — suppress unused lint
void IC

export function XmlFacturaResult({ data, fl, flash, cabysValidation = {}, soloInconsistencias = false, setSoloInconsistencias, onCabysClick, onPrint, onReset, onExcelDownload }) {
  const mon = data.resumen.moneda || "CRC"
  const tc  = data.resumen.tipoCambio ? parseFloat(data.resumen.tipoCambio) : null
  const isUsd = mon === "USD", isEur = mon === "EUR"

  const fmtM = (v) => {
    const n = parseFloat(v || 0)
    if (isNaN(n)) return "—"
    const f = new Intl.NumberFormat("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })
    if (isUsd) return `$${f.format(n)}`
    if (isEur) return `€${f.format(n)}`
    return `₡${f.format(n)}`
  }

  const fmtPct = (v) => {
    if (!v) return null
    const n = parseFloat(v)
    return isNaN(n) ? null : `${parseFloat(n.toFixed(4))}%`
  }

  const fmtQty = (v) => {
    if (!v) return v
    const n = parseFloat(v)
    return isNaN(n) ? v : String(parseFloat(n.toFixed(6)))
  }

  const fmtTc = tc && tc > 0
    ? new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(tc)
    : null

  return (
    <div>
      <div className="xmlResult" id="xmlPrintArea">

        {/* ── Encabezado ── */}
        <div className="xmlResultHead">
          <div className={`xmlDocType${data.rootTag==="NotaCreditoElectronica"?" xmlDocType-nc":data.rootTag==="NotaDebitoElectronica"?" xmlDocType-nd":data.rootTag==="TiqueteElectronico"?" xmlDocType-tiquete":data.rootTag==="FacturaElectronicaCompra"?" xmlDocType-compra":""}`}>{data.tipoDoc}</div>
          {data.numConsecutivo && (
            <div className="xmlHeadField">
              <span className="xmlHeadLbl">Consecutivo</span>
              <div className="xmlHeadRow">
                <span className="xmlConsec mono">{data.numConsecutivo}</span>
                <button className={`xmlCopyBtn${fl==="xml-consec"?" xmlCopyBtnOk":""}`} type="button"
                  onClick={() => flash("xml-consec", data.numConsecutivo)} title="Copiar consecutivo">
                  {fl==="xml-consec" ? "✓" : <CopyIco/>}
                </button>
              </div>
            </div>
          )}
          {data.clave && (
            <div className="xmlHeadField">
              <span className="xmlHeadLbl">Clave</span>
              <div className="xmlHeadRow">
                <span className="xmlClave mono">{data.clave}</span>
                <button className={`xmlCopyBtn${fl==="xml-clave"?" xmlCopyBtnOk":""}`} type="button"
                  onClick={() => flash("xml-clave", data.clave)} title="Copiar clave">
                  {fl==="xml-clave" ? "✓" : <CopyIco/>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Emisor / Receptor ── */}
        <div className="xmlParties">
          <div className="xmlParty">
            <div className="xmlPartyLabel">Emisor</div>
            <div className="xmlPartyName">{data.emisor.nombre || "—"}</div>
            {data.emisor.comercial && <div className="xmlPartyComm">{data.emisor.comercial}</div>}
            {data.emisor.cedula && <div className="xmlPartyCed mono">{data.emisor.cedula}</div>}
            {data.emisor.correo && <div className="xmlPartySub">{data.emisor.correo}</div>}
          </div>
          {(data.receptor.nombre || data.receptor.cedula) && (
            <div className="xmlParty">
              <div className="xmlPartyLabel">Receptor</div>
              <div className="xmlPartyName">{data.receptor.nombre || "—"}</div>
              {data.receptor.cedula && <div className="xmlPartyCed mono">{data.receptor.cedula}</div>}
              {data.receptor.correo && <div className="xmlPartySub">{data.receptor.correo}</div>}
            </div>
          )}
        </div>

        {/* ── Meta ── */}
        <div className="xmlMeta">
          {data.fecha && (
            <div className="xmlMetaItem"><span>Fecha</span><span>{formatFechaCR(data.fecha)}</span></div>
          )}
          <div className="xmlMetaItem">
            <span>Moneda</span>
            <span className={`xmlMonTag xmlMonTag-${mon.toLowerCase()}`}>{mon}</span>
          </div>
          {fmtTc && !(mon === "CRC" && tc === 1) && (
            <div className="xmlMetaItem"><span>Tipo de cambio</span><span className="mono">{isUsd ? "$" : isEur ? "€" : "₡"}{fmtTc}</span></div>
          )}
          {data.condicionVenta && (
            <div className="xmlMetaItem">
              <span>Condición de venta</span>
              <span>{{"01":"Contado","02":"Crédito","03":"Consignación","04":"Apartado","99":"Otros"}[data.condicionVenta] || data.condicionVenta}</span>
            </div>
          )}
        </div>

        {/* ── Documento Relacionado ── */}
        {data.referencias && data.referencias.length > 0 && (
          <div className="xmlRef">
            {data.referencias.map((r, i) => {
              const isNc = data.rootTag === "NotaCreditoElectronica"
              const isNd = data.rootTag === "NotaDebitoElectronica"
              const bannerCls = `xmlRefBanner${isNc ? " xmlRefBanner-nc" : isNd ? " xmlRefBanner-nd" : ""}`
              const badgeCls  = `xmlRefBannerBadge${isNc ? " xmlRefBannerBadge-nc" : isNd ? " xmlRefBannerBadge-nd" : " xmlRefBannerBadge-default"}`
              return (
                <div key={i} className={bannerCls}>
                  <div className="xmlRefBannerHead">
                    <span className="xmlRefBannerType">Documento Relacionado</span>
                    {r.tipoDoc && <span className={badgeCls}>{data.tiposRefDoc?.[r.tipoDoc] || r.tipoDoc}</span>}
                  </div>
                  <div className="xmlRefBody">
                    {r.numero && <div className="xmlRefField xmlRefField-full"><span className="xmlRefLbl">Clave / Consecutivo</span><span className="xmlRefVal xmlRefNumero">{r.numero}</span></div>}
                    {r.fechaRef && <div className="xmlRefField"><span className="xmlRefLbl">Fecha</span><span className="xmlRefVal">{formatFechaCR(r.fechaRef)}</span></div>}
                    {r.codigo && <div className="xmlRefField"><span className="xmlRefLbl">Código de referencia</span><span className="xmlRefVal">{data.codigosRef?.[r.codigo] || r.codigo}</span></div>}
                    {r.razon && <div className="xmlRefField xmlRefField-full"><span className="xmlRefLbl">Motivo</span><span className="xmlRefVal xmlRefRazon">{r.razon}</span></div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Resumen de validaciones ── */}
        {data.lines.length > 0 && Object.keys(cabysValidation).length > 0 && (() => {
          const loading = Object.values(cabysValidation).some(v => v.status === "loading")
          const BANNER_SVC_UNITS = ["Sp","Al","Os","Spe","m2e"]
          const lineStats = data.lines.map(l => {
            if (!l.cabys) return { cabysStatus: null, ivaMismatch: false, tipoAviso: false }
            const cv = cabysValidation[l.cabys] || {}
            const ivaMismatch = cv.status === "ok" && cv.impuesto !== null && l.ivaPct !== undefined && l.ivaPct !== ""
              ? parseFloat(l.ivaPct) !== cv.impuesto : false
            const cabysEsSvc = cabysEsServicio(l.cabys)
            const xmlEsSvc = l.unidad ? BANNER_SVC_UNITS.includes(l.unidad) : null
            const tipoAviso = cv.status === "ok" && cabysEsSvc !== null && xmlEsSvc !== null && cabysEsSvc !== xmlEsSvc
            return { cabysStatus: cv.status, ivaMismatch, tipoAviso }
          })
          const nOk      = lineStats.filter(v => v.cabysStatus === "ok" && !v.ivaMismatch && !v.tipoAviso).length
          const nNf      = lineStats.filter(v => v.cabysStatus === "nf").length
          const nErr     = lineStats.filter(v => v.cabysStatus === "err").length
          const nIvaDiff = lineStats.filter(v => v.ivaMismatch).length
          const nTipo    = lineStats.filter(v => v.tipoAviso).length
          const hasWarn  = nNf > 0 || nIvaDiff > 0 || nTipo > 0
          const totalInconsistencias = nNf + nIvaDiff + nTipo
          return (
            <div className={`xmlCabysValidBanner${hasWarn ? " xmlCabysValidBannerWarn" : " xmlCabysValidBannerOk"}`}>
              <span className="xmlCabysValidTitle">Validación tributaria</span>
              {loading ? (
                <span className="xmlCabysValidItem">Verificando…</span>
              ) : (
                <div className="xmlValidBannerItems">
                  {nOk  > 0 && <span className="xmlCabysValidOk">✔ {nOk} línea{nOk !== 1 ? "s" : ""} correcta{nOk !== 1 ? "s" : ""}</span>}
                  {nIvaDiff > 0 && <span className="xmlCabysValidNf">⚠ {nIvaDiff} diferencia{nIvaDiff !== 1 ? "s" : ""} de IVA</span>}
                  {nTipo  > 0 && <span className="xmlCabysValidTipo">⚠ {nTipo} verificar tipo</span>}
                  {nNf  > 0 && <span className="xmlCabysValidNf">⚠ {nNf} CABYS no encontrado{nNf !== 1 ? "s" : ""}</span>}
                  {nErr > 0 && <span className="xmlCabysValidErr">⚠ {nErr} sin verificar</span>}
                  {totalInconsistencias > 0 && (
                    <button
                      className={`xmlFilterToggle${soloInconsistencias ? " xmlFilterToggleActive" : ""}`}
                      type="button"
                      onClick={() => setSoloInconsistencias(v => !v)}
                    >
                      {soloInconsistencias ? "Ver todas las líneas" : "Ver solo inconsistencias"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Líneas de detalle ── */}
        {data.lines.length > 0 && (
          <div className="xmlLines">
            <div className="xmlLinesTitle">Detalle de líneas ({data.lines.length})</div>
            <div className="xmlTableWrap">
              <table className="xmlLinesTable">
                <thead>
                  <tr>
                    <th className="xmlThNum">#</th>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th className="xmlThR">Precio unitario</th>
                    <th>IVA</th>
                    <th className="xmlThR">Total línea</th>
                    <th>CABYS</th>
                    <th className="xmlThCabysVal">Validaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l, i) => {
                    const pct = fmtPct(l.ivaPct)
                    const cid = `xml-c-${i}`
                    const cv = l.cabys ? cabysValidation[l.cabys] : null
                    const cvStatus = cv?.status
                    const ivaMismatch = cvStatus === "ok" && cv.impuesto !== null && l.ivaPct !== undefined && l.ivaPct !== ""
                      ? parseFloat(l.ivaPct) !== cv.impuesto : false
                    const XML_SVC_UNITS = ["Sp","Al","Os","Spe","m2e"]
                    const cabysEsSvc = l.cabys ? cabysEsServicio(l.cabys) : null
                    const xmlEsSvc = l.unidad ? XML_SVC_UNITS.includes(l.unidad) : null
                    const tipoAviso = cvStatus === "ok" && cabysEsSvc !== null && xmlEsSvc !== null && cabysEsSvc !== xmlEsSvc
                    const hasRowWarn = ivaMismatch || cvStatus === "nf" || tipoAviso
                    if (soloInconsistencias && !hasRowWarn) return null
                    const rowClass = (ivaMismatch || cvStatus === "nf") ? "xmlRowWarn" : tipoAviso ? "xmlRowTipo" : ""
                    return (
                      <tr key={i} className={rowClass}>
                        <td className="xmlTdNum">{i + 1}</td>
                        <td className="xmlTdDesc">{l.descripcion}</td>
                        <td className="mono xmlTdQty">{fmtQty(l.cantidad)} <span className="xmlUnt">{l.unidad}</span></td>
                        <td className="mono xmlTdR">{l.precio ? fmtM(l.precio) : "—"}</td>
                        <td>{pct ? <span className={`taxBadgeV2 ${taxClass(parseFloat(l.ivaPct))}`}>{pct}</span> : <span className="xmlMuted">—</span>}</td>
                        <td className="mono xmlTdR xmlTdBold">{l.total ? fmtM(l.total) : "—"}</td>
                        <td className="mono xmlTdCabys">
                          {l.cabys ? (
                            <div className="xmlCabysCell">
                              {cvStatus === "ok" && onCabysClick ? (
                                <button
                                  className="xmlCabysCodeBtn"
                                  type="button"
                                  title="Ver detalle CABYS"
                                  onClick={() => onCabysClick({
                                    codigo: l.cabys,
                                    descripcion: cv.descripcion || l.descripcion,
                                    impuesto: cv.impuesto ?? 0,
                                    categorias: cv.categorias || []
                                  })}
                                >
                                  {l.cabys}
                                </button>
                              ) : (
                                <span className="xmlCabysCode">{l.cabys}</span>
                              )}
                              <button className={`xmlCopyBtn${fl===cid?" xmlCopyBtnOk":""}`} type="button"
                                onClick={() => flash(cid, l.cabys)} title="Copiar CABYS">
                                {fl===cid ? "✓" : <CopyIco/>}
                              </button>
                            </div>
                          ) : <span className="xmlMuted">—</span>}
                        </td>
                        <td className="xmlTdCabysVal">
                          {!l.cabys ? (
                            <span className="xmlMuted">—</span>
                          ) : cvStatus === "loading" ? (
                            <span className="xmlCabysValLoading">···</span>
                          ) : cvStatus === "nf" ? (
                            <span className="xmlCabysValNf">⚠ No encontrado en CABYS</span>
                          ) : cvStatus === "err" ? (
                            <span className="xmlCabysValErr">⚠ Sin verificar</span>
                          ) : cvStatus === "ok" ? (
                            <div className="xmlCabysValGroup">
                              <span className="xmlCabysValOk">✔ CABYS válido</span>
                              {ivaMismatch ? (
                                <span className="xmlCabysValMismatch">⚠ IVA XML: {parseFloat(l.ivaPct)}% / esperado: {cv.impuesto}%</span>
                              ) : (
                                <span className="xmlCabysValOk">✔ IVA correcto</span>
                              )}
                              <span className={`cabysTypeBadge${cabysEsSvc ? " cabysTypeSvc" : " cabysTypeArt"}`}>
                                🏷 {cabysEsSvc ? "Servicio" : "Artículo"}
                              </span>
                              {tipoAviso && (
                                <span className="xmlCabysValTipoAviso" title={`CABYS clasifica como ${cabysEsSvc ? "Servicio" : "Artículo"} pero la unidad XML es "${l.unidad}"`}>
                                  Verificar tipo
                                </span>
                              )}
                            </div>
                          ) : <span className="xmlMuted">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Totales ── */}
        <div className="xmlTotals">
          {data.resumen.totalVenta && parseFloat(data.resumen.totalVenta) > 0 &&
            <div className="xmlTotalRow"><span>Subtotal</span><span className="mono">{fmtM(data.resumen.totalVenta)}</span></div>}
          {data.resumen.totalDesc && parseFloat(data.resumen.totalDesc) > 0 &&
            <div className="xmlTotalRow"><span>Descuentos</span><span className="mono xmlTotalDisc">− {fmtM(data.resumen.totalDesc)}</span></div>}
          {data.resumen.totalImpuesto && parseFloat(data.resumen.totalImpuesto) > 0 &&
            <div className="xmlTotalRow"><span>IVA</span><span className="mono">{fmtM(data.resumen.totalImpuesto)}</span></div>}
          {data.resumen.total && (
            <div className="xmlTotalRow xmlTotalFinal">
              <span>TOTAL</span>
              <span className="mono">{fmtM(data.resumen.total)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="xmlActions">
        <button type="button" className="btn btnPrimary" onClick={onPrint}>🖨 Imprimir / PDF</button>
        <CopyBtn id="xml-copy" label="Copiar resumen" fl={fl} flash={flash} disabled={false}
          getText={() => [data.tipoDoc,
            `Emisor: ${data.emisor.nombre}`,
            data.receptor.nombre ? `Receptor: ${data.receptor.nombre}` : "",
            data.fecha ? `Fecha: ${formatFechaCR(data.fecha)}` : "",
            data.resumen.total ? `Total: ${fmtM(data.resumen.total)}` : "",
            data.clave ? `Clave: ${data.clave}` : "",
          ].filter(Boolean).join("\n")} />
        {data.lines.length > 0 && (
          <button type="button" className="btn btnGhost" onClick={onExcelDownload}>Exportar Excel</button>
        )}
        <button type="button" className="btn btnGhost" onClick={onReset}>← Cargar otro XML</button>
      </div>

      {data.lines.length > 0 && Object.keys(cabysValidation).length > 0 && (
        <div className="xmlLegalDisclaimer">
          La validación es informativa y no sustituye la revisión tributaria profesional. Los datos se contrastan con la API pública de Hacienda en tiempo real. Ante cualquier duda consulte a un contador autorizado.
        </div>
      )}
    </div>
  )
}
