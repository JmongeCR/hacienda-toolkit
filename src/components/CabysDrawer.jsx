import { useEffect } from "react"
import { IC } from "../constants/icons.jsx"
import { taxClass } from "../utils/formatters.js"
import { cabysEsServicio, getCabysHierarchy } from "../utils/cabysHelpers.js"
import { CopyIco } from "./CopyIco.jsx"

export function CabysDrawer({ item, relatedItems = [], fl, flash, favs, onToggleFav, onClose, onSelectRelated }) {
  const esSvc = item ? cabysEsServicio(item.codigo) : false
  const isFav = favs?.some(f => f.codigo === item?.codigo)
  const idCode = `drw-c-${item?.codigo}`
  const idDesc = `drw-d-${item?.codigo}`
  const idBoth = `drw-b-${item?.codigo}`

  const allCats = item
    ? (item.categorias?.length ? item.categorias : getCabysHierarchy(item.codigo))
        .filter((v, i, a) => a.indexOf(v) === i)
    : []

  useEffect(() => {
    if (!item) return
    const handler = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [item, onClose])

  useEffect(() => {
    if (item) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [item])

  if (!item) return null

  const related = relatedItems
    .filter(r => r.codigo !== item.codigo && cabysEsServicio(r.codigo) === esSvc)
    .slice(0, 6)

  return (
    <>
      <div className="cabysDrawerOverlay" onClick={onClose} aria-hidden="true" />
      <div className="cabysDrawerPanel" role="dialog" aria-modal="true" aria-label="Detalle CABYS">
        <div className="cabysDrawerHeader">
          <div className="cabysDrawerHeaderTop">
            <div className="cabysDrawerBadges">
              <span className={`taxBadgeV2 ${taxClass(item.impuesto)}`}>{item.impuesto}% IVA</span>
              <span className={`cabysTypeBadge${esSvc ? " cabysTypeSvc" : " cabysTypeArt"}`}>
                {esSvc ? "Servicio" : "Artículo"}
              </span>
            </div>
            <button className="cabysDrawerClose" type="button" onClick={onClose} title="Cerrar (ESC)">✕</button>
          </div>
          <div className="cabysDrawerTitle">{item.descripcion}</div>
        </div>

        <div className="cabysDrawerBody">
          <div className="cabysDrawerSection">
            <div className="cabysDrawerSectionLabel">Código CABYS</div>
            <div className="cabysDrawerCodeRow">
              <span className="cabysDrawerCode">{item.codigo}</span>
              <button
                className={`cabysDrawerCopyBtn${fl === idCode ? " cabysDrawerCopyBtnOk" : ""}`}
                type="button"
                onClick={() => flash(idCode, String(item.codigo))}
                title="Copiar código"
              >
                {fl === idCode ? "✓" : <CopyIco />}
              </button>
            </div>
          </div>

          {allCats.length > 0 && (
            <div className="cabysDrawerSection">
              <div className="cabysDrawerSectionLabel">Ruta de clasificación</div>
              <div className="cabysDrawerCatPath">
                {allCats.map((cat, i) => (
                  <div key={i} className="cabysDrawerCatStep">
                    {i > 0 && <span className="cabysDrawerCatArrow">›</span>}
                    <span className="cabysDrawerCatLabel">{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="cabysDrawerSection">
            <div className="cabysDrawerSectionLabel">Descripción completa</div>
            <div className="cabysDrawerDesc">{item.descripcion}</div>
          </div>

          <div className="cabysDrawerSection">
            <div className="cabysDrawerSectionLabel">Copiar</div>
            <div className="cabysDrawerActions">
              <button
                className={`cabysDrawerActionBtn${fl === idCode ? " cabysDrawerActionBtnOk" : ""}`}
                type="button"
                onClick={() => flash(idCode, String(item.codigo))}
              >
                {fl === idCode ? "✓ Copiado" : "📋 Copiar código"}
              </button>
              <button
                className={`cabysDrawerActionBtn${fl === idDesc ? " cabysDrawerActionBtnOk" : ""}`}
                type="button"
                onClick={() => flash(idDesc, item.descripcion)}
              >
                {fl === idDesc ? "✓ Copiado" : "📋 Copiar descripción"}
              </button>
              <button
                className={`cabysDrawerActionBtn cabysDrawerActionBtnPrimary${fl === idBoth ? " cabysDrawerActionBtnOk" : ""}`}
                type="button"
                onClick={() => flash(idBoth, `${item.codigo} — ${item.descripcion}`)}
              >
                {fl === idBoth ? "✓ Copiado" : "📋 Copiar ambos"}
              </button>
              <button
                className={`cabysDrawerActionBtn${isFav ? " cabysDrawerActionBtnFav" : ""}`}
                type="button"
                onClick={() => onToggleFav(item)}
              >
                {isFav ? "★ En favoritos" : "☆ Guardar favorito"}
              </button>
            </div>
          </div>

          {related.length > 0 && (
            <div className="cabysDrawerSection">
              <div className="cabysDrawerSectionLabel">También podrían interesarte</div>
              <div className="cabysDrawerRelated">
                {related.map(r => (
                  <button
                    key={r.codigo}
                    className="cabysDrawerRelatedItem"
                    type="button"
                    onClick={() => onSelectRelated(r)}
                  >
                    <span className="cabysDrawerRelatedCode">{r.codigo}</span>
                    <span className="cabysDrawerRelatedDesc">{r.descripcion}</span>
                    <span className={`taxBadgeV2 ${taxClass(r.impuesto)}`} style={{ flexShrink: 0, fontSize: 10 }}>{r.impuesto}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* unused prop warning suppressor */}
        {IC.x && null}
      </div>
    </>
  )
}
