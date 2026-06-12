/* ─────────────────────────────────────────────
   STORAGE — claves localStorage + helpers
───────────────────────────────────────────── */

/** Máximo de entradas de historial por clave */
const H = 5

/** Carga historial de una clave localStorage */
export const loadH = (key) => { try { return JSON.parse(localStorage.getItem(key) || "[]") } catch { return [] } }

/** Guarda una entrada en el historial (deduplicado, máx H) */
export const saveH = (key, value) => {
  if (!value?.trim()) return
  const prev = loadH(key)
  localStorage.setItem(key, JSON.stringify([value, ...prev.filter(x => x !== value)].slice(0, H)))
}

/* ─── Favoritos CABYS ─── */
export const FAV_KEY = "hk_favs"
export const loadFavs  = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]") } catch { return [] } }
export const saveFavs  = (items) => localStorage.setItem(FAV_KEY, JSON.stringify(items.slice(0, 30)))

/* ─── Favoritos Home ─── */
export const HOME_FAVS_KEY = "hk_home_favs"
export const HOME_FAVS_DEFAULT = [
  { id: "dev-sw",   label: "Desarrollo software",     type: "cabys", query: "desarrollo software programacion" },
  { id: "srv-prof", label: "Servicios profesionales",  type: "cabys", query: "servicios profesionales consultoria" },
  { id: "rest",     label: "Restaurante / Soda",       type: "cabys", query: "restaurante soda comidas alimentacion" },
]
export const loadHomeFavs  = () => { try { const s = JSON.parse(localStorage.getItem(HOME_FAVS_KEY)); return s?.length ? s : HOME_FAVS_DEFAULT } catch { return HOME_FAVS_DEFAULT } }
export const saveHomeFavs  = (f) => localStorage.setItem(HOME_FAVS_KEY, JSON.stringify(f))

/* ─── Activity log ─── */
export const ACT_KEY  = "hk_activity"
export const loadActs = () => { try { return JSON.parse(localStorage.getItem(ACT_KEY) || "[]") } catch { return [] } }
export const appendAct = (type, q) => {
  const acts = loadActs()
  acts.unshift({ type, q, ts: new Date().toISOString() })
  localStorage.setItem(ACT_KEY, JSON.stringify(acts.slice(0, 30)))
}

/* ─── Clientes ─── */
export const LS_CLIENTS = "hk_clients"
export const loadClients = () => { try { return JSON.parse(localStorage.getItem(LS_CLIENTS) || "[]") } catch { return [] } }
export const saveClients = (list) => { try { localStorage.setItem(LS_CLIENTS, JSON.stringify(list)) } catch (_e) { /* silencioso */ } }
