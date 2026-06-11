# HaciendaKit

[![Producción](https://img.shields.io/badge/Vercel-Producción-black?logo=vercel)](https://hacienda-toolkit.vercel.app)
[![License](https://img.shields.io/badge/licencia-MIT-green)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-JmongeCR%2Fhacienda--toolkit-181717?logo=github)](https://github.com/JmongeCR/hacienda-toolkit)

Herramientas tributarias para Costa Rica — directamente en el navegador.

🌐 **[hacienda-toolkit.vercel.app](https://hacienda-toolkit.vercel.app)**

---

## Funcionalidades

- **Visor XML** — analiza facturas electrónicas (FE v4.4), notas de crédito/débito y tiquetes
- **Validación Tributaria** — verifica CABYS y tasa de IVA por línea contra el catálogo oficial de Hacienda
- **Buscador CABYS** — búsqueda en el catálogo oficial con drawer de detalle, favoritos y exportación CSV/Excel
- **Contribuyentes** — consulta estado tributario por cédula, DIMEX o NITE
- **Tipo de Cambio** — USD/EUR en tiempo real desde BCCR, conversor y sparkline 30 días
- **Calculadora IVA** — todas las tarifas vigentes en CR (0%, 1%, 2%, 4%, 8%, 13%, 15%)
- **Exoneraciones** — consulta por cédula y tipo de documento
- **Asistente Tributario** — respuestas a dudas frecuentes sobre IVA, renta y regímenes

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

---

## Stack

React 19 · Vite 7 · CSS puro · SheetJS · Vercel

APIs: Ministerio de Hacienda CR · BCCR · GoMeta · TSE

---

## Licencia

MIT © 2026 — Jean Monge Salas
