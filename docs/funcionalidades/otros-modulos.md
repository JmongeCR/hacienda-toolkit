# Otros módulos

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

## Acerca de

**ID:** `acerca`  
**Componente:** `AcercaPage`

Muestra información del proyecto, versión, APIs usadas y el historial de actividad del usuario en la sesión actual.

---

## Home

**ID:** `home`

- Saludo según hora del día (`saludo()`)
- HubCards con accesos directos a los 5 módulos principales (Validador XML primero)
- Favoritos de inicio personalizables (`hk_home_favs`) — chips con búsquedas guardadas
- Recientes: últimas 7 actividades del `activity log`

**Defaults de favoritos en Home:**
- Desarrollo software
- Servicios profesionales
- Restaurante / Soda
- Construcción
- Comercio
