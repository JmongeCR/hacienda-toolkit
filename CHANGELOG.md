# Changelog

Todos los cambios relevantes de HaciendaKit están documentados en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

---

## [2.0.0] — 2026-06-11

### Removido
- **GoMeta / Personas y Empresas** — módulo de búsqueda en el registro TSE eliminado (dependencia externa no oficial)
- **Chat / Asistente IA** — módulo de chat tributario con base de conocimientos local (`TAX_KB`, `queryAssistant`) eliminado
- **Calculadora IVA** — módulo de cálculo offline eliminado (`IvaCalculadoraPage`)
- **Proxy GoMeta** — rewrite de Vercel y proxy de desarrollo eliminados de `vercel.json` y `vite.config.js`
- **CSS huérfano** — bloques `.chat*` y `.calc*` eliminados de `App.css` (−6.4 KB minificado)

### Mejorado
- **Identidad** — módulo principal renombrado de "Visor XML" a "Validador XML"
- **Navegación** — menú lateral reordenado por prioridad: Validador XML → CABYS → Contribuyente → Exoneraciones → Tipo de Cambio → Clientes
- **Grupos de menú** — nuevo grupo "Comprobantes" (Validador XML + CABYS), "Consultas" (Contribuyente + Exoneraciones), "Finanzas" (Tipo de Cambio), "Gestión" (Clientes)
- **Dashboard** — tarjetas del home reordenadas con Validador XML como primera tarjeta
- **Accesos rápidos** — sección del home actualizada con Validador XML primero
- **Hero principal** — texto actualizado: "Revisión de comprobantes XML" con subtítulo enfocado en validación
- **Tabla XML** — columna descripción más legible (`max-width: 380px`, `min-width: 160px`); código CABYS más grande (`font-size: 12px`)

### Arquitectura
- Dependencias externas reducidas únicamente a `api.hacienda.go.cr` y `gee.bccr.fi.cr`
- Codebase simplificado: ~3100 líneas en `App.jsx`, 72 KB en `App.css`
- `package.json` versión 2.0.0, descripción actualizada

---

## [1.1.0] — 2026-06-10

### Añadido
- **Validación Tributaria XML Profesional** — verificación en tiempo real de cada línea del XML contra el catálogo CABYS oficial de Hacienda. Columna "Validaciones" por fila con estado individual.
- **Validación de IVA por línea** — compara la tasa declarada en el XML contra la tasa oficial del código CABYS. Detecta y muestra discrepancias con tasa esperada vs. tasa en documento.
- **Resumen de validación** — banner compacto al tope del visor con conteo de líneas correctas, inconsistencias de IVA, avisos de tipo y códigos no encontrados.
- **Clasificación Artículo / Servicio** — badge informativo por línea indicando si el código CABYS corresponde a un artículo o servicio, según el catálogo oficial.
- **Aviso "Verificar tipo"** — indicador ámbar cuando la unidad de medida del XML no es consistente con la clasificación CABYS. Solo informativo, no bloquea (decisión D-010).
- **Filtro "Ver solo inconsistencias"** — toggle para mostrar únicamente líneas con discrepancias de IVA o avisos activos.
- **Drawer CABYS integrado en el Visor XML** — al hacer clic en un código CABYS validado dentro de la tabla del XML, se abre el drawer lateral con todos los detalles del código: descripción oficial, tasa IVA, ruta de categorías y acciones de copia.
- **Deduplicación de consultas CABYS** — XMLs con múltiples líneas del mismo código realizan una sola consulta a la API (via `Promise.all` + `new Set`).
- **Exportación a Excel desde Visor XML** — descarga `.xlsx` con todas las líneas de detalle del documento analizado.
- **Impresión optimizada** — vista de impresión (`@media print`) limpia, sin sidebar, sin botones de acción.
- **Soporte schema FE v4.4** — actualización del parser XML para el esquema vigente de Hacienda (`CodigoTipoMoneda > CodigoMoneda`), con fallback a v4.3.
- **Módulo Personas y Empresas** — búsqueda en el registro del TSE por cédula o nombre, renombrado desde "Cédulas TSE".
- **Módulo Exoneraciones** — consulta de exoneraciones activas por cédula y tipo de documento.
- **Drawer CABYS lateral** — panel deslizante con detalle completo al seleccionar una tarjeta en el buscador CABYS: descripción oficial, tasa IVA, ruta de categorías, ítem relacionados de la misma clasificación.
- **Página "Acerca de"** — información del producto, stack tecnológico, fuentes de datos y estadísticas de sesión.
- **Modo "Mi actividad económica"** en CABYS — extrae automáticamente palabras clave de la descripción de la AE del usuario y ejecuta búsquedas paralelas.

