# Componentes UI reutilizables

---

## Componentes globales

### `CopyIco`
Ícono SVG de copiar al portapapeles. Componente global.  
**Importante:** definido antes de `CabysCard`. No redefinir localmente.

### `Skeleton`
Placeholder de carga animado.  
Props: `h` (alto px), `w` (ancho), `rounded` (boolean)

### `ChipStatus`
Chip con color según valor ("SI"→rojo, "NO"→verde, "INSCRITO"→verde).  
Usado en `FichaContribuyente` para mostrar estado fiscal.

### `CopyBtn`
Botón genérico de copia con flash de confirmación.  
Usa hook `useCopyFlash`.

### `EmptyState`
Estado vacío con ícono y texto. Muestra `IC.empty` + mensaje.

### `PageHeader`
Encabezado de página con ícono, título, descripción y botón "Nueva consulta".

### `SortableTH`
Encabezado de tabla ordenable con íconos de dirección.

---

## Hook `useCopyFlash()`

```js
const { fl, flash } = useCopyFlash()
// fl: string | null — id del último botón activo
// flash(id, textOrFn): copia texto y activa estado por 1500ms
```

Cualquier botón de copia en la app usa este hook. El `id` debe ser único por instancia de componente.

---

## Componente `CabysCard`

Props: `{ item, score, fl, flash, favs, onToggleFav, onSelect }`

- `onSelect`: callback al hacer clic en el cuerpo de la tarjeta (abre drawer)
- Si `onSelect` está definido, la tarjeta recibe clase `cabysCardSelectable` y cursor pointer
- Clic en cualquier botón interno NO dispara `onSelect` (detectado con `e.target.closest("button")`)

---

## Componente `CabysDrawer`

Props: `{ item, relatedItems, fl, flash, favs, onToggleFav, onClose, onSelectRelated }`

- Diseñado para ser **reutilizable** desde cualquier módulo
- `item = null` → drawer no se monta (sin DOM)
- `relatedItems = []` → acepta array vacío (caso XML donde no hay contexto de búsqueda)
- Cierra con: ESC, clic en overlay, botón ✕
- Bloquea scroll del body mientras está abierto (restaurado en cleanup)

---

## Componente `CommandPalette`

Paleta de comandos accesible con `Cmd+K` / `Ctrl+K`.  
Busca en actividades recientes y módulos disponibles.

---

## Componente `FichaContribuyente`

Props: `{ data, aeJsonId, onBuscarCabys, fl, flash, aeResumen, aeActCsv, downloadActs }`

Muestra el resultado completo de un contribuyente.  
Botón "Buscar CABYS" por actividad económica → navega y ejecuta búsqueda.

---

## Sistema de iconos `IC`

Object con SVGs inline. Iconos disponibles:

```
dashboard, search, user, id, currency, receipt
chevronLeft, chevronRight, refresh, warning, empty
bolt, collapseLeft, expandRight, sortUp, sortDown, sortBoth
clock, table, grid, external, shield, star, starOff
cmd, info, arrowRight, x, bot, send, upload, chat, xml
```

---

## Sistema de colores CSS

### Tokens semánticos disponibles (en `:root`)
```css
--bg, --surface, --surface2
--border, --border2
--text, --text2, --muted
--accent, --accent-h
--good, --bad, --warn
```

### Paleta base disponible
```css
--slate-50 a --slate-900
--blue-50, --blue-100, --blue-500, --blue-600, --blue-700
--green-50, --green-100, --green-600
--amber-50, --amber-100, --amber-600
--red-50, --red-100, --red-600
--violet-50, --violet-100, --violet-600
```

### Variable NO definida
`--card` → **no usar**. Ver auditoría de junio 2025.

---

## Convenciones de clases CSS por módulo

| Prefijo | Módulo |
|---------|--------|
| `cabys*` | CABYS search cards |
| `cabysDrawer*` | Drawer lateral CABYS |
| `xml*` | Visor XML |
| `xmlCabys*` | Validación CABYS en XML |
| `tc*` | Tipo de cambio |
| `fe*` | Factura electrónica (tab clave) |
| `exo*` | Exoneraciones |
| `calc*` | Calculadora IVA |
| `cliente*` | Módulo clientes |
| `home*` | Página home |
