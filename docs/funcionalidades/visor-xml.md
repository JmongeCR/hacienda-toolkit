# Módulo: Validador XML

**ID de página:** `factura`  
**Estado:** Activo y completo

---

## Descripción

Permite al usuario cargar un archivo XML de comprobante electrónico de Hacienda y ver su contenido estructurado junto con validaciones tributarias automáticas.

---

## Tabs disponibles

### Tab "Por clave" (50 dígitos)
- Input numérico, exactamente 50 dígitos
- Consulta `GET /hacienda/fe/FacturaElectronica?clave={50digitos}`
- Muestra: emisor, receptor, monto, fecha, estado de aceptación
- No muestra líneas de detalle (solo resumen de la clave)

### Tab "Cargar XML"
- Input file (`.xml`) o textarea para pegar XML
- Parser: `parseXmlFe()` con `DOMParser` nativo — sin dependencias externas
- Renderiza: `XmlFacturaResult`

---

## Tipos de documento soportados

| Tag XML | Nombre mostrado |
|---------|----------------|
| `FacturaElectronica` | Factura Electrónica |
| `TiqueteElectronico` | Tiquete Electrónico |
| `NotaDebitoElectronica` | Nota de Débito |
| `NotaCreditoElectronica` | Nota de Crédito |
| `FacturaElectronicaCompra` | FE de Compra |
| `FacturaElectronicaExportacion` | FE de Exportación |

---

## Campos parseados por documento

**Encabezado:**
- Clave numérica (50 dígitos), NumeroConsecutivo, FechaEmision
- Emisor: Nombre, NombreComercial, Identificacion, CorreoElectronico
- Receptor: Nombre, Identificacion, CorreoElectronico
- Moneda + TipoCambio (schema v4.4: `CodigoTipoMoneda > CodigoMoneda`)

**Resumen:**
- TotalComprobante, TotalImpuesto, TotalVentaNeta, TotalDescuentos

**Por línea (`LineaDetalle`):**
- Descripción, Cantidad, UnidadMedida, PrecioUnitario
- CodigoCABYS (fallback: CodigoComercial > Codigo)
- IVA tarifa y monto
- MontoTotalLinea

**Referencias (`InformacionReferencia`):**
- TipoDoc, Numero, FechaEmisionDoc, Codigo, Razon

---

## Validación tributaria (columna "Validaciones")

Se ejecuta en `useEffect` al cargar un XML con líneas.

### Flujo
1. Extrae todos los códigos CABYS únicos de las líneas (`new Set()`)
2. Consulta en paralelo `GET /hacienda/fe/cabys?codigo=X` por cada código único
3. Almacena en estado `cabysValidation: { [codigo]: { status, impuesto } }`

### Estados por línea
- `loading` → `···`
- `ok` → ✔ CABYS válido + validación IVA + badge tipo
- `nf` (not found) → ⚠ No encontrado en CABYS
- `err` → ⚠ Sin verificar

### Validación IVA
- Compara `parseFloat(l.ivaPct)` vs `cv.impuesto` (número de la API)
- Mismatch → `⚠ IVA XML: X% / esperado: Y%`
- Match → `✔ IVA correcto`

### Badge Artículo / Servicio
- Siempre informativo, nunca como error
- Basado en `cabysEsServicio(codigo)` (primer dígito 8/9)

### Aviso "Verificar tipo" (ámbar)
- Cuando la unidad de medida XML (`UnidadMedida`) sugiere servicio pero CABYS dice artículo, o viceversa
- Unidades de servicio reconocidas: `["Sp","Al","Os","Spe","m2e"]`
- Es **sugerencia informativa**, no bloquea ni clasifica la línea como incorrecta
- **Decisión de diseño:** no usar como criterio de error. Auditado junio 2025.

---

## Resumen de validaciones (banner)

Aparece encima de la tabla de líneas. Conteos:
- `✔ N líneas correctas` — CABYS ok + IVA ok + sin aviso de tipo
- `⚠ N diferencias de IVA`
- `⚠ N verificar tipo`
- `⚠ N CABYS no encontrados`
- `⚠ N sin verificar`

Botón "Ver solo inconsistencias" → filtra la tabla para mostrar solo filas con algún problema.

---

## Aviso legal

Al pie de la sección de validaciones:
> "La validación es informativa y no sustituye la revisión tributaria profesional..."

---

## Estado local relevante

```js
feTab           // "clave" | "xml"
feKey           // string — clave de 50 dígitos
feData          // resultado de consulta por clave
feXmlData       // resultado parseado del XML
feXmlError      // string — error de parseo
cabysValidation // { [codigo]: { status, impuesto } }
soloInconsistencias // boolean — toggle filtro de filas
```

---

## Acciones disponibles

- 🖨 Imprimir / PDF → `window.print()` con CSS `@media print`
- Copiar resumen (emisor, receptor, fecha, total, clave)
- Exportar Excel (líneas de detalle)
- ← Cargar otro XML

---

## Limitaciones conocidas

- `soloInconsistencias` no se resetea automáticamente al cargar un nuevo XML
- El parser no valida la firma digital del XML
- No verifica el estado de aceptación por Hacienda del XML cargado (solo lo analiza)