### Cambiado
- Rediseño visual de tarjetas CABYS — jerarquía mejorada: código › nombre › categorías › impuesto/tipo. Código en negrita mayor visibilidad.
- Categorías CABYS mostradas como ruta de texto (breadcrumb) en lugar de chips separados.
- Sidebar colapsable: en modo colapsado muestra solo íconos con tooltip.
- Refactorización del Home — spotlight de herramientas, accesos directos configurables, historial de actividad.
- Módulo "Tipo de Cambio" rediseñado con estilo Wise/Revolut — tarjetas hero, conversor triple CRC/USD/EUR, sparkline 30 días.
- Nota de Crédito y Débito añadidas como tipos soportados en el Visor XML.

### Corregido
- `CopyIco` movido a scope global — evita `ReferenceError` al abrir el drawer CABYS desde contextos distintos.
- Fondo transparente del drawer CABYS — `var(--card)` reemplazado por `var(--surface)` que sí existe en el `:root`.
- Filtro `soloInconsistencias` no se reseteaba al cargar un nuevo XML — movido al estado de `App()` con `useEffect([feXmlData])`.
- Líneas con `tipoAviso` no eran excluidas del conteo de "correctas" en el banner de resumen.
- Error de parsing cuando el código CABYS contenía saltos de línea en la tabla XML.
- Soporte DIMEX de 12 dígitos en la búsqueda de contribuyentes (`isValidAeId` ampliado a 9–12 dígitos).
- Estado 404 del contribuyente muestra `EmptyState` neutro en lugar de `AlertBox` rojo.
- Parsing de `CodigoCABYS` en líneas de detalle del XML.
- Visualización de cantidades: `1.00000` → `1` en la tabla del visor.

---

## [1.0.0] — 2026-06-08

### Primer lanzamiento público

#### Añadido
- **Buscador CABYS** — búsqueda por texto libre en el catálogo oficial del Ministerio de Hacienda. Resultados en vista de tarjetas o tabla, con scoring de relevancia. Exportación CSV y XLSX. Favoritos persistidos en `localStorage` (máx. 30).
- **Visor XML de Factura Electrónica** — carga y análisis de archivos XML FE. Presentación de emisor, receptor, líneas de detalle, moneda, totales e impuestos. Soporta `FacturaElectronica`, `TiqueteElectronico`, `FECompra` y `FEExportacion`. Parser propio con `DOMParser`, sin dependencias XML.
- **Consulta de Contribuyentes** — verificación del estado tributario por número de identificación (cédula física, jurídica, NITE). Muestra nombre, régimen, actividades económicas y estado en ATV.
- **Tipo de Cambio USD** — consulta en tiempo real desde BCCR. Conversor CRC/USD.
- **Calculadora IVA** — cálculo para tarifas 13%, 4%, 2%, 1% con desglose precio neto / impuesto / total.
- **Verificación de facturas** — consulta del estado de aceptación de una factura por clave de 50 dígitos.
- **Búsqueda de cédulas (TSE)** — búsqueda en el registro del Tribunal Supremo de Elecciones por cédula o nombre.
- **Proxies Vercel** — configuración de rewrites en `vercel.json` para evadir CORS: Hacienda, BCCR, GoMeta/TSE.
- **Layout con sidebar** — navegación lateral colapsable. Acceso directo a todos los módulos.
- **Asistente Tributario** — base de conocimientos local con respuestas a dudas frecuentes sobre IVA, renta y regímenes tributarios de Costa Rica.
- **Gestión de Clientes** — fichas de clientes con historial de consultas y favoritos CABYS por cliente. Almacenamiento en `localStorage`.
- **Persistencia local** — historial por módulo, favoritos CABYS y fichas de clientes guardados en `localStorage` con claves prefijadas `hk_`.

---

## Convención de versionado

| Tipo de cambio | Versión que incrementa |
|---------------|------------------------|
| Nueva funcionalidad | `MINOR` (1.x.0) |
| Corrección de error | `PATCH` (1.0.x) |
| Cambio incompatible de arquitectura | `MAJOR` (x.0.0) |

---

*Para detalles técnicos completos de cada decisión de diseño, ver [`docs/roadmap/decisiones.md`](docs/roadmap/decisiones.md).*
