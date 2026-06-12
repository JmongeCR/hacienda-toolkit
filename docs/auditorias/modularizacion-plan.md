# Plan de modularización — App.jsx

**Fecha:** Junio 2025  
**Estado actual:** App.jsx 3.529 líneas | App.css 1.997 líneas  
**Objetivo:** reducir App.jsx a ~600 líneas de shell + layouts; resto en módulos independientes

---

## 1. Mapa de dependencias actual (V2.0)

> **Nota:** Los módulos Cédulas/GoMeta, Calculadora IVA y Asistente IA fueron eliminados en V2.0.

### Estructura de llamadas entre secciones

```
App()                          (shell: navegación, layout, estado global compartido)
│
├── [estado global real]
│   ├── page, sideOpen, sideCollapsed
│   ├── activities, homeFavs
│   ├── cabysF_avs (favoritos CABYS — compartido entre cabys y clientes)
│   └── cmdOpen
│
├── [estado por módulo — actualmente en App()]
│   ├── CABYS: cabysQ, cabysData, cabysPage, cabysSort, cabysView, cabysNorm,
│   │          cabysMode, aeDesc, selectedCabys, cabysLoading, cabysError...
│   ├── Contribuyente: aeId, aeData, aeLoading, aeError, aeSearched, aeHist
│   ├── Validador XML: feTab, feKey, feData, feXmlData, feXmlError, feXmlDrag,
│   │                  feLoading, feError, feSearched, cabysValidation
│   ├── Tipo de cambio: fx, fxEur, fxLoading, convFrom, convTo, convAmount,
│   │                   tcHistory, tcHistLoading, tcFecha, tcData
│   └── Exoneraciones: exoQ, exoTipo, exoData, exoLoading, exoError
│
├── [dependencias cruzadas — el nudo del problema]
│   ├── cabysF_avs: leído por Home, CABYS page, Clientes, CabysDrawer
│   ├── consultarCabysRef: usado por Home, CommandPalette, FichaContribuyente
│   ├── setCabysQ + setCabysPage: pasados como props a CommandPalette,
│   │                              ClientesPage, FichaContribuyente
│   └── navigate(): pasado a casi todos los componentes
│
└── [componentes ya independientes — solo dependen de props]
    ├── ClientesPage             (recibe setCabysQ, consultarCabysRef, navigate)
    ├── AcercaPage               (recibe activities)
    ├── XmlFacturaResult         (recibe data, cabysValidation, callbacks)
    ├── CabysCard                (recibe item, fl, flash, favs, onToggleFav, onSelect)
    ├── CabysDrawer              (recibe item, relatedItems, fl, flash, ...)
    ├── FichaContribuyente       (recibe data, callbacks)
    ├── CommandPalette           (recibe muchos props)
    ├── ConversorWise            (recibe fx, fxEur, conv*)
    └── TcSparkline              (recibe data, loading)
```

### Dependencias cruzadas críticas

| Estado | Compartido entre | Impacto |
|--------|-----------------|---------|
| `cabysF_avs` | Home, CABYS, Clientes, Drawer | Requiere Context o prop drilling |
| `consultarCabysRef` | Home, CommandPalette, Cédulas, Contribuyente, Clientes, Asistente | Ref compartida |
| `navigate()` | Todos los módulos | Necesita abstracción |
| `fl / flash` | Todos los componentes con copia | `useCopyFlash` ya existe, solo propagarlo |

---

## 2. Componentes candidatos a extraer

### Prioridad ALTA — ya son independientes, solo mover

> V2.0: `IvaCalculadoraPage` y `TaxAssistantPage` fueron eliminados. No aplican.

| Componente | Líneas actuales | Archivo propuesto | Dependencias externas |
|---|---|---|---|
| `AcercaPage` | 150 | `src/pages/Acerca.jsx` | `IC`, `relTime` |
| `CabysCard` | 86 | `src/components/cabys/CabysCard.jsx` | `cabysEsServicio`, `getCabysHierarchy`, `taxClass`, `IC` |
| `CabysDrawer` | 163 | `src/components/cabys/CabysDrawer.jsx` | `cabysEsServicio`, `getCabysHierarchy`, `CopyIco`, `taxClass` |
| `ConversorWise` | 90 | `src/components/tipocambio/ConversorWise.jsx` | `CurrencySelector` |
| `TcSparkline` | 64 | `src/components/tipocambio/TcSparkline.jsx` | Ninguna |
| `CurrencySelector` | 40 | `src/components/tipocambio/CurrencySelector.jsx` | Ninguna |
| `XmlFacturaResult` | 345 | `src/components/factura/XmlFacturaResult.jsx` | `CopyIco`, `cabysEsServicio`, `taxClass`, `formatFechaCR` |
| `ClientesPage` | 223 | `src/pages/Clientes.jsx` | `nameInitials`, `IC` |

