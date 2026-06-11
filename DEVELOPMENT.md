# HaciendaKit — Guía de desarrollo

## Resumen del proyecto

HaciendaKit es una SPA de herramientas tributarias para Costa Rica. Consume APIs públicas de Hacienda, TSE, GoMeta y BCCR. No tiene backend propio: las llamadas a APIs externas se proxean a través de Vercel Rewrites para evitar CORS.

**Stack:** React 19 + Vite 7 · Sin TypeScript · Sin router externo · Sin estado global (todo en `useState` local o `localStorage`)

**Deploy:** Vercel — `main` → producción automática en `hacienda-toolkit.vercel.app`

**Arquitectura:** archivo único `src/App.jsx` (~3530 líneas) + `src/App.css` (~2000 líneas). No hay componentes en archivos separados.

---

## Estructura de archivos

```
src/
  App.jsx          # Todo el código (helpers, componentes, páginas, lógica)
  App.css          # Todos los estilos
  main.jsx         # Entry point React
docs/
  funcionalidades/ # Documentación por módulo
  reglas-negocio/  # Reglas implementadas en código
  roadmap/         # Decisiones y pendientes
  auditorias/      # Registros de auditorías de código
vercel.json        # Proxy rewrites (NO modificar sin análisis de impacto)
```

---

## Proxies configurados (vercel.json)

| Ruta local | Destino real |
|------------|-------------|
| `/hacienda/*` | `https://api.hacienda.go.cr/*` |
| `/gometa/*` | `https://apis.gometa.org/*` |
| `/bccr/*` | `https://gee.bccr.fi.cr/*` |

**Regla crítica:** nunca llamar directamente a estas URLs desde el browser. Siempre usar los paths `/hacienda/`, `/gometa/`, `/bccr/`.

---

## Módulos y páginas

| ID de página | Componente / sección | Estado |
|---|---|---|
| `home` | Inline en App | ✅ Activo |
| `cabys` | Inline en App | ✅ Activo |
| `contribuyente` | `FichaContribuyente` | ✅ Activo |
| `cedulas` | Inline en App | ✅ Activo |
| `tipocambio` | `ConversorWise` + `TcSparkline` | ✅ Activo |
| `factura` | `XmlFacturaResult` + validación CABYS | ✅ Activo |
| `exoneraciones` | Inline en App | ✅ Activo |
| `calculadora` | `IvaCalculadoraPage` | ✅ Activo |
| `clientes` | `ClientesPage` | ✅ Activo (solo localStorage) |
| `asistente` | `TaxAssistantPage` | ✅ Activo (KB local, sin IA externa) |
| `acerca` | `AcercaPage` | ✅ Activo |

---

## Funcionalidades principales

### Asistente CABYS
- Búsqueda por texto libre contra `api.hacienda.go.cr/fe/cabys`
- Modo "Mi actividad económica": extrae términos clave del texto y busca
- Drawer lateral al clic en tarjeta (componente `CabysDrawer`)
- Favoritos persistidos en `localStorage` (clave `hk_favs`, máx 30)
- Vista cards / tabla con ordenamiento
- Exportación CSV y XLSX

### Visor XML Factura Electrónica
- Parser propio con `DOMParser` — sin librerías XML
- Soporta FE v4.4 (schema actual Hacienda)
- Tipos: FacturaElectronica, TiqueteElectronico, NotaDebito, NotaCredito, FECompra, FEExportacion
- Validación CABYS: consulta `api.hacienda.go.cr/fe/cabys?codigo=X` por cada código único
- Validación IVA: compara `ivaPct` del XML vs `impuesto` de la API
- Columna "Validaciones" con estado por línea
- Aviso "Verificar tipo" (ámbar) cuando unidad XML no coincide con clasificación CABYS

### Verificar Contribuyente
- Consulta `api.hacienda.go.cr/fe/ae?identificacion=X`
- Acepta: cédula física (9 dígitos), jurídica (10 dígitos), DIMEX (11-12 dígitos), NITE (10 dígitos)
- 404 → empty state neutro (no error rojo)

