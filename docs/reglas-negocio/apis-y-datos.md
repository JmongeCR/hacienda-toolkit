# Reglas de negocio: APIs y manejo de datos

---

## Arquitectura de llamadas a API

**Regla:** nunca llamar directamente a las URLs de Hacienda/BCCR desde el browser. Siempre usar los proxies de Vercel.

| Servicio | URL directa (no usar) | Proxy Vercel (usar) |
|----------|----------------------|---------------------|
| Hacienda | `https://api.hacienda.go.cr/...` | `/hacienda/...` |
| BCCR | `https://gee.bccr.fi.cr/...` | `/bccr/...` |

**Motivo:** CORS. Las APIs externas no permiten requests directos desde browsers.

**Dependencias externas permitidas únicamente:** `api.hacienda.go.cr` y `gee.bccr.fi.cr`.

---

## Endpoints utilizados

### Hacienda (`/hacienda/`)

```
GET /hacienda/fe/cabys?q={texto}&top={n}
→ Buscar CABYS por texto
→ Retorna Array<{ codigo, descripcion, impuesto, categorias[] }>

GET /hacienda/fe/cabys?codigo={codigo}
→ Obtener CABYS por código exacto
→ Retorna Array<{ codigo, descripcion, impuesto, categorias[] }>

GET /hacienda/fe/ae?identificacion={numero}
→ Consultar contribuyente
→ Retorna objeto contribuyente | 404

GET /hacienda/fe/FacturaElectronica?clave={50digitos}
→ Verificar factura por clave
→ Retorna estado de aceptación

GET /hacienda/fe/exoneraciones?tipo={01-04}&numDocumento={numero}
→ Consultar exoneraciones
→ Retorna Array<exoneracion>
```

### BCCR (`/bccr/`)

```
GET /bccr/...
→ Tipo de cambio USD (compra/venta)
→ Historial de tipo de cambio
```

---

## Manejo de errores de API

### Regla general
- HTTP 4xx con JSON → parsear mensaje del JSON
- HTTP 404 específico → empty state neutro (NO error rojo)
- HTTP 5xx → AlertBox rojo con "Error del servidor"
- Timeout / red → AlertBox rojo con mensaje genérico

### Función `fetchJsonSafe(url)`
Valida que la respuesta sea JSON antes de parsear. Lanza error si:
- `res.ok === false` (HTTP error)
- `content-type` no incluye `application/json`
- El body no es JSON válido

### Estado 404 en Contribuyente
Manejo especial: HTTP 404 O body con `{ code: 404 }` O body con "not available" → `setAeData(null)` sin lanzar error. Se muestra `EmptyState` neutro.

---

## Caché de API

Todas las llamadas usan `{ cache: "no-store" }` para evitar respuestas desactualizadas. No hay caché local de respuestas de API (excepto el estado React durante la sesión).

---

## Validación CABYS en XML: deduplicación

```js
const codigos = [...new Set(feXmlData.lines.map(l => l.cabys).filter(Boolean))]
Promise.all(codigos.map(async codigo => { ... }))
```

Un XML con 20 líneas que usen el mismo código CABYS hace **una sola** consulta a la API, no 20.

---

## Persistencia en localStorage

| Clave | Contenido | Límite |
|-------|-----------|--------|
| `hk_favs` | Favoritos CABYS | 30 ítems |
| `hk_clients` | Lista de clientes | Sin límite definido |
| `hk_activity` | Log de actividad reciente | 30 entradas |
| `hk_home_favs` | Chips favoritos del Home | Sin límite definido |
| `hk_h_*` | Historiales por módulo | 5 por módulo |

**Nota:** `hk_clients` guarda objetos anidados incluyendo `favsCabys[]` e `historial[]` por cliente. No hay migración de schema si la estructura cambia.

---

## Schema XML FE v4.4 (Hacienda)

Diferencia clave de v4.3 a v4.4:

```xml
<!-- v4.4 -->
<CodigoTipoMoneda>
  <CodigoMoneda>USD</CodigoMoneda>
  <TipoCambio>530.00</TipoCambio>
</CodigoTipoMoneda>

<!-- v4.3 y anteriores (fallback soportado) -->
<CodigoTipoMoneda>
  <Codigo>USD</Codigo>
</CodigoTipoMoneda>
```

El parser maneja ambos con fallback:
```js
get("CodigoTipoMoneda > CodigoMoneda") || get("CodigoTipoMoneda > Codigo") || get("CodigoMoneda")
```
