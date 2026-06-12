/* ─────────────────────────────────────────────
   ICONS — SVG icon library
───────────────────────────────────────────── */

export const IC = {
  dashboard:    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="6" height="6" rx="1.5"/><rect x="10" y="2" width="6" height="6" rx="1.5"/><rect x="2" y="10" width="6" height="6" rx="1.5"/><rect x="10" y="10" width="6" height="6" rx="1.5"/></svg>,
  search:       <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="5.5"/><path d="m13 13 3.5 3.5"/></svg>,
  user:         <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="6" r="3"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>,
  id:           <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="1.5" y="4.5" width="15" height="10" rx="1.5"/><circle cx="6" cy="9.5" r="1.8"/><path d="M10 7.5h5M10 11h4"/></svg>,
  currency:     <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="9" r="7.5"/><path d="M9 5v8M6.5 7c0-1.1.9-2 2.5-2s2.5.9 2.5 2-2 1.7-2.5 1.7S6.5 9.9 6.5 11s1.1 2 2.5 2 2.5-.9 2.5-2"/></svg>,
  receipt:      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h12v15l-2.5-2-2.5 2-2.5-2L5 17V2"/><path d="M7 6.5h4M7 9.5h4M7 12.5h2"/></svg>,
  chevronLeft:  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m9 3-4 4 4 4"/></svg>,
  chevronRight: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m5 3 4 4-4 4"/></svg>,
  refresh:      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 7A5 5 0 1 1 9.5 2.5L12 2"/><path d="M12 2v3.5H8.5"/></svg>,
  warning:      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7.5 2L14 13H1L7.5 2z"/><path d="M7.5 6v3.5"/><circle cx="7.5" cy="11" r=".6" fill="currentColor" stroke="none"/></svg>,
  empty:        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="9" r="7.5"/><path d="M6 9h6M9 6v6"/></svg>,
  bolt:         <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 1L3 9.5h5L5.5 15 13 6.5H8L9.5 1z"/></svg>,
  collapseLeft: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 3 5 7l4 4M1 7h4"/></svg>,
  expandRight:  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 3l4 4-4 4M9 7H5"/></svg>,
  sortUp:       <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 2l4 6H1z"/></svg>,
  sortDown:     <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 8l4-6H1z"/></svg>,
  sortBoth:     <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" opacity=".3"><path d="M5 1l4 5H1zM5 11l4-5H1z"/></svg>,
  clock:        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3l2 1.5"/></svg>,
  table:        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="12" height="12" rx="1"/><path d="M1 5h12M5 5v8"/></svg>,
  grid:         <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/><rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/></svg>,
  external:     <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1h4v4M11 1 6 6"/><path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8"/></svg>,
  shield:       <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2L3 5v5c0 3.3 2.5 6.4 6 7.3 3.5-.9 6-4 6-7.3V5L9 2z"/><path d="M6.5 9l2 2 3-3.5"/></svg>,
  star:         <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 1l1.8 3.6L13 5.4l-3 2.9.7 4.1L7 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z"/></svg>,
  starOff:      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7 1l1.8 3.6L13 5.4l-3 2.9.7 4.1L7 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z"/></svg>,
  cmd:          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 1a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4H3zM3 7a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4H3z"/><path d="M3 5v2M9 5v2"/></svg>,
  info:         <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="9" r="7.5"/><path d="M9 8.5v4.5"/><circle cx="9" cy="6" r=".7" fill="currentColor" stroke="none"/></svg>,
  arrowRight:   <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m5 2 5 4-5 4M2 6h8"/></svg>,
  x:            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m3 3 8 8M11 3 3 11"/></svg>,
  bot:          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="12" height="9" rx="2"/><path d="M6 7V5a3 3 0 016 0v2M6 11.5h.01M12 11.5h.01M1 11h2M15 11h2M9 2v2"/></svg>,
  send:         <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2L2 7.5l5 1.5L9 14l5-12z"/></svg>,
  upload:       <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M8 10V3M5 6l3-3 3 3"/><path d="M3 13h10"/></svg>,
  chat:         <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h14a1 1 0 011 1v9a1 1 0 01-1 1H5l-3 2V4a1 1 0 011-1z"/></svg>,
  xml:          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l-3 3 3 3M14 6l3 3-3 3M11 3L7 15"/></svg>,
}

export const ACT_ICONS  = { cabys: IC.search, contribuyente: IC.user, factura: IC.receipt, tipocambio: IC.currency, exoneraciones: IC.shield }
export const ACT_LABELS = { cabys: "CABYS", contribuyente: "Contribuyente", factura: "Factura", tipocambio: "Tipo de Cambio", exoneraciones: "Exoneraciones" }
