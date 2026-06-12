import { useState } from "react"
import { loadClients, saveClients } from "../constants/storage.js"

export function ClientesPage({ navigateToCabys }) {
  const [clients,  setClients]  = useState(() => loadClients())
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form,     setForm]     = useState({ nombre: "", identificacion: "", notas: "" })

  const persist = (list) => { setClients(list); saveClients(list) }

  const openNew = () => {
    setForm({ nombre: "", identificacion: "", notas: "" })
    setEditMode(false); setShowForm(true)
  }

  const openEdit = (c) => {
    setForm({ nombre: c.nombre, identificacion: c.identificacion, notas: c.notas || "" })
    setEditMode(true); setShowForm(true)
  }

  const saveForm = () => {
    if (!form.nombre.trim()) return
    if (editMode) {
      persist(clients.map(c => c.id === selected ? { ...c, ...form } : c))
    } else {
      const nuevo = { id: Date.now().toString(), ...form, favsCabys: [], historial: [], createdAt: new Date().toISOString() }
      const next = [...clients, nuevo]
      persist(next); setSelected(nuevo.id)
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

  const client = clients.find(c => c.id === selected)

  // Vista detalle
  if (selected && client) {
    return (
      <div className="pageWrap pageCentered clienteFichaWrap">
        <button className="clienteFichaBack" type="button" onClick={() => setSelected(null)}>
          ← Volver a Clientes
        </button>

        <div className="clienteFichaCard">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div className="clienteFichaName">{client.nombre}</div>
              {client.identificacion && <div className="clienteFichaId">{client.identificacion}</div>}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button type="button" className="btn btnGhost btnSm" onClick={() => openEdit(client)}>Editar</button>
              <button type="button" className="btn btnGhost btnSm" style={{ color:"#dc2626" }}
                onClick={() => deleteClient(client.id)}>Eliminar</button>
            </div>
          </div>

          {client.notas && (
            <div className="clienteFichaSection">
              <div className="clienteFichaSectionTitle">Notas</div>
              <div className="clienteFichaNotas">{client.notas}</div>
            </div>
          )}

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
                Sin favoritos aún. Podés guardar CABYS desde la búsqueda y asignarlos aquí.
              </div>
            )}
          </div>

          <div className="clienteFichaSection">
            <div className="clienteFichaSectionTitle">Historial de consultas ({client.historial?.length || 0})</div>
            {client.historial?.length > 0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {client.historial.map((h, i) => (
                  <div key={i} className="clienteFichaHistRow">
                    <span>{h}</span>
                    <button type="button" style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:11, padding:0 }}
                      onClick={() => navigateToCabys(h)}>Buscar →</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="clienteFichaEmpty">Sin consultas registradas.</div>
            )}
          </div>
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

  // Vista lista
  return (
    <div className="pageWrap pageCentered clientesWrap">
      <div className="clientesHeader">
        <div className="clientesHeaderTitle">Clientes</div>
        <button type="button" className="btn btnPrimary" onClick={openNew}>+ Nuevo cliente</button>
      </div>

      {clients.length === 0 ? (
        <div className="clienteEmpty">
          <div className="clienteEmptyIcon">🏢</div>
          <div className="clienteEmptyTitle">Sin clientes aún</div>
          <div className="clienteEmptyDesc">Creá tu primer cliente para organizar favoritos CABYS, historial y notas por empresa.</div>
          <button type="button" className="btn btnPrimary" style={{ marginTop:16 }} onClick={openNew}>Crear primer cliente</button>
        </div>
      ) : (
        <div className="clientesGrid">
          {clients.map(c => (
            <div key={c.id} className="clienteCard" onClick={() => setSelected(c.id)}>
              <div className="clienteCardName">{c.nombre}</div>
              {c.identificacion && <div className="clienteCardId">{c.identificacion}</div>}
              <div className="clienteCardMeta">
                {(c.favsCabys?.length > 0) && <span className="clienteCardChip">⭐ {c.favsCabys.length} CABYS</span>}
                {(c.historial?.length > 0) && <span className="clienteCardChip">🕒 {c.historial.length} búsquedas</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="clienteModal" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="clienteModalCard">
            <div className="clienteModalTitle">Nuevo cliente</div>
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
