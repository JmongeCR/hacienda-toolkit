export function CopyBtn({ id, label, getText, disabled, fl, flash }) {
  const active = fl === id
  return (
    <button className={`btn btnGhost${active ? " btnFlashed" : ""}`} onClick={() => flash(id, getText)}
      disabled={disabled || active} type="button">
      {active ? "✓ Copiado" : label}
    </button>
  )
}
