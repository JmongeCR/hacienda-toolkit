import { useCallback, useRef, useState } from "react"
import { copyText } from "../utils/exportHelpers.js"

/**
 * Hook para feedback visual al copiar texto.
 * Devuelve { fl, flash } donde:
 *   fl    — id actualmente "copiado" (null si ninguno)
 *   flash — función para disparar el efecto: flash(id, textOrFn)
 */
export function useCopyFlash() {
  const [fl, setFl] = useState(null)
  const t = useRef({})
  const flash = useCallback(async (id, fn) => {
    const text = typeof fn === "function" ? await fn() : fn
    if (!await copyText(text)) return
    clearTimeout(t.current[id]); setFl(id)
    t.current[id] = setTimeout(() => setFl(f => f === id ? null : f), 1500)
  }, [])
  return { fl, flash }
}