### Prioridad MEDIA — requieren refactor mínimo

| Componente | Líneas actuales | Archivo propuesto | Cambio necesario |
|---|---|---|---|
| `CommandPalette` | 125 | `src/components/CommandPalette.jsx` | Mover `IC` a import |
| `FichaContribuyente` | 89 | `src/components/contribuyente/FichaContribuyente.jsx` | Mover `nameInitials`, `onlyDigits` |

### Prioridad BAJA — páginas inline en App() JSX

| Sección | Líneas JSX | Archivo propuesto | Bloqueo |
|---|---|---|---|
| CABYS page | ~205 | `src/pages/CabysPage.jsx` | `cabysF_avs` compartido |
| Home | ~117 | `src/pages/HomePage.jsx` | Múltiples estados globales |
| Factura page wrapper | ~141 | `src/pages/FacturaPage.jsx` | Estado `feXmlData` + `cabysValidation` |
| Contribuyente page | ~45 | Fusionar con `FichaContribuyente` | Bajo |
| Cédulas page | ~76 | `src/pages/CedulasPage.jsx` | Bajo |
| Exoneraciones page | ~68 | `src/pages/ExoneracionesPage.jsx` | Bajo |
| Tipo de cambio page | ~55 | `src/pages/TipoCambioPage.jsx` | Bajo |

### Componentes UI atómicos — ya reutilizables, solo mover

Todos a `src/components/ui/`:
- `Skeleton`, `ChipStatus`, `CopyBtn`, `EmptyState`, `PageHeader`, `SortableTH`, `CopyIco`

---

## 3. Hooks candidatos a extraer

### `useCopyFlash` → `src/hooks/useCopyFlash.js`
Ya existe como función, solo mover a archivo propio.
```js
// Exporta: { fl, flash }
// Sin dependencias externas
// Utilizado por: TODO el árbol de componentes
```

### `useCabys` → `src/hooks/useCabys.js`
Encapsula todo el estado y lógica de búsqueda CABYS:
```js
// Estado: cabysQ, cabysData, cabysPage, cabysSort, cabysView,
//         cabysNorm, cabysMode, aeDesc, selectedCabys, cabysLoading, cabysError
// Acciones: consultarCabys, consultarCabysAe, cabysNext, handleCabysSort
// Derivados: cabysQ_, cabysRows, cabysTotal, cabysHasNext, pageSize
// Dependencias: restoreAccents, matchAe, fetchJsonSafe, logActivity
```

### `useContribuyente` → `src/hooks/useContribuyente.js`
```js
// Estado: aeId, aeData, aeLoading, aeError, aeSearched, aeHist
// Acciones: consultarAE
// Derivados: aeDigits, aeValid, aeJsonId
// Dependencias: isValidAeId, onlyDigits, fetchJsonSafe, logActivity
```

### ~~`useCedulas`~~ — eliminado en V2.0 (módulo GoMeta/TSE removido)

### `useFacturaElectronica` → `src/hooks/useFacturaElectronica.js`
```js
// Estado: feTab, feKey, feData, feXmlData, feXmlError, feXmlDrag,
//         feLoading, feError, feSearched, cabysValidation
// Acciones: consultarFe, handleXmlFile, handleXmlDrop
// Derivados: feClean, feValid, feDecoded
// Dependencias: parseXmlFe, onlyDigits, fetchJsonSafe, logActivity
```

### `useTipoCambio` → `src/hooks/useTipoCambio.js`
```js
// Estado: fx, fxEur, fxLoading, fxError, convFrom, convTo, convAmount,
//         tcHistory, tcHistLoading, tcFecha, tcData
// Acciones: fetchFx, fetchTcHistory
// Derivados: convResult
// Sin dependencias de negocio (solo fetch + formato)
```