### Tipo de Cambio
- USD desde BCCR (`gee.bccr.fi.cr`)
- EUR desde Hacienda
- Conversor multi-moneda (CRC/USD/EUR)
- Sparkline de 30 días

### Asistente Tributario
- Base de conocimientos local (`TAX_KB` array), sin llamadas a IA externa
- 12 temas cubiertos: IVA, regímenes, renta, exoneraciones, por sector

---

## Funciones globales críticas

```js
cabysEsServicio(codigo)   // primer dígito 8 o 9 → servicio; resto → artículo
isValidAeId(s)            // acepta 9–12 dígitos (cédula física/jurídica/DIMEX/NITE)
taxClass(impuesto)        // retorna clase CSS según tasa IVA (t0,t1,t2,t4,t8,t13,t15)
parseXmlFe(xmlStr)        // parser XML completo → objeto estructurado
restoreAccents(query)     // normaliza búsqueda sin tildes → con tildes (ACCENT_MAP)
extractAeTerms(desc)      // extrae 5 palabras clave de descripción de AE
```

---

## Variables de estado importantes (App principal)

```js
selectedCabys      // null | item — controla apertura del drawer CABYS
cabysValidation    // { [codigo]: { status, impuesto } } — resultados de validación XML
soloInconsistencias // boolean — filtro de filas en visor XML
```

---

## Reglas críticas de desarrollo

1. **No separar en archivos** mientras el proyecto sea de un solo dev / sin build system de módulos. Todo vive en `App.jsx`.
2. **No modificar `vercel.json`** sin revisar impacto en todas las llamadas a API.
3. **No agregar dependencias npm** sin justificación. El único paquete de runtime es `xlsx`.
4. **No activar validación Artículo/Servicio como error** — auditado en junio 2025, genera falsos positivos. Solo como aviso informativo.
5. **No usar `var(--card)`** — esa variable CSS no está definida. Usar `var(--surface)`.
6. **`CopyIco` es un componente global** (definido antes de `CabysCard`). No redefinirlo localmente.
7. **Constantes de unidades de servicio XML** están duplicadas (`XML_SVC_UNITS` / `BANNER_SVC_UNITS`). Pendiente unificar en constante global.

---

## Convenciones de desarrollo

- **Nombrado de páginas:** `page === "id"` — el estado de navegación es un string
- **Clases CSS:** kebab-case con prefijo de módulo (`xmlCabysVal*`, `cabysDrawer*`, `tcChip*`)
- **Variables CSS:** en `:root` de `App.css`. Paleta: `--slate-*`, `--blue-*`, `--green-*`, `--amber-*`
- **Íconos:** SVG inline en objeto `IC` al inicio de `App.jsx`
- **localStorage keys:** prefijo `hk_` (`hk_favs`, `hk_clients`, `hk_activity`, `hk_home_favs`)
- **Flash de copia:** hook `useCopyFlash()` → `{ fl, flash }`. `fl` es el id del último botón activo.
- **Fechas:** formato Costa Rica con `formatFechaCR()` (locale `es-CR`)
- **Montos:** `Intl.NumberFormat("en-US")` con símbolo según moneda (₡/$/€)

---

## Deuda técnica conocida

| Ítem | Descripción | Riesgo |
|------|-------------|--------|
| `XML_SVC_UNITS` duplicado | Definida dos veces en `XmlFacturaResult` con nombres distintos | Bajo — inconsistencia de mantenimiento |
| `soloInconsistencias` no se resetea | Al cargar un nuevo XML el filtro puede quedar activo | Bajo — UX confusa |
| Archivo monolítico | `App.jsx` ~3530 líneas, difícil navegar | Medio |
| `TAX_KB` hardcodeado | El asistente tributario no aprende ni se actualiza | Medio |
| Sin tests | Ninguna cobertura automatizada | Alto a largo plazo |

---

> Fuente de verdad: código fuente. Mantener sincronizado con App.jsx.
