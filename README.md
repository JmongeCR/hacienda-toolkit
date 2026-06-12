# HaciendaKit V2.0

[![Producción](https://img.shields.io/badge/Vercel-Producción-black?logo=vercel)](https://hacienda-toolkit.vercel.app)
[![License](https://img.shields.io/badge/licencia-MIT-green)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-JmongeCR%2Fhacienda--toolkit-181717?logo=github)](https://github.com/JmongeCR/hacienda-toolkit)
[![Versión](https://img.shields.io/badge/versión-2.0.0-blue)](./CHANGELOG.md)

Plataforma especializada para validación y análisis de comprobantes electrónicos de Costa Rica.

🌐 **[hacienda-toolkit.vercel.app](https://hacienda-toolkit.vercel.app)**

---

## Propósito

HaciendaKit V2.0 está enfocado en la revisión de comprobantes electrónicos XML emitidos bajo el esquema de Hacienda CR:

- Analizar el contenido de facturas electrónicas XML (FE v4.4)
- Validar códigos CABYS por línea contra el catálogo oficial
- Revisar tasas de IVA y detectar inconsistencias
- Identificar diferencias entre el XML y los datos oficiales de Hacienda
- Facilitar la investigación de rechazos y errores tributarios

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

## Instalación local

```bash
git clone https://github.com/JmongeCR/hacienda-toolkit.git
cd hacienda-toolkit
npm install
npm run dev
```

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo en `localhost:5173` |
| `npm run build` | Build de producción |
| `npm run preview` | Vista previa del build |
| `npm run lint` | Verificación ESLint |

---

## Stack

React 19 · Vite 7 · CSS puro · SheetJS (XLSX) · Vercel

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

- **SPA sin router externo** — navegación por estado `page` string
- **Archivo único** — toda la lógica en `src/App.jsx`
- **Sin backend propio** — proxies Vercel como único intermediario
- **Sin estado global** — `useState` en el componente raíz, props drilling
- **Persistencia local** — `localStorage` con prefijo `hk_`

---

## Licencia

MIT © 2026 — Jean Monge Salas