### `useExoneraciones` → `src/hooks/useExoneraciones.js`
```js
// Estado: exoQ, exoTipo, exoData, exoLoading, exoError, exoSearched
// Acciones: consultarExo
// Dependencias: fetchJsonSafe, onlyDigits, logActivity
```

### `useActivityLog` → `src/hooks/useActivityLog.js`
```js
// Estado: activities
// Acciones: logActivity
// Persistencia: localStorage hk_activity
```

---

## 4. Utilidades candidatas a /utils

### `src/utils/format.js`
```
formatFechaCR(fecha)       — fecha en locale es-CR
relTime(ts)                — tiempo relativo ("ahora", "5m", "2h")
onlyDigits(s)              — strip non-numeric
nameInitials(name)         — "Juan Pérez" → "JP"
saludo()                   — "Buenos días/tardes/noches"
taxClass(impuesto)         — número → clase CSS IVA
toCsv(rows, headers)       — array → CSV string
downloadBlob(filename, blob) — descarga browser
downloadXlsx(...)          — XLSX via librería xlsx
```

### `src/utils/cabys.js`
```
cabysEsServicio(codigo)    — primer dígito 8/9 → servicio
getCabysHierarchy(codigo)  — prefijo → array categorías
CABYS_CAT1                 — mapa nivel 1
CABYS_CAT2                 — mapa nivel 2
```

### `src/utils/search.js`
```
restoreAccents(query)      — normalización tildes (usa ACCENT_MAP)
ACCENT_MAP                 — ~100 entradas
extractAeTerms(desc)       — extrae keywords de descripción AE
matchAe(desc)              — detecta sector económico (usa AE_MAP)
scoreMatch(query, desc)    — % de coincidencia de palabras
AE_MAP                     — 24 sectores económicos
STOP_WORDS                 — palabras a ignorar en búsqueda
```

### `src/utils/xmlParser.js`
```
parseXmlFe(xmlStr)         — DOMParser → objeto estructurado
```

### `src/utils/storage.js`
```
loadFavs() / saveFavs()    — hk_favs
loadHomeFavs() / saveHomeFavs() — hk_home_favs
loadActs() / appendAct()   — hk_activity
loadH(key) / saveH(key,v)  — historiales por módulo
loadClients() / saveClients() — hk_clients
FAV_KEY, HOME_FAVS_KEY, ACT_KEY, LS_CLIENTS — claves
HOME_FAVS_DEFAULT          — favoritos por defecto
```

### `src/utils/api.js`
```
fetchJsonSafe(url)          — fetch con validación JSON
checkApiStatus()            — ping a la API de Hacienda
```

> `normalizeGometa` y `src/utils/taxKb.js` eliminados en V2.0

### `src/utils/ids.js`
```
isValidAeId(s)              — valida 9–12 dígitos
onlyDigits(s)               — (también en format.js, consolidar)
```

### `src/constants/icons.js`
```
IC                          — objeto con todos los SVG inline (~30 iconos)
ACT_ICONS / ACT_LABELS      — iconos y labels por tipo de actividad
HUB_CARDS                   — configuración de las tarjetas del Home
CABYS_SUGERENCIAS           — 10 búsquedas sugeridas
```

---

## 5. Plan de migración por fases

### Principio rector
**Cada fase debe dejar el build funcionando.** Nada de refactors "big bang". Una fase = un PR = tests manuales = deploy.

---

### Fase 1: Utilidades puras — sin riesgo (estimado: 2–3h)

Mover funciones sin estado, sin JSX, sin imports de React.  
**Riesgo:** casi cero. Son funciones puras.

```
Crear src/utils/format.js     → formatFechaCR, relTime, onlyDigits, nameInitials, saludo,
                                 taxClass, toCsv, downloadBlob, downloadXlsx
Crear src/utils/cabys.js      → cabysEsServicio, getCabysHierarchy, CABYS_CAT1, CABYS_CAT2
Crear src/utils/search.js     → restoreAccents, ACCENT_MAP, extractAeTerms, matchAe,
                                 scoreMatch, AE_MAP, STOP_WORDS
Crear src/utils/xmlParser.js  → parseXmlFe
Crear src/utils/storage.js    → todas las funciones de localStorage
Crear src/utils/api.js        → fetchJsonSafe, checkApiStatus
# normalizeGometa, TAX_KB y queryAssistant eliminados en V2.0
Crear src/constants/icons.js  → IC, ACT_ICONS, ACT_LABELS, HUB_CARDS, CABYS_SUGERENCIAS
```

