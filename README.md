# HaciendaKit V2.0

[![Producción](https://img.shields.io/badge/Vercel-Producción-black?logo=vercel)](https://hacienda-toolkit.vercel.app)
[![License](https://img.shields.io/badge/licencia-MIT-green)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-JmongeCR%2Fhacienda--toolkit-181717?logo=github)](https://github.com/JmongeCR/hacienda-toolkit)
[![Versión](https://img.shields.io/badge/versión-2.0.0-blue)](./CHANGELOG.md)

Plataforma especializada para validación y análisis de comprobantes electrónicos de Costa Rica.
Diseñada para acelerar la revisión de XML de facturación electrónica y facilitar la investigación de rechazos relacionados con CABYS, IVA y configuración tributaria.

🌐 **[hacienda-toolkit.vercel.app](https://hacienda-toolkit.vercel.app)**

---

## Casos de uso

- Revisión de XML rechazados por Hacienda.
- Validación rápida de códigos CABYS.
- Verificación de tasas de IVA.
- Consulta de contribuyentes.
- Investigación de inconsistencias tributarias.
- Apoyo a equipos de soporte e implementación.

---

## Módulos activos

| Módulo | Descripción |
|--------|-------------|
| **Validador XML** | Carga y analiza comprobantes XML: emisor, receptor, líneas, CABYS, IVA, totales |
| **Asistente CABYS** | Búsqueda en el catálogo oficial con favoritos y exportación CSV/Excel |
| **Contribuyentes** | Consulta estado tributario, régimen y actividades económicas por cédula/DIMEX/NITE |
| **Exoneraciones** | Verifica exoneraciones de impuestos registradas en Hacienda |
| **Tipo de Cambio** | USD/EUR en tiempo real desde BCCR, conversor y sparkline 30 días |
| **Clientes** | Agenda local de clientes con favoritos CABYS por cliente (localStorage) |

---

## Dependencias de datos

Únicamente APIs públicas oficiales:

| API | Uso |
|-----|-----|
| `api.hacienda.go.cr` | CABYS, contribuyentes, facturas electrónicas, exoneraciones, tipo de cambio EUR |
| `gee.bccr.fi.cr` | Tipo de cambio USD (compra/venta, histórico) |

Las llamadas a estas APIs se proxean a través de Vercel Rewrites para evitar CORS. No existe ningún backend propio.

---

## Arquitectura

- **Frontend React + Vite** — SPA sin router externo ni backend propio
- **Arquitectura SPA sin backend propio** — proxies Vercel como único intermediario
- **Persistencia local mediante localStorage** — historial, favoritos y clientes en el dispositivo
- **Integración con APIs oficiales de Costa Rica** — Hacienda y BCCR únicamente

---

## Licencia

MIT © 2026 — Jean Monge Salas
