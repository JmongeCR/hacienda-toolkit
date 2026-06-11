# Módulo: Verificar Contribuyente

**ID de página:** `contribuyente`  
**Estado:** Activo y completo

---

## Descripción

Consulta el estado fiscal de un contribuyente costarricense usando la API de Hacienda. Muestra régimen tributario, actividades económicas, estado de morosidad y otros datos relevantes.

---

## Tipos de identificación aceptados

| Tipo | Longitud | Descripción |
|------|----------|-------------|
| Cédula física | 9 dígitos | Personas físicas costarricenses |
| Cédula jurídica | 10 dígitos | Empresas y sociedades |
| DIMEX | 11–12 dígitos | Extranjeros con documento migratorio |
| NITE | 10 dígitos | Número de identificación tributario especial |

Función de validación: `isValidAeId(s)` → acepta 9–12 dígitos.  
El input filtra automáticamente caracteres no numéricos con `onlyDigits()`.

---

## API utilizada

```
GET /hacienda/fe/ae?identificacion={numero}
→ Objeto contribuyente con nombre, régimen, actividades, estado
```

### Manejo de respuestas especiales

| Caso | Respuesta API | Manejo en UI |
|------|---------------|--------------|
| No encontrado | HTTP 404 | EmptyState neutro (no error rojo) |
| No encontrado | `{ code: 404 }` en body | EmptyState neutro |
| No encontrado | body con "not available" | EmptyState neutro |
| Error de servidor | HTTP 5xx | AlertBox rojo con mensaje |

---

## Componente `FichaContribuyente`

Renderiza el resultado completo con:
- Nombre y nombre comercial
- Cédula / identificación
- Régimen tributario (badges de color)
- Estado (moroso / al día)
- Listado de actividades económicas con código CIIU
- Botón "Buscar CABYS" por actividad → navega a cabys con la query de la actividad

---

## Integración con otros módulos

- **Desde Cédulas TSE:** si se busca un número de 11+ dígitos sin resultados en TSE, aparece sugerencia "¿Es un DIMEX?" con botón que navega a Contribuyentes y ejecuta la búsqueda automáticamente.
- **Desde FichaContribuyente:** botón por actividad económica que navega a CABYS y ejecuta búsqueda.

---

## Estado local relevante

```js
aeId        // string — input del usuario
aeData      // objeto resultado | null
aeError     // string — mensaje de error
aeLoading   // boolean
aeSearched  // boolean — si se hizo al menos una búsqueda
aeLastQ     // ref — última query ejecutada (para mensaje del empty state)
```

---

## Limitaciones conocidas

- La API de Hacienda no siempre retorna todos los campos documentados
- DIMEX no aparece en el TSE pero sí puede estar en Hacienda si tributa — el flujo de sugerencia desde Cédulas maneja esto