**Resultado:** App.jsx pierde ~600 líneas (datos/constantes/helpers).  
App.jsx queda en ~2.900 líneas.

---

### Fase 2: Componentes UI atómicos — sin estado de negocio (estimado: 1h)

```
Crear src/components/ui/index.js →
  Skeleton, ChipStatus, CopyBtn, EmptyState, PageHeader, SortableTH, CopyIco
```

**Resultado:** App.jsx pierde ~80 líneas.  
App.jsx queda en ~2.820 líneas.

---

### Fase 3: Componentes de página independientes — solo props (estimado: 2h)

Estos componentes ya reciben todo por props. Mover sin cambiar interfaz.

```
# Calculadora.jsx y Asistente.jsx eliminados en V2.0
src/pages/Acerca.jsx           ← AcercaPage (150 líneas)
src/pages/Clientes.jsx         ← ClientesPage (223 líneas)
```

**Resultado:** App.jsx pierde ~570 líneas.  
App.jsx queda en ~2.250 líneas.

---

### Fase 4: Componentes de dominio CABYS (estimado: 1.5h)

```
src/components/cabys/CabysCard.jsx    (86 líneas)
src/components/cabys/CabysDrawer.jsx  (163 líneas)
```

Importan de: `src/utils/cabys.js`, `src/components/ui/`, `src/constants/icons.js`

**Resultado:** App.jsx pierde ~250 líneas.  
App.jsx queda en ~2.000 líneas.

---

### Fase 5: Componentes de dominio restantes (estimado: 2h)

```
src/components/contribuyente/FichaContribuyente.jsx  (89 líneas)
src/components/factura/XmlFacturaResult.jsx          (345 líneas)
src/components/CommandPalette.jsx                    (125 líneas)
src/components/tipocambio/ConversorWise.jsx          (90 líneas)
src/components/tipocambio/TcSparkline.jsx            (64 líneas)
src/components/tipocambio/CurrencySelector.jsx       (40 líneas)
```

**Resultado:** App.jsx pierde ~750 líneas.  
App.jsx queda en ~1.250 líneas.

---

### Fase 6: Hooks de módulo — la más compleja (estimado: 4–6h)

Extraer estado + lógica de cada dominio a hooks propios.  
**Riesgo:** medio. Las dependencias cruzadas deben resolverse antes.

#### Resolución de dependencias cruzadas antes de esta fase:
1. `cabysF_avs` — opción A: pasar como prop desde App (sin Context). Opción B: Context. **Recomendado: prop desde App**, ya que solo 3 módulos lo usan.
2. `consultarCabysRef` — mantener en App como ref, pasarlo a los hooks que lo necesiten.
3. `navigate` — mantener en App, pasar como prop.

```
src/hooks/useCopyFlash.js         — ya existe, solo mover
src/hooks/useActivityLog.js       — activities + logActivity
src/hooks/useTipoCambio.js        — fx, fxEur, conversor, historial, sparkline
src/hooks/useExoneraciones.js     — exoQ, exoTipo, exoData, consultarExo
src/hooks/useCedulas.js           — cedQ, cedItems, consultarCed
src/hooks/useContribuyente.js     — aeId, aeData, consultarAE
src/hooks/useFacturaElectronica.js — feXmlData, cabysValidation, consultarFe, XML handlers
src/hooks/useCabys.js             — (más complejo: 15 estados + consultas)
```

**Resultado:** App.jsx pierde ~800 líneas de estado y lógica.  
App.jsx queda en ~450 líneas: solo shell, layout, navegación, y wiring de hooks.

---

### Fase 7: Páginas inline → componentes de página (estimado: 3h)

Las secciones JSX que están inline en App() se convierten en componentes:

```
src/pages/CabysPage.jsx           (recibe del hook useCabys)
src/pages/HomePage.jsx            (recibe activities, homeFavs, navigate...)
src/pages/FacturaPage.jsx         (recibe del hook useFacturaElectronica)
src/pages/ContribuyentePage.jsx   (recibe del hook useContribuyente)
src/pages/CedulasPage.jsx         (recibe del hook useCedulas)
src/pages/ExoneracionesPage.jsx   (recibe del hook useExoneraciones)
src/pages/TipoCambioPage.jsx      (recibe del hook useTipoCambio)
```

