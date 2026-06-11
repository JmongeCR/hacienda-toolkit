# Otros módulos

---

## Cédulas TSE

**ID:** `cedulas`

Busca personas físicas y jurídicas en el registro del TSE usando la API de GoMeta.

**API:** `GET /gometa/cedulas?q={query}&callback=&type=&size=10`

**Normalización:** `normalizeGometa()` unifica diferentes formatos de respuesta de la API (los campos cambian según el tipo de consulta).

**Integración DIMEX:** si la búsqueda retorna 0 resultados y el query tiene 11+ dígitos, muestra un infoBox sugiriendo buscar en Contribuyentes (porque los DIMEX tributan en Hacienda pero no están en el TSE).

---

## Tipo de Cambio

**ID:** `tipocambio`

### Fuentes de datos
- **USD:** BCCR — `GET /bccr/...` (tipo de cambio compra/venta)
- **EUR:** Hacienda — `GET /hacienda/fe/...` (tipo de cambio de referencia)

### Funcionalidades
- Chips compactos con compra/venta USD y variación vs día anterior
- **Conversor (`ConversorWise`):** CRC ↔ USD ↔ EUR, con selección de moneda origen/destino
- **Sparkline 30 días (`TcSparkline`):** gráfico SVG inline del historial USD

### Estado local relevante
```js
fx            // { compra, venta } — tipo de cambio actual USD
fxEur         // { colones, fecha } — tipo de cambio EUR
tcHistory[]   // historial de puntos para sparkline
convFrom/convTo/convAmount/convResult  // conversor
```

---

## Exoneraciones

**ID:** `exoneraciones`

Consulta si una entidad tiene exoneraciones de impuestos registradas en Hacienda.

**API:** `GET /hacienda/fe/exoneraciones?...` (con tipo de documento y número)

**Tipos de documento:** Cédula física (01), Jurídica (02), DIMEX (03), NITE (04)

**Resultado:** lista de exoneraciones con tipo, porcentaje, fechas inicio/fin, estado (Activo/Inactivo). Campos adicionales no mapeados se muestran automáticamente (lógica de campos dinámicos en el render).

---

## Calculadora IVA

**ID:** `calculadora`  
**Componente:** `IvaCalculadoraPage`

Calculadora offline (sin API). Dos modos:
- **Monto sin IVA** → calcula el IVA y muestra total
- **Monto con IVA incluido** → retrocálculo para obtener el subtotal

Tarifas disponibles: 13%, 4%, 2%, 1% (las 4 más comunes; faltan 0%, 8%, 15%).

---

## Clientes

**ID:** `clientes`  
**Componente:** `ClientesPage`  
**Almacenamiento:** exclusivamente `localStorage` (`hk_clients`)

CRUD completo de clientes con:
- Nombre, identificación, notas
- Lista de favoritos CABYS por cliente (`favsCabys[]`)
- Historial de búsquedas CABYS por cliente (`historial[]`, máx 10)
- Vista detalle → botón para buscar CABYS asociado al cliente

**Limitación:** datos solo en el navegador, no se sincronizan entre dispositivos ni cuentas.

---

## Asistente Tributario

**ID:** `asistente`  
**Componente:** `TaxAssistantPage`

Chat con base de conocimientos local (`TAX_KB`, 12 entradas). No usa ninguna IA externa ni API.

**Temas cubiertos:**
1. Tarifas IVA (7 tarifas: 0%, 1%, 2%, 4%, 8%, 13%, 15%)
2. CABYS por sector (barberías, software, restaurantes, salud, construcción, contabilidad)
3. Exenciones / qué está exento de IVA
4. Actividad económica (CIIU)
5. Factura electrónica (quiénes deben emitir)
6. Régimen simplificado vs tradicional
7. Impuesto sobre la renta (tramos)
8. Cómo verificar exoneraciones

**Lógica:** scoring por keywords → retorna la entrada con mayor matches. Si no hay match, respuesta genérica con sugerencias.

**Acciones rápidas:** cada respuesta puede incluir botones que navegan a otro módulo y ejecutan una búsqueda (`acts[]` en cada entrada de `TAX_KB`).

---

## Acerca de

**ID:** `acerca`  
**Componente:** `AcercaPage`

Muestra información del proyecto, versión, APIs usadas y el historial de actividad del usuario en la sesión actual.

---

## Home

**ID:** `home`

- Saludo según hora del día (`saludo()`)
- HubCards con accesos directos a los 6 módulos principales
- Favoritos de inicio personalizables (`hk_home_favs`) — chips con búsquedas guardadas
- Recientes: últimas 7 actividades del `activity log`

**Defaults de favoritos en Home:**
- Desarrollo software
- Servicios profesionales
- Restaurante / Soda
- Construcción
- Comercio
