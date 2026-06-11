# Módulo: Asistente CABYS

**ID de página:** `cabys`  
**Estado:** Activo y completo

---

## Descripción

Permite buscar códigos CABYS (Clasificador de Actividades, Bienes y Servicios) del sistema tributario costarricense. El usuario describe su actividad, producto o servicio en lenguaje natural y el sistema consulta la API de Hacienda.

---

## Funcionalidades implementadas

### Búsqueda libre
- Input de texto → normalización con tildes (`restoreAccents`) → consulta `GET /hacienda/fe/cabys?q=...&top=50`
- Paginación local sobre los resultados (10 por página por defecto)
- Normalización de tildes: si el usuario escribe "medico" se convierte a "médico" antes de buscar

### Modo "Mi actividad económica"
- Input alternativo: el usuario pega la descripción de su actividad económica (CIIU)
- `extractAeTerms()` extrae hasta 5 palabras clave relevantes (filtra stop words)
- `matchAe()` detecta el sector más probable del mapa `AE_MAP` (24 entradas)
- Muestra banner con el CIIU detectado y su nombre oficial

### Vista cards (default)
- Componente `CabysCard`
- Muestra: código (monospace negro), nombre, categorías expandibles, badge IVA, badge Artículo/Servicio, botones de copia
- **Al hacer clic en la tarjeta** (fuera de botones): abre `CabysDrawer`
- Favorito por tarjeta: estrella toggle

### Vista tabla
- Columnas: Código, Descripción, Impuesto, Tipo, Copiar
- Ordenamiento por cualquier columna (ascendente/descendente)

### Drawer lateral (`CabysDrawer`)
- Se abre al clic en tarjeta
- Contenido: badges, título, código copiable, ruta de clasificación completa, descripción, acciones, relacionados
- Relacionados: ítems del mismo tipo (servicio/artículo) ya cargados en estado, sin fetch adicional
- ESC cierra el drawer
- Overlay oscuro, clic fuera cierra
- Mobile: bottom sheet (92dvh, slide-up)

### Favoritos
- Persistidos en `localStorage` con clave `hk_favs`
- Máximo 30 ítems
- Se muestran al entrar a la página si no hay búsqueda activa
- También se pueden agregar desde el drawer

### Exportaciones
- **CSV:** código, descripción, impuesto, tipo
- **XLSX:** mismas columnas

### Quick chips
- 10 sugerencias predefinidas (`CABYS_SUGERENCIAS`) debajo del input

---

## API utilizada

```
GET /hacienda/fe/cabys?q={query}&top={n}
→ Array de { codigo, descripcion, impuesto, categorias[] }
```

```
GET /hacienda/fe/cabys?codigo={codigo}
→ Array de { codigo, descripcion, impuesto, categorias[] }
(usado en validación XML, no en búsqueda)
```

---

## Clasificación Artículo / Servicio

Función `cabysEsServicio(codigo)`:
- Primer dígito `8` o `9` → **Servicio**
- Cualquier otro → **Artículo**

Esta clasificación está basada en el esquema del CABYS de Hacienda donde los capítulos 8x y 9x corresponden a servicios.

---

## Estado local relevante

```js
cabysQ          // texto del input
cabysData[]     // todos los resultados cargados
cabysPage       // página actual (0-indexed)
cabysSort       // { col, dir }
cabysView       // "cards" | "table"
cabysSearched   // boolean — si ya se hizo al menos una búsqueda
cabysNorm       // query normalizada con tildes (para mostrar al usuario)
cabysAeMatch    // { ciiu, label, q } | null — sector detectado en modo AE
cabysF_avs[]    // favoritos (de localStorage)
selectedCabys   // null | item — drawer abierto
```

---

## Limitaciones conocidas

- Sin paginación real contra la API: se piden hasta 50 resultados por búsqueda, la paginación es local sobre ese set
- `AE_MAP` tiene 24 sectores hardcodeados — no cubre todos los CIIU de Hacienda
- El mapa de tildes `ACCENT_MAP` es manual y puede estar incompleto para términos poco frecuentes