**Resultado final:** App.jsx queda en ~200 líneas: imports, shell, layout, router por estado, wiring.

---

## Resultado proyectado

| Fase | App.jsx al final | Reducción |
|------|-----------------|-----------|
| Inicio | 3.529 líneas | — |
| Fase 1 | ~2.900 líneas | −629 |
| Fase 2 | ~2.820 líneas | −80 |
| Fase 3 | ~2.250 líneas | −570 |
| Fase 4 | ~2.000 líneas | −250 |
| Fase 5 | ~1.250 líneas | −750 |
| Fase 6 | ~450 líneas | −800 |
| Fase 7 | ~200 líneas | −250 |
| **Total** | **~200 líneas** | **−94%** |

---

## Estructura de carpetas final propuesta

```
src/
  App.jsx                    ~200 líneas (shell + wiring)
  App.css                    (sin cambios — CSS queda centralizado)
  main.jsx
  constants/
    icons.js                 IC, ACT_ICONS, ACT_LABELS, HUB_CARDS, CABYS_SUGERENCIAS
  utils/
    format.js                formatFechaCR, relTime, taxClass, toCsv, downloadBlob, etc.
    cabys.js                 cabysEsServicio, getCabysHierarchy, CABYS_CAT*
    search.js                restoreAccents, ACCENT_MAP, matchAe, AE_MAP, etc.
    xmlParser.js             parseXmlFe
    storage.js               loadFavs, loadClients, appendAct, etc.
    api.js                   fetchJsonSafe, checkApiStatus
    # taxKb.js y normalizeGometa: eliminados en V2.0
  hooks/
    useCopyFlash.js
    useActivityLog.js
    useCabys.js
    useContribuyente.js
    # useCedulas.js: eliminado en V2.0 (módulo GoMeta removido)
    useFacturaElectronica.js
    useTipoCambio.js
    useExoneraciones.js
  components/
    ui/
      index.js               Skeleton, CopyBtn, EmptyState, PageHeader, SortableTH, CopyIco, etc.
    cabys/
      CabysCard.jsx
      CabysDrawer.jsx
    contribuyente/
      FichaContribuyente.jsx
    factura/
      XmlFacturaResult.jsx
    tipocambio/
      ConversorWise.jsx
      TcSparkline.jsx
      CurrencySelector.jsx
    CommandPalette.jsx
  pages/
    HomePage.jsx
    CabysPage.jsx
    ContribuyentePage.jsx
    CedulasPage.jsx
    TipoCambioPage.jsx
    FacturaPage.jsx
    ExoneracionesPage.jsx
    Calculadora.jsx
    Clientes.jsx
    Asistente.jsx
    Acerca.jsx
```

---

## Advertencias y riesgos

### Riesgo 1: `consultarCabysRef`
Esta ref es compartida entre 5+ módulos. Actualmente vive en App() y se actualiza con `useEffect`. Al extraer `useCabys`, la ref debe seguir siendo accesible desde App para pasarla a los módulos que la necesiten. **Solución:** el hook expone la ref como parte de su API (`return { ..., consultarCabysRef }`).

### Riesgo 2: `cabysF_avs` compartido
Los favoritos CABYS son estado global real. Viven en App() hoy. Al modularizar, los hooks `useCabys` y `ClientesPage` y `CabysDrawer` lo necesitan.  
**Opción recomendada:** mantener en App() como estado "global", pasarlo como prop. No introducir Context en estas fases.

### Riesgo 3: CSS centralizado
`App.css` tiene todos los estilos. **No modularizar el CSS en estas fases** — el riesgo de breaking changes en clases es alto y el beneficio es bajo. Puede hacerse en una fase independiente posterior con CSS Modules o similar.

### Riesgo 4: Fases 6 y 7 son las más peligrosas
Las fases 1–5 son mecánicas y seguras. La fase 6 (hooks) requiere entender exactamente qué estado depende de qué. **Recomendación:** hacer las fases 1–5 primero, tomar base de código estable, luego planificar fase 6 con fresh analysis.
