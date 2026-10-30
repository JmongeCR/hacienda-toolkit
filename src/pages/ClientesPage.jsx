import { useState } from "react"
import { downloadXlsx } from "../utils/exportHelpers.js"
import { formatFechaCR } from "../utils/formatters.js"

const fmtM = (v, mon = "CRC") => {
  const n = parseFloat(v)
  if (isNaN(n)) return v || "—"
  const sym = mon === "USD" ? "$" : mon === "EUR" ? "€" : "₡"
  return sym + n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ClientesPage({ navigateToCabys, navigateToContribuyente, navigate, clients, onUpdateClients, lastXmlData }) {
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form,     setForm]     = useState({ nombre: "", identificacion: "", notas: "" })
  const [search,   setSearch]   = useState("")

  const persist = onUpdateClients

  const openNew = () => {
    setForm({ nombre: "", identificacion: "", notas: "" })
    setEditMode(false); setShowForm(true)
  }

  const openEdit = (c) => {
    setForm({ nombre: c.nombre, identificacion: c.identificacion, notas: c.notas || "" })
    setEditMode(true); setShowForm(true)
  }

  const importFromXml = () => {
    if (!lastXmlData) return
    const e = lastXmlData.emisor
    setForm(f => ({
      ...f,
      nombre: e.nombre || f.nombre,
      identificacion: e.cedula || f.identificacion,
    }))
  }

  const saveForm = () => {
    if (!form.nombre.trim()) return
    if (editMode) {
      persist(clients.map(c => c.id === selected ? { ...c, ...form } : c))
    } else {
      const nuevo = { id: Date.now().toString(), ...form, favsCabys: [], facturas: [], historial: [], createdAt: new Date().toISOString() }
      persist([...clients, nuevo]); setSelected(nuevo.id)
    }
    setShowForm(false)
  }

  const deleteClient = (id) => {
    if (!confirm("¿Eliminar este cliente?")) return
    persist(clients.filter(c => c.id !== id)); setSelected(null)
  }

  const removeFavFromClient = (clientId, codigo) => {
    persist(clients.map(c => c.id !== clientId ? c : { ...c, favsCabys: c.favsCabys.filter(f => f.codigo !== codigo) }))
  }

  const removeFactura = (clientId, clave) => {
    persist(clients.map(c => c.id !== clientId ? c : { ...c, facturas: (c.facturas || []).filter(f => f.clave !== clave) }))
  }

  const exportarHistorial = (c) => {
    if (!c.facturas?.length) return
    downloadXlsx(`facturas_${c.nombre.replace(/\s+/g,"_")}.xlsx`, "Facturas",
      c.facturas.map(f => ({
        fecha: formatFechaCR(f.fecha),
        tipo: f.tipo,
        emisor: f.emisorNombre,
        receptor: f.receptorNombre,
        total: f.total,
        moneda: f.moneda || "CRC",
        clave: f.clave,
      })),
      ["fecha","tipo","emisor","receptor","total","moneda","clave"])
  }

  const client = clients.find(c => c.id === selected)

  const filteredClients = search.trim()
    ? clients.filter(c =>
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (c.identificacion || "").includes(search))
    : clients

  // ── Resumen financiero ──
  const resumen = (c) => {
    const facturas = c.facturas || []
    if (!facturas.length) return null
    const total = facturas.reduce((s, f) => s + (parseFloat(f.total) || 0), 0)
    return { total, count: facturas.length, promedio: total / facturas.length }
  }

  // ── Vista detalle ──
  if (selected && client) {
    const r = resumen(client)
    return (
      <div className="pageWrap pageCentered clienteFichaWrap">
        <button className="clienteFichaBack" type="button" onClick={() => setSelected(null)}>
          ← Volver a Clientes
        </button>

        <div className="clienteFichaCard">
          {/* Encabezado */}
          <div className="clienteFichaHead">
            <div>
              <div className="clienteFichaName">{client.nombre}</div>
              {client.identificacion && <div className="clienteFichaId">{client.identificacion}</div>}
            </div>
            <div className="clienteFichaHeadActions">
              {client.identificacion && navigateToContribuyente && (
                <button type="button" className="btn btnGhost btnSm"
                  onClick={() => navigateToContribuyente(client.identificacion.replace(/\D/g,""))}>
                  Verificar contribuyente →
                </button>
              )}
              <button type="button" className="btn btnGhost btnSm" onClick={() => openEdit(client)}>Editar</button>
              <button type="button" className="btn btnGhost btnSm clienteBtnDanger"
                onClick={() => deleteClient(client.id)}>Eliminar</button>
            </div>
          </div>

          {client.notas && (
            <div className="clienteFichaSection">
              <div className="clienteFichaSectionTitle">Notas</div>
              <div className="clienteFichaNotas">{client.notas}</div>
            </div>
          )}

          {/* Resumen financiero */}
          {r && (
            <div className="clienteResumen">
              <div className="clienteResumenItem">
                <span className="clienteResumenLbl">Total facturado</span>
                <span className="clienteResumenVal mono">{fmtM(r.total)}</span>
              </div>
              <div className="clienteResumenItem">
                <span className="clienteResumenLbl">Comprobantes</span>
                <span className="clienteResumenVal">{r.count}</span>
              </div>
              <div className="clienteResumenItem">
                <span className="clienteResumenLbl">Promedio</span>
                <span className="clienteResumenVal mono">{fmtM(r.promedio)}</span>
              </div>
            </div>
          )}

          {/* Facturas guardadas */}
          <div className="clienteFichaSection">
            <div className="clienteFichaSectionHeader">
              <div className="clienteFichaSectionTitle">Facturas guardadas ({client.facturas?.length || 0})</div>
              {client.facturas?.length > 0 && (
                <button type="button" className="btn btnGhost btnSm" onClick={() => exportarHistorial(client)}>
                  Exportar Excel
                </button>
              )}
            </div>
            {client.facturas?.length > 0 ? (
              <div className="clienteFacturasWrap">
                <table className="clienteFacturasTable">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Emisor</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.facturas.map((f, i) => (
                      <tr key={i}>
                        <td className="clienteFactFecha">{formatFechaCR(f.fecha)}</td>
                        <td><span className="clienteFactTipo">{f.tipo}</span></td>
                        <td className="clienteFactEmisor">{f.emisorNombre || "—"}</td>
                        <td className="clienteFactTotal mono">{fmtM(f.total, f.moneda)}</td>
                        <td>
                          <button type="button" className="clienteFactDel" title="Quitar"
                            onClick={() => removeFactura(client.id, f.clave)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="clienteFichaEmpty">
                Sin facturas guardadas. Cargá un XML y usá el botón "Guardar en cliente".
              </div>
            )}
          </div>

          {/* Favoritos CABYS */}
          <div className="clienteFichaSection">
            <div className="clienteFichaSectionTitle">Favoritos CABYS ({client.favsCabys?.length || 0})</div>
            {client.favsCabys?.length > 0 ? (
              <div className="clienteFichaFavs">
                {client.favsCabys.map(f => (
                  <div key={f.codigo} className="clienteFichaFavRow">
                    <span className="clienteFichaFavCode">{f.codigo}</span>
                    <span className="clienteFichaFavDesc">{f.descripcion}</span>
                    <span style={{ fontSize:10, color:"var(--muted)", marginLeft:6 }}>{f.impuesto}%</span>
                    <button className="clienteFichaFavDel" type="button"
                      onClick={() => removeFavFromClient(client.id, f.codigo)} title="Quitar">✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="clienteFichaEmpty">
                Sin favoritos aún.
              </div>
            )}
          </div>

          {/* Historial de búsquedas */}
          {client.historial?.length > 0 && (
            <div className="clienteFichaSection">
              <div className="clienteFichaSectionTitle">Historial de consultas ({client.historial.length})</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {client.historial.map((h, i) => (
                  <div key={i} className="clienteFichaHistRow">
                    <span>{h}</span>
                    <button type="button" style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:11, padding:0 }}
                      onClick={() => navigateToCabys(h)}>Buscar →</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showForm && (
          <div className="clienteModal" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
            <div className="clienteModalCard">
              <div className="clienteModalTitle">Editar cliente</div>
              <div className="clienteFormRow">
                <label className="clienteFormLbl">Nombre</label>
                <input className="clienteFormInput" value={form.nombre} placeholder="Nombre del cliente"
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="clienteFormRow">
                <label className="clienteFormLbl">Identificación</label>
                <input className="clienteFormInput" value={form.identificacion} placeholder="Cédula, NITE, pasaporte…"
                  onChange={e => setForm(f => ({ ...f, identificacion: e.target.value }))} />
              </div>
              <div className="clienteFormRow">
                <label className="clienteFormLbl">Notas</label>
                <textarea className="clienteFormInput clienteFormTextarea" value={form.notas} placeholder="Actividad económica, régimen, observaciones…"
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
              <div className="clienteModalBtns">
                <button type="button" className="btn btnGhost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="button" className="btn btnPrimary" onClick={saveForm} disabled={!form.nombre.trim()}>Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Vista lista ──
  return (
    <div className="pageWrap pageCentered clientesWrap">
      <div className="clientesHeader">
        <div className="clientesHeaderTitle">Clientes</div>
        <button type="button" className="btn btnPrimary" onClick={openNew}>+ Nuevo cliente</button>
      </div>

      {clients.length > 0 && (
        <div className="clienteSearchWrap">
          <input
            className="clienteSearchInput"
            placeholder="Buscar por nombre o identificación…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button type="button" className="clienteSearchClear" onClick={() => setSearch("")}>✕</button>}
        </div>
      )}

      {clients.length === 0 ? (
        <div className="clienteEmpty">
          <div className="clienteEmptyIcon">🏢</div>
          <div className="clienteEmptyTitle">Sin clientes aún</div>
          <div className="clienteEmptyDesc">Creá tu primer cliente para organizar facturas, favoritos CABYS y notas por empresa.</div>
          <button type="button" className="btn btnPrimary" style={{ marginTop:16 }} onClick={openNew}>Crear primer cliente</button>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="clienteEmpty">
          <div className="clienteEmptyTitle">Sin resultados</div>
          <div className="clienteEmptyDesc">No hay clientes que coincidan con "{search}".</div>
        </div>
      ) : (
        <div className="clientesGrid">
          {filteredClients.map(c => {
            const r = resumen(c)
            return (
              <div key={c.id} className="clienteCard" onClick={() => setSelected(c.id)}>
                <div className="clienteCardName">{c.nombre}</div>
                {c.identificacion && <div className="clienteCardId">{c.identificacion}</div>}
                <div className="clienteCardMeta">
                  {(c.facturas?.length > 0) && <span className="clienteCardChip">📄 {c.facturas.length} fact.</span>}
                  {(c.favsCabys?.length > 0) && <span className="clienteCardChip">⭐ {c.favsCabys.length} CABYS</span>}
                </div>
                {r && <div className="clienteCardTotal">{fmtM(r.total)}</div>}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="clienteModal" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="clienteModalCard">
            <div className="clienteModalTitle">Nuevo cliente</div>
            {lastXmlData?.emisor?.nombre && (
              <button type="button" className="clienteImportBtn" onClick={importFromXml}>
                ↙ Importar datos del último XML ({lastXmlData.emisor.nombre})
              </button>
            )}
            <div className="clienteFormRow">
              <label className="clienteFormLbl">Nombre *</label>
              <input className="clienteFormInput" value={form.nombre} placeholder="Nombre del cliente o empresa"
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") saveForm() }} autoFocus />
            </div>
            <div className="clienteFormRow">
              <label className="clienteFormLbl">Identificación</label>
              <input className="clienteFormInput" value={form.identificacion} placeholder="Cédula, NITE, pasaporte…"
                onChange={e => setForm(f => ({ ...f, identificacion: e.target.value }))} />
            </div>
            <div className="clienteFormRow">
              <label className="clienteFormLbl">Notas</label>
              <textarea className="clienteFormInput clienteFormTextarea" value={form.notas} placeholder="Actividad económica, régimen, observaciones…"
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div className="clienteModalBtns">
              <button type="button" className="btn btnGhost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="button" className="btn btnPrimary" onClick={saveForm} disabled={!form.nombre.trim()}>Crear cliente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
