import { IC } from "../constants/icons.jsx"

export function SortableTH({ col, sort, onSort, children, right }) {
  const active = sort.col === col
  return (
    <th className={`thSortable${right ? " thR" : ""}`} onClick={() => onSort(col)}>
      {children}
      <span className={`sortArrow${active ? " sortActive" : ""}`}>
        {active ? (sort.dir === "asc" ? IC.sortUp : IC.sortDown) : IC.sortBoth}
      </span>
    </th>
  )
}
