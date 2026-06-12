# Auditoría: Validación XML — Junio 2025

**Fecha:** Junio 2025  
**Módulo:** Validador XML  
**Resultado:** Cambios de comportamiento implementados

---

## Contexto

Se implementó la validación de tipo (Artículo vs Servicio) en el Validador XML usando la unidad de medida del campo `UnidadMedida` para inferir si la línea es un servicio, y compararlo contra la clasificación del código CABYS.

## Problema detectado

La validación generaba **demasiados falsos positivos**. Caso documentado: médicos que facturan insumos médicos con:
- `UnidadMedida`: `Sp` (Servicios Profesionales)
- Código CABYS: `48171019999900` (primer dígito `4` → artículo)

El sistema marcaba esto como "tipo inconsistente" aunque es correcto tributariamente. El médico usa `Sp` por convención de su software de facturación, no necesariamente porque el CABYS sea un servicio.

## Decisión

No implementar la validación de tipo como **error**. Solo mostrar como **aviso informativo** con badge ámbar "Verificar tipo" y tooltip explicativo.

## Implementación resultante

```js
// Aviso: nunca false-positive agresivo
const tipoAviso = cvStatus === "ok"
  && cabysEsSvc !== null
  && xmlEsSvc !== null
  && cabysEsSvc !== xmlEsSvc

// Visual: badge ámbar, NO incluido en hasRowWarn (borde naranja de fila)
{tipoAviso && (
  <span className="xmlCabysValTipoAviso" title={`...`}>
    Verificar tipo
  </span>
)}
```

El conteo del resumen sí incluye estas líneas bajo "⚠ N verificar tipo" y las excluye del conteo de "correctas".

## Código eliminado en esta auditoría

- `XML_SVC_UNITS` duplicado como array independiente
- Clase CSS `.xmlRowWarn td { background: #fffbeb }` → reemplazada por borde izquierdo
- Badge rojo/naranja fuerte para mismatch de tipo

---

# Auditoría: CopyIco — Junio 2025

**Fecha:** Junio 2025  
**Módulo:** CabysDrawer  
**Resultado:** Bug crítico resuelto

## Problema

Al implementar `CabysDrawer`, se usó `<CopyIco />` asumiendo que era un componente global. Sin embargo estaba definido como función local dentro de `XmlFacturaResult`.

**Error en producción:** `ReferenceError: CopyIco is not defined`  
**Síntoma:** la app completa caía al abrir el drawer CABYS.

## Resolución

Mover `CopyIco` a scope global, antes de `CabysCard` (línea ~591 del archivo). Eliminar la definición local dentro de `XmlFacturaResult`.

## Regla establecida

`CopyIco` es un componente global. No redefinir localmente en ningún componente.

---

# Auditoría: Variable CSS --card — Junio 2025

**Fecha:** Junio 2025  
**Módulo:** CabysDrawer  
**Resultado:** Bug visual resuelto

## Problema

El fondo del `CabysDrawer` aparecía transparente. La causa: `background: var(--card)` donde `--card` no está definida en `:root`.

## Variables CSS disponibles en `:root`

Las variables semánticas definidas son: `--bg`, `--surface`, `--surface2`, `--border`, `--border2`, `--text`, `--text2`, `--muted`, `--accent`, `--accent-h`, `--good`, `--bad`, `--warn`.

`--card` NO existe.

## Resolución

Reemplazar todas las referencias a `var(--card)` con `var(--surface)` (`#FFFFFF`).

## Regla establecida

No usar `var(--card)`. Si se necesita fondo de tarjeta elevado, usar `var(--surface)` o `var(--surface2)`.
