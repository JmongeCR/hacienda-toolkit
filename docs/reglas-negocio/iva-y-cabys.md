# Reglas de negocio: IVA y CABYS

---

## Clasificación CABYS: Artículo vs Servicio

**Implementación:** `cabysEsServicio(codigo)`

```js
function cabysEsServicio(codigo) {
  const s = String(codigo ?? "").replace(/\D/g, "")
  return s[0] === "8" || s[0] === "9"
}
```

**Regla:** los capítulos 8x y 9x del CABYS corresponden a servicios. Todo lo demás es artículo.

**Contexto:** esta clasificación viene del esquema del CABYS oficial de Hacienda Costa Rica donde los dos primeros dígitos definen el capítulo.

---

## Tarifas IVA vigentes (Ley 6826, Ley 9635)

| Tarifa | Aplicación |
|--------|------------|
| 0% | Canasta básica, medicamentos esenciales, educación pública, exportaciones, CCSS, arrendamiento vivienda, seguros de vida |
| 1% | Primas de seguros |
| 2% | Boletos de avión internacional |
| 4% | Servicios de salud privada, veterinarios, algunos alimentos procesados, medicamentos no esenciales |
| 8% | Planes de salud privados, seguros médicos privados |
| 13% | Tarifa general (mayoría de bienes y servicios) |
| 15% | Licores, cervezas, cigarrillos y tabaco |

**Implementación visual:** `taxClass(impuesto)` → clase CSS `t0`, `t1`, `t2`, `t4`, `t8`, `t13`, `t15`

---

## Validación IVA en XML

**Regla:** comparar el IVA declarado en el XML (`ivaPct`) contra el IVA oficial del código CABYS obtenido de la API de Hacienda (`cv.impuesto`).

```js
const ivaMismatch = cv.status === "ok"
  && cv.impuesto !== null
  && l.ivaPct !== undefined && l.ivaPct !== ""
  ? parseFloat(l.ivaPct) !== cv.impuesto
  : false
```

**Cuando hay diferencia:** se muestra `⚠ IVA XML: X% / esperado: Y%` en la columna Validaciones.

**Consideración:** esta validación puede dar falsos positivos en casos de transiciones de tasas o acuerdos especiales. Es informativa.

---

## Unidades de medida que indican servicio

```js
const XML_SVC_UNITS = ["Sp", "Al", "Os", "Spe", "m2e"]
```

Fuente: nomenclatura de UnidadMedida del XML FE de Hacienda.

- `Sp` — Servicios Profesionales
- `Al` — Alquiler
- `Os` — Otros servicios
- `Spe` — Servicios especiales
- `m2e` — Metro cuadrado de construcción (ambiguo)

**Uso:** cuando la unidad XML es de servicio pero el CABYS es de artículo (o viceversa), se muestra badge ámbar "Verificar tipo".

**Decisión de diseño (junio 2025):** NO usar como criterio de error. El campo `UnidadMedida` en la práctica no es consistente entre emisores (ej: médicos usan `Sp` con CABYS de artículo para insumos médicos). Solo como aviso informativo.

---

## Identificación de contribuyentes

| Tipo | Dígitos | Validación |
|------|---------|------------|
| Cédula física | 9 | `isValidAeId` → 9–12 |
| Cédula jurídica | 10 | `isValidAeId` → 9–12 |
| NITE | 10 | `isValidAeId` → 9–12 |
| DIMEX | 11–12 | `isValidAeId` → 9–12 |

**Decisión de diseño:** aceptar 9–12 dígitos para soportar DIMEX. Implementado en junio 2025 cuando se detectó que DIMEX de 12 dígitos era rechazado.

---

## Exoneraciones

Las exoneraciones permiten a ciertas entidades no pagar IVA o pagarlo a tasa reducida:
- Entidades del Estado y autónomas
- Misiones diplomáticas
- ONGs autorizadas
- Zonas Francas
- Instituciones educativas reconocidas

Se verifican por cédula en la API de Hacienda. El estado "Activo" o "Inactivo" determina si está vigente.

---

## Clave de comprobante electrónico (50 dígitos)

- Exactamente 50 dígitos numéricos
- Validación: `feClean.length === 50`
- Incluye: código país, fecha, cédula emisor, consecutivo, situación, seguridad

---

## Impuesto sobre la renta

**Personas Jurídicas:**
- Hasta ₡119M: 5%
- ₡119M–₡238M: 10%
- ₡238M–₡476M: 15%
- Más de ₡476M: 30%

*Fuente: Ley 7092 reformada. Los tramos se actualizan por decreto.*

---

## Régimen simplificado

- Aplica cuando ingresos anuales < ~₡106 millones
- Pago trimestral: 2.5%–5.5% según factor
- IVA incluido en el precio (no se declara por separado)
- Obligado igualmente a emitir factura electrónica
