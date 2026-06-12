import { IC } from "../constants/icons.jsx"

export function EmptyState({ msg }) {
  return (
    <div className="emptyState">
      <div className="emptyIconBox">{IC.empty}</div>
      <span className="emptyText">{msg}</span>
    </div>
  )
}
