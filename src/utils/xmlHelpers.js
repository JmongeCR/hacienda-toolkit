/* ─────────────────────────────────────────────
   XML HELPERS — parser FE + fetch JSON seguro
───────────────────────────────────────────── */

/**
 * Fetch con validación de JSON y manejo de errores HTTP.
 * @param {string} url
 * @returns {Promise<any>}
 */
export async function fetchJsonSafe(url) {
  const res = await fetch(url, { cache: "no-store" })
  const ct = (res.headers.get("content-type") || "").toLowerCase()
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (!ct.includes("application/json")) throw new Error(`Respuesta no es JSON: ${text.slice(0, 100)}`)
  try { return JSON.parse(text) } catch { throw new Error(`JSON inválido: ${text.slice(0, 100)}`) }
}

/**
 * Parsea un XML de factura electrónica CR (esquema v4.4).
 * @param {string} xmlStr — contenido XML como texto
 * @returns {object} — estructura normalizada del comprobante
 */
export function parseXmlFe(xmlStr) {
  const dp = new DOMParser()
  const doc = dp.parseFromString(xmlStr, "application/xml")
  const err = doc.querySelector("parsererror")
  if (err) throw new Error("XML inválido: " + err.textContent.slice(0, 120))
  const get = (sel) => doc.querySelector(sel)?.textContent?.trim() || ""
  const rootTag = doc.documentElement.localName
  const clave          = get("Clave")
  const numConsecutivo = get("NumeroConsecutivo")
  const fecha          = get("FechaEmision")
  const emisor = {
    nombre:    get("Emisor > Nombre"),
    comercial: get("Emisor > NombreComercial"),
    cedula:    get("Emisor > Identificacion > Numero"),
    tipoCed:   get("Emisor > Identificacion > Tipo"),
    correo:    get("Emisor > CorreoElectronico"),
  }
  const receptor = {
    nombre: get("Receptor > Nombre"),
    cedula: get("Receptor > Identificacion > Numero"),
    correo: get("Receptor > CorreoElectronico"),
  }
  // Schema v4.4: CodigoTipoMoneda > CodigoMoneda; versiones anteriores usan Codigo
  const moneda     = get("CodigoTipoMoneda > CodigoMoneda") || get("CodigoTipoMoneda > Codigo") || get("CodigoMoneda") || "CRC"
  const tipoCambio = get("CodigoTipoMoneda > TipoCambio") || get("TipoCambio") || ""
  const resumen = {
    total:         get("TotalComprobante"),
    totalImpuesto: get("TotalImpuesto") || get("TotalImpuestoVenta"),
    totalVenta:    get("TotalVentaNeta") || get("TotalVenta"),
    totalDesc:     get("TotalDescuentos"),
    moneda, tipoCambio,
  }
  const lines = [...doc.querySelectorAll("LineaDetalle")].map(el => {
    const g = sel => el.querySelector(sel)?.textContent?.trim() || ""
    return {
      descripcion: g("Detalle") || g("Descripcion"),
      cantidad:    g("Cantidad"),
      unidad:      g("UnidadMedida"),
      precio:      g("PrecioUnitario"),
      subtotal:    g("SubTotal"),
      cabys:       g("CodigoCABYS") || g("CodigoComercial > Codigo") || g("Codigo"),
      ivaPct:      g("Impuesto > Tarifa") || g("Tarifa"),
      ivaMoneto:   g("Impuesto > Monto"),
      total:       g("MontoTotalLinea"),
    }
  })
  const condicionVenta = get("CondicionVenta") || ""
  const refNodes   = [...doc.querySelectorAll("InformacionReferencia")]
  const referencias = refNodes.map(n => {
    const rg = sel => n.querySelector(sel)?.textContent?.trim() || ""
    return {
      tipoDoc:  rg("TipoDoc"),
      numero:   rg("Numero"),
      fechaRef: rg("FechaEmisionDoc"),
      codigo:   rg("Codigo"),
      razon:    rg("Razon"),
    }
  })
  const tiposDoc = {
    FacturaElectronica:"Factura Electrónica", TiqueteElectronico:"Tiquete Electrónico",
    NotaDebitoElectronica:"Nota de Débito", NotaCreditoElectronica:"Nota de Crédito",
    FacturaElectronicaCompra:"FE de Compra", FacturaElectronicaExportacion:"FE de Exportación",
  }
  const tiposRefDoc = {
    "01":"Factura Electrónica","02":"Nota de Débito","03":"Nota de Crédito",
    "04":"Tiquete","05":"Nota despacho","06":"Contrato","07":"Procedimiento",
    "08":"Comprobante emitido en contingencia","09":"Devolución mercadería",
    "10":"Sustitución FE anulada","11":"Continuación FE","12":"FE de Exportación","99":"Otro",
  }
  const codigosRef = {
    "01":"Anula doc ref","02":"Corrige texto","03":"Corrige monto",
    "04":"Referencia a otro doc","05":"Sustituye doc provisional","06":"Otros",
  }
  return { rootTag, tipoDoc: tiposDoc[rootTag] || rootTag, clave, numConsecutivo, fecha, emisor, receptor, resumen, lines, condicionVenta, referencias, tiposRefDoc, codigosRef }
}
