export function PageHeader({ icon, title, description, onClear }) {
  return (
    <div className="pageHeader">
      <div className="pageHeaderTop">
        <div className="pageHeaderIcon">{icon}</div>
        <h1 className="pageTitle">{title}</h1>
      </div>
      {description && <p className="pageDesc">{description}</p>}
      {onClear && (
        <button type="button" className="clearResultsBtn" onClick={onClear}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Nueva consulta
        </button>
      )}
    </div>
  )
}
