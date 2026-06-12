import { useState } from "react"
import { IC } from "../constants/icons.jsx"
import { taxClass } from "../utils/formatters.js"
import { cabysEsServicio, getCabysHierarchy } from "../utils/cabysHelpers.js"

export function CabysCard({ item, score: _score, fl, flash, favs, onToggleFav, onSelect }) {
  const [catExp, setCatExp] = useState(false)
  const isFav = favs?.some(f => f.codigo === item.codigo)
  const idCode = `cc-${item.codigo}`, idDesc = `cd-${item.codigo}`, idBoth = `cb-${item.codigo}`
  const esSvc = cabysEsServicio(item.codigo)

  const allCats = (item.categorias?.length ? item.categorias : getCabysHierarchy(item.codigo))
    .filter((v, i, a) => a.indexOf(v) === i)
  const MAX_CATS = 3
  const visibleCats = catExp ? allCats : allCats.slice(-MAX_CATS)
  const hasMore = allCats.length > MAX_CATS

  const handleCardClick = (e) => {
    if (e.target.closest("button")) return
    onSelect?.(item)
  }

  return (
    <div
      className={`cabysCard${isFav ? " cabysCardFav" : ""}${onSelect ? " cabysCardSelectable" : ""}`}
      onClick={handleCardClick}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(item) } } : undefined}
    >
      <div className="cabysCardHead">
        <span className="cabysCardCode">{item.codigo}</span>
        <button className={`favBtn${isFav ? " favBtnOn" : ""}`} type="button"
          title={isFav ? "Quitar favorito" : "Guardar favorito"}
          onClick={() => onToggleFav(item)}>
          {isFav ? IC.star : IC.starOff}
        </button>
      </div>

      <div className="cabysCardName">{item.descripcion}</div>

      {allCats.length > 0 && (
        <div className="cabysCardCatWrap">
          {visibleCats.map((label, i) => (
            <div key={i} className="cabysCardCatRow">
              <span className="cabysCardCatDot" />
              <span className="cabysCardCatChip">{label}</span>
            </div>
          ))}
          {hasMore && (
            <button className="cabysCardCatToggle" type="button" onClick={() => setCatExp(e => !e)}>
              {catExp ? "Ver menos" : `+${allCats.length - MAX_CATS} más`}
            </button>
          )}
        </div>
      )}

      <div className="cabysCardFoot">
        <div className="cabysCardBadges">
          <span className={`taxBadgeV2 ${taxClass(item.impuesto)}`}>{item.impuesto}% IVA</span>
          <span className={`cabysTypeBadge${esSvc ? " cabysTypeSvc" : " cabysTypeArt"}`}>
            {esSvc ? "Servicio" : "Artículo"}
          </span>
        </div>
        <div className="cabysCardActions">
          <button className={`cabysActBtn${fl === idCode ? " cabysActBtnDone" : ""}`} type="button"
            title="Copiar código" onClick={() => flash(idCode, String(item.codigo))}>
            {fl === idCode ? "✓" : "#"}
          </button>
          <button className={`cabysActBtn${fl === idDesc ? " cabysActBtnDone" : ""}`} type="button"
            title="Copiar descripción" onClick={() => flash(idDesc, item.descripcion)}>
            {fl === idDesc ? "✓" : "T"}
          </button>
          <button className={`cabysActBtn cabysActBtnPrimary${fl === idBoth ? " cabysActBtnDone" : ""}`} type="button"
            title="Copiar código y descripción"
            onClick={() => flash(idBoth, `${item.codigo} — ${item.descripcion}`)}>
            {fl === idBoth ? "✓ Copiado" : "Copiar ambos"}
          </button>
        </div>
      </div>
    </div>
  )
}
