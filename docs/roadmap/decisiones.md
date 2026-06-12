# Decisiones de diseño y desarrollo

Inferidas del código fuente. Fuente de verdad: implementación actual.

---

## Decisiones de arquitectura

### D-001: Archivo monolítico
**Decisión:** mantener todo en `src/App.jsx` (~3100 líneas en V2.0)  
**Contexto:** proyecto de un solo desarrollador, sin necesidad de separación por equipos  
**Consecuencia:** navegación compleja pero zero overhead de imports/módulos  
**Estado:** activo

### D-002: Sin backend propio
**Decisión:** usar Vercel Rewrites como proxy para todas las APIs externas  
**Contexto:** evitar CORS y costos de servidor propio  
**Consecuencia:** toda la lógica es client-side; los datos no se procesan en servidor  
**Estado:** activo — `vercel.json` crítico

### D-003: Sin TypeScript
**Decisión:** JavaScript puro  
**Evidencia:** `package.json` no incluye TypeScript, ningún archivo `.ts`  
**Consecuencia:** sin type-checking estático  
**Estado:** activo

### D-004: Sin router externo
**Decisión:** navegación por estado `page` string en lugar de React Router  
**Evidencia:** `page === "cabys"`, `navigate("contribuyente")`  
**Consecuencia:** no hay URLs por página, el back del browser no funciona como navegación  
**Estado:** activo

### D-005: Sin estado global
**Decisión:** `useState` local en el componente App raíz, props drilling hacia abajo  
**Evidencia:** no hay Context, Redux, Zustand ni similar  
**Consecuencia:** el árbol de props puede ser extenso en componentes profundos  
**Estado:** activo

---

## Decisiones de producto

### D-010: No validar Artículo vs Servicio como error
**Decisión:** mostrar "Verificar tipo" como badge ámbar informativo, no como error que afecte el resumen  
**Contexto:** auditoría de junio 2025 determinó que la lógica generaba demasiados falsos positivos. Caso típico: médicos facturan con `Sp` (unidad de servicio) pero el CABYS de ciertos insumos médicos inicia en 4 (artículo). Es correcto en ese contexto.  
**Estado:** activo — **no revertir sin nueva auditoría**

### D-011: 404 de Contribuyente como estado neutro
**Decisión:** HTTP 404 en `/ae?identificacion=X` → mostrar "No se encontró contribuyente" en EmptyState, no en AlertBox rojo  
**Contexto:** el 404 es un resultado esperado y válido, no un error del sistema  
**Estado:** activo

### D-012: Soporte DIMEX (9–12 dígitos)
**Decisión:** ampliar `isValidAeId` para aceptar hasta 12 dígitos  
**Contexto:** los DIMEX de 12 dígitos eran rechazados por la validación original (9 dígitos). Los DIMEX tributan en Hacienda aunque no aparezcan en el TSE.  
**Estado:** activo

### D-013: Drawer lateral en lugar de modal o navegación
**Decisión:** al hacer clic en una tarjeta CABYS, abrir panel lateral sin abandonar la búsqueda  
**Contexto:** el usuario debe poder explorar detalles sin perder el contexto de búsqueda  
**Implementación:** `CabysDrawer` — reutilizable, integrado también con el Validador XML  
**Estado:** activo

### D-014: Relacionados sin fetch adicional
**Decisión:** la sección "También podrían interesarte" en el drawer usa únicamente los ítems ya cargados en memoria  
**Contexto:** evitar llamadas a API adicionales que aumenten latencia y costos  
**Consecuencia:** los relacionados solo aparecen cuando hay resultados de búsqueda previos  
**Estado:** activo

### D-015: Chat / Asistente IA eliminado en V2.0
**Decisión:** módulo `TaxAssistantPage` y `TAX_KB` eliminados  
**Contexto:** base de conocimientos local limitada, sin valor diferencial respecto al enfoque XML  
**Estado:** eliminado — no reintroducir

### D-016: Parser XML propio
**Decisión:** usar `DOMParser` nativo del browser en lugar de una librería XML  
**Contexto:** evitar dependencias; `DOMParser` está disponible en todos los browsers modernos  
**Consecuencia:** el parser es más frágil ante XMLs malformados pero sin costo de bundle  
**Estado:** activo

### D-017: `CopyIco` como componente global
**Decisión:** mover `CopyIco` fuera de `XmlFacturaResult` a scope global  
**Contexto:** el bug de junio 2025 donde `ReferenceError: CopyIco is not defined` tumbó la app al abrir el drawer. Estaba definido localmente dentro de `XmlFacturaResult`.  
**Estado:** activo — no redefinir localmente

---

## Decisiones pendientes / abiertas

### DP-001: Unificar `XML_SVC_UNITS`
**Problema:** la constante está definida dos veces en `XmlFacturaResult` (`BANNER_SVC_UNITS` y `XML_SVC_UNITS`)  
**Acción sugerida:** extraer a constante global antes de los componentes  
**Prioridad:** baja

### DP-002: Reset de `soloInconsistencias` al cargar nuevo XML
**Problema:** el toggle puede quedar activo cuando se carga un segundo XML que no tiene inconsistencias, generando confusión (tabla aparece vacía)  
**Acción sugerida:** resetear a `false` en el `useEffect` de `feXmlData`  
**Prioridad:** media

### DP-003: Separación en módulos
**Problema:** `App.jsx` tiene ~3100 líneas  
**Acción sugerida:** evaluar separación progresiva por página en archivos independientes  
**Bloqueo:** requiere decisión de arquitectura y tiempo de refactor  
**Prioridad:** media a largo plazo

### DP-004: ~~Calculadora IVA incompleta~~
**Estado:** eliminado en V2.0 — módulo completo removido

### DP-005: Integración Drawer CABYS con Validador XML
**Estado:** resuelto en V1.1 — el drawer se abre al hacer clic en cualquier código CABYS validado en la tabla del XML
