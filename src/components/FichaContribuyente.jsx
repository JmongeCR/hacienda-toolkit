import { IC } from "../constants/icons.jsx"
import { nameInitials } from "../utils/formatters.js"
import { onlyDigits } from "../utils/stringHelpers.js"
import { CopyBtn } from "./CopyBtn.jsx"

export function FichaContribuyente({ data, aeJsonId, onBuscarCabys, fl, flash, aeResumen, aeActCsv, downloadActs }) {
  const sit  = data?.situacion || {}
  const initials = nameInitials(data.nombre)
  const digits   = onlyDigits(String(aeJsonId || ""))
  const personType = digits.length === 9 ? "Física" : digits.length === 10 ? "Jurídica" : digits.length === 11 ? "DIMEX/NITE" : "—"
  const avatarColor = digits.length === 9 ? "avatarBlue" : digits.length === 10 ? "avatarGreen" : "avatarAmber"
  const estadoOk = (sit.estado || "").toUpperCase() === "INSCRITO"
  const moroso   = (sit.moroso || "NO").toUpperCase() !== "NO"
  const omiso    = (sit.omiso  || "NO").toUpperCase() !== "NO"

  return (
    <div className="crmCard">
      <div className="crmHeader">
        <div className={`crmAvatar ${avatarColor}`}>{initials}</div>
        <div className="crmHeaderInfo">
          <div className="crmName">{data.nombre}</div>
          <div className="crmMeta">
            <span className="crmMetaChip">{personType}</span>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>{aeJsonId}</span>
            {data.regimen?.descripcion && <span className="crmMetaChip crmMetaChipGray">{data.regimen.descripcion}</span>}
          </div>
        </div>
        <div className="crmHeaderActions">
          <span className={`crmEstadoBadge ${estadoOk ? "crmEstadoOk" : "crmEstadoBad"}`}>
            {sit.estado || "—"}
          </span>
          <a href="https://ovitribucr.hacienda.go.cr/ConsultaPublica/" target="_blank" rel="noopener noreferrer"
            className="btn btnGhost btnSm">{IC.external}</a>
        </div>
      </div>

      <div className="crmSection">
        <div className="crmSectionTitle">Situación tributaria</div>
        <div className="crmTaxGrid">
          <div className="crmTaxItem">
            <div className="crmTaxLabel">Moroso</div>
            <div className={`crmTaxVal ${moroso ? "crmTaxBad" : "crmTaxOk"}`}>{sit.moroso || "No"}</div>
          </div>
          <div className="crmTaxItem">
            <div className="crmTaxLabel">Omiso</div>
            <div className={`crmTaxVal ${omiso ? "crmTaxBad" : "crmTaxOk"}`}>{sit.omiso || "No"}</div>
          </div>
          {sit.administracionTributaria && (
            <div className="crmTaxItem">
              <div className="crmTaxLabel">Administración Tributaria</div>
              <div className="crmTaxVal">{sit.administracionTributaria}</div>
            </div>
          )}
        </div>
      </div>

      {data.actividades?.length > 0 && (
        <div className="crmSection">
          <div className="crmSectionTitle">Actividades económicas <span className="crmCount">{data.actividades.length}</span></div>
          {data.actividades.map(a => (
            <div key={`${a.codigo}-${a.tipo}`} className="crmActRow">
              <div className="crmActLeft">
                <span className="crmActCode">{a.codigo}</span>
                <div>
                  <div className="crmActName">{a.descripcion}</div>
                  <div className="crmActBadges">
                    <span className={`crmBadge ${a.tipo === "P" ? "crmBadgePrimary" : "crmBadgeSecondary"}`}>
                      {a.tipo === "P" ? "Principal" : "Secundaria"}
                    </span>
                    <span className={`crmBadge ${a.estado === "A" ? "crmBadgeOk" : "crmBadgeOff"}`}>
                      {a.estado === "A" ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                </div>
              </div>
              <button type="button" className="crmCabysBtn" onClick={() => onBuscarCabys(a.descripcion)}>
                Buscar CABYS {IC.arrowRight}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="crmFooter">
        <CopyBtn id="ae-res" label="Copiar resumen" fl={fl} flash={flash} getText={aeResumen} disabled={false} />
        <CopyBtn id="ae-csv" label="Copiar CSV"     fl={fl} flash={flash} getText={aeActCsv}  disabled={!data?.actividades?.length} />
        <button className="btn btnGhost" onClick={downloadActs} disabled={!data?.actividades?.length} type="button">Descargar XLSX</button>
      </div>
    </div>
  )
}
