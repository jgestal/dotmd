# DotMD — Plan del proyecto

Visor y editor de Markdown multiplataforma (macOS, Windows, Linux). Objetivos: **sensación nativa**, **máxima velocidad** y **muy personalizable**.

---

## 1. Tecnología (decidida)

| Pieza | Elección | Por qué |
|---|---|---|
| Contenedor | **Tauri 2** (Rust) | Usa el motor web del sistema: app pequeña, arranque rápido, menús y diálogos nativos |
| Interfaz | **Svelte 5** + TypeScript + Vite | Compila a JS mínimo, sin runtime pesado |
| Markdown → HTML | **comrak** (Rust) | GFM completo + notas al pie, avisos, fórmulas, front matter, `==resaltado==`, números de línea de origen |
| Editor de código | **CodeMirror 6** | Muy rápido con archivos grandes; resaltado de Markdown, búsqueda |
| Editor visual (WYSIWYG) | **Milkdown Crepe** (ProseMirror) | Editar directamente sobre el documento formateado; se carga solo al usarlo |
| Diagramas / fórmulas / código | Mermaid (carga diferida), KaTeX, highlight.js | Coloreados con el tema activo |
| Vigilancia de archivos | `notify` (Rust) | Recarga en vivo |
| PDF | Chrome / Edge / Brave / Chromium sin interfaz | Mismo resultado en los 3 sistemas. Si no hay ninguno → diálogo de impresión. *(Fase 7: PDF nativo del webview, sin depender de un navegador)* |

### Cómo arrancar

```bash
npm install
npm run tauri dev      # desarrollo
npm run tauri build    # instalador de release
```

---

## 2. Estado de la versión 0.1 ✅

Ya funciona (verificado con capturas automáticas en un navegador sin interfaz + pruebas de Rust):

- [x] Barra lateral de carpetas (carga por niveles, filtro, archivos ocultos excluidos), ocultable (⌘\), redimensionable, a izquierda o derecha.
- [x] Pestaña **Índice** (TOC) con los encabezados; clic → salta en lectura o en el editor.
- [x] Menú contextual **nativo** en el árbol: abrir, nuevo archivo, renombrar, exportar a PDF/HTML, mostrar en Finder, copiar ruta.
- [x] Arrastrar y soltar archivos y carpetas (con indicador de zona). Abrir desde la línea de comandos y desde "Abrir con…" de macOS.
- [x] **4 modos**: Leer · Código (texto en bruto, `.md` y `.txt`) · Dividido (con scroll sincronizado) · Visual (WYSIWYG). ⌘1–4, ⌘E alterna lectura/edición.
- [x] **Barra de formato**: títulos H1–H6, negrita, cursiva, tachado, resaltado, código, cita, listas, tareas, enlace, imagen (diálogo nativo + ruta relativa), **selector visual de tabla en cuadrícula**, **alinear columnas de tabla**, bloque de código por lenguaje, plantillas Mermaid (10 tipos), fórmula, avisos de GitHub, separador, nota al pie, sección plegable y fecha.
- [x] Atajos: ⌘B/I, ⌘K enlace, ⌘⇧X tachado, ⌘⇧H resaltado, ⌘⌥1–6 títulos, ⌘⇧T alinear tabla, ⌘F buscar/reemplazar.
- [x] Vista previa: GFM, tablas, tareas **clicables** (escriben en el archivo), avisos, notas al pie, front matter como ficha, Mermaid, KaTeX, código coloreado con botón copiar, enlaces entre `.md`, anclas.
- [x] **Recarga en vivo** cuando otro programa cambia el archivo (con aviso si hay cambios sin guardar).
- [x] Guardado atómico, guardar como, autoguardado opcional, confirmación al cerrar con cambios.
- [x] **Estadísticas bajo el documento**: palabras, caracteres, sin espacios, letras, frases, párrafos, líneas, lectura, oratoria, selección, palabras de la sesión. Cada una se activa o desactiva por separado. Panel ampliado con **legibilidad** (Flesch en inglés, Fernández-Huerta en español, detectado automáticamente) y **objetivo de palabras con anillo de progreso**.
- [x] **Modo zen**: pantalla completa, sin interfaz, **resaltado de concentración** (línea / frase / párrafo), **desplazamiento de máquina de escribir**, **sonidos de tecleo sintetizados** (máquina de escribir con campana, teclado mecánico, suave).
- [x] **11 temas**: Automático, Modern, Modern Dark, GitHub, Paper, **Typewriter** (textura de papel, tinta irregular, cursor de bloque), **CRT Phosphor** y **CRT Amber** (líneas de barrido, brillo, parpadeo, viñeta de tubo, cursor parpadeante), Nord, Solarized, Dracula, Alto contraste.
- [x] **Muy personalizable**: color de acento, fuentes de texto/títulos/código (10 incluidas, sin conexión), tamaño, interlineado, ancho, espacio entre párrafos, justificado, guionado, efectos de cada tema y CSS propio.
- [x] **Idiomas**: inglés (por defecto) y español.
- [x] **Exportación**: HTML autocontenido (imágenes en base64, Mermaid como SVG, fórmulas en MathML) y PDF. **En lote** con selección de archivos, varios formatos, **unir en uno solo**, índice opcional, carpeta de salida que conserva la estructura, tamaño de página, márgenes, tema de exportación, progreso y cancelación.
- [x] Restaura la última carpeta y el último archivo; lista de recientes en la pantalla de bienvenida.

---

## 3. Investigación: qué hacen los mejores

| App | Lo que la distingue | Idea que tomamos |
|---|---|---|
| **Typora** | Edición en vivo sin separar código y vista previa | Modo Visual ✅; modo "Live" estilo Obsidian (ver F11) |
| **iA Writer** | Modo concentración por frase o párrafo, máquina de escribir, **resaltado de sintaxis gramatical** (adjetivos, verbos…), **Style Check** (muletillas, redundancias), **seguimiento de autoría** (texto propio frente a pegado o de IA) | Concentración ✅, máquina de escribir ✅, F12-01 a F12-04 |
| **Marked 2** | Recarga en vivo, **resaltado de palabras repetidas**, lista de **palabras a evitar**, voz pasiva, legibilidad, objetivo de palabras | Recarga ✅, legibilidad ✅, objetivo ✅, F12-05 a F12-07 |
| **Obsidian** | Enlaces `[[wiki]]`, backlinks, grafo, plugins | F13 |
| **Ulysses / Scrivener** | Objetivos por sesión y por fecha límite, notas al margen, compilar varios archivos en un libro | F12-08, "unir en uno" ✅ |
| **Zettlr** | Citas académicas (Zotero/BibTeX), notas al pie | F13-05 |
| **Focused / Hemingway Typewriter** | Modo "solo hacia delante" (sin borrar), sonidos ambientales | F12-09, F12-10 |
| **Zoho Writer** | Párrafo actual nítido y el resto difuminado | Concentración ✅ |

---

## 4. Ideas nuevas para el plan

### ⭐ Funciones estrella (mayor impacto)
1. **Modo "Live"** como Obsidian: en el editor de código, ocultar `**`, `#`, `[]()` salvo en la línea del cursor. El Markdown no se reescribe (a diferencia del modo Visual) y se ve casi formateado.
2. **Paleta de comandos (⌘⇧P) y apertura rápida (⌘P)** con búsqueda difusa.
3. **Búsqueda en toda la carpeta** con el motor de ripgrep y resultados en tiempo real.
4. **Pestañas** y restauración completa de la sesión.
5. **Pegar imágenes** desde el portapapeles → se guardan en `assets/` y se inserta el enlace.
6. **Historial de versiones local**: una instantánea en cada guardado y una línea de tiempo para comparar y recuperar.

### ✍️ Para escritores (lo que diferencia de un simple visor)
- **Resaltado gramatical** al estilo iA: colorear adjetivos, verbos, adverbios… (con un diccionario ligero en español e inglés).
- **Revisión de estilo**: muletillas, palabras de relleno, frases largas, voz pasiva, **palabras repetidas cercanas** (subrayado por proximidad).
- **Palabras vigiladas** por documento (como el cajón de Marked).
- **Objetivo con fecha límite**: "50.000 palabras para el 30 de noviembre" → cuántas palabras al día.
- **Racha diaria** y mapa de calor de palabras escritas por día.
- **Modo "solo hacia delante"** (sin borrar), para borradores rápidos.
- **Sonidos ambientales** en zen (lluvia, cafetería, ruido marrón) generados al momento.
- **Temporizador Pomodoro** integrado en la barra de estadísticas.
- **Leer en voz alta** (síntesis de voz del sistema) para revisar el texto.

### 🎛️ Controles gráficos poco comunes
- **Minimapa del documento** con los títulos como marcas, y "calor" de dónde editaste.
- **Selector de tabla en cuadrícula** ✅ y **editor de tablas visual** (arrastrar columnas, alinear con un clic, ordenar por columna).
- **Diales de tipografía en vivo** sobre el propio documento (tamaño, interlineado, ancho) en un panel flotante.
- **Regla de ancho**: arrastrar los bordes del texto para cambiar el ancho de columna.
- **Anillo de objetivo** ✅ y **barra de progreso de lectura** fina en la parte superior.
- **Selector de color de acento con cuentagotas** de la pantalla.
- **Previsualización de enlaces e imágenes al pasar el ratón**.
- **Visor de imágenes** con zoom al hacer clic.
- **Línea de tiempo de versiones** con un deslizador para "viajar" por el historial.
- **Editor de Mermaid en vivo** con el diagrama al lado y plantillas.

### 🎨 Personalización y temas
- Más temas: **Terminal ámbar 80×25**, **Sepia nocturno**, **Pizarra**, **Manuscrito**, **Papel milimetrado**, **Solarized Dark**, **Gruvbox**, **Catppuccin**.
- **Editor de temas** con vista previa e **importar/exportar** temas en JSON.
- **Tema distinto para día y noche** según la hora del sistema.
- **Fuentes del usuario** (elegir cualquier fuente instalada).
- **Perfiles** de ajustes ("Escritura", "Lectura", "Presentación") que se cambian con un clic.
- Modo **daltónico** para avisos y resaltado.

### 📤 Exportación y publicación
- **PDF nativo** del webview, sin depender de un navegador instalado.
- Cabecera y pie con número de página, título y fecha; portada opcional.
- **DOCX / EPUB / ODT** vía Pandoc si está instalado.
- **Copiar como HTML con formato** (para pegar en Gmail o Google Docs).
- **Presentación**: diapositivas separadas por `---`.
- Exportar con las **fuentes incrustadas** (hoy el HTML usa las del sistema).
- Plantillas de exportación (académica, carta, informe).

### 🗂️ Organización
- Enlaces `[[wiki]]`, backlinks y grafo.
- Etiquetas `#tag` desde el front matter.
- Favoritos y carpetas recientes.
- Indicadores de **git** en el árbol (modificado, nuevo).
- Mover archivos arrastrando dentro del árbol; papelera del sistema.

### 🖥️ Integración con el sistema
- **Barra de menús nativa** completa (Archivo, Editar, Ver, Formato…).
- Menú del Dock con recientes y **Quick Look** para `.md` en macOS.
- Herramienta de terminal: `dotmd archivo.md` y `dotmd export docs/*.md --pdf`.
- Actualizaciones automáticas, firma y notarización.
- Más idiomas: francés, alemán, portugués, italiano.

---

## 5. Mini tareas pendientes

Cada tarea tiene su issue en GitHub (número entre paréntesis), agrupadas por milestone: https://github.com/jgestal/dotmd/milestones

Cada tarea está pensada para una sesión corta (½–2 h) y deja algo verificable.

### Sonidos — Modo máquina de escribir
- [ ] S-01 Pack de sonidos CC0 (Freesound): teclas, espaciadora, retroceso, retorno de carro y campana, recortados y normalizados. (#1)
- [ ] S-02 Motor de muestras: variantes aleatorias, tono y volumen variables, panorama estéreo según la tecla. (#2)
- [ ] S-03 Campana al llegar a la columna configurada y sonido de retorno de carro con Enter. (#3)
- [ ] S-04 Preset "Modo máquina de escribir" de un clic (tema, sonido, scroll, cursor, campana). (#4)
- [ ] S-05 Créditos de los sonidos en el README y en Ajustes. (#5)

### Fase 7 — Robustez de la 0.1
- [ ] F7-01 Probar a mano en la app real: arrastrar y soltar, recarga en vivo, cierre con cambios, menú contextual, diálogos nativos, sonidos y PDF desde el diálogo. (#6)
- [ ] F7-02 Compilar y probar en Windows (WebView2) y Linux (WebKitGTK); ajustar fuentes y barra de título. (#7)
- [ ] F7-03 Modo Visual: mantener `==resaltado==` y los avisos `[!NOTE]` sin perderlos al guardar. (#8)
- [ ] F7-04 Scroll sincronizado en ambos sentidos (vista previa → editor). (#9)
- [ ] F7-05 Divisor arrastrable en el modo dividido. (#10)
- [ ] F7-06 PDF nativo: macOS `WKWebView.createPDF`, Windows `PrintToPdf`, Linux `WebKitPrintOperation`. (#11)
- [ ] F7-07 Incrustar en el HTML exportado las fuentes del tema elegido. (#12)
- [ ] F7-08 Icono propio de la app. (#13)
- [ ] F7-09 Pruebas automáticas: pruebas de Rust para el renderizado y Playwright para la interfaz en CI. (#14)

### Fase 8 — Productividad
- [ ] F8-01 Pestañas (abrir, cerrar, reordenar, ⌘W, ⌃Tab). (#15)
- [ ] F8-02 Apertura rápida ⌘P (búsqueda difusa con `nucleo` en Rust). (#16)
- [ ] F8-03 Paleta de comandos ⌘⇧P. (#17)
- [ ] F8-04 Búsqueda en la carpeta (`grep-searcher`) con resultados en streaming. (#18)
- [ ] F8-05 Pegar o arrastrar una imagen al editor → `assets/` + enlace. (#19)
- [ ] F8-06 Historial atrás/adelante (⌘[ / ⌘]). (#20)
- [ ] F8-07 Mover archivos arrastrando en el árbol y borrar a la papelera (`trash`). (#21)
- [ ] F8-08 Barra de menús nativa con todos los comandos. (#22)

### Fase 9 — Escritura avanzada
- [ ] F9-01 Modo "Live" (ocultar la sintaxis fuera de la línea del cursor). (#23)
- [ ] F9-02 Resaltado de palabras repetidas cercanas. (#24)
- [ ] F9-03 Lista de palabras vigiladas por documento. (#25)
- [ ] F9-04 Revisión de estilo: frases largas, muletillas, voz pasiva (ES/EN). (#26)
- [ ] F9-05 Resaltado gramatical por tipo de palabra. (#27)
- [ ] F9-06 Objetivo con fecha límite y racha diaria (mapa de calor). (#28)
- [ ] F9-07 Pomodoro en la barra de estadísticas. (#29)
- [ ] F9-08 Modo "solo hacia delante". (#30)
- [ ] F9-09 Sonidos ambientales en zen. (#31)
- [ ] F9-10 Leer en voz alta. (#32)

### Fase 10 — Controles gráficos
- [ ] F10-01 Minimapa con marcas de títulos. (#33)
- [ ] F10-02 Editor de tablas visual (arrastrar columnas, ordenar). (#34)
- [ ] F10-03 Panel flotante de tipografía en vivo. (#35)
- [ ] F10-04 Previsualización al pasar el ratón por enlaces e imágenes; visor con zoom. (#36)
- [ ] F10-05 Barra fina de progreso de lectura. (#37)
- [ ] F10-06 Editor de Mermaid en vivo. (#38)

### Fase 11 — Personalización
- [ ] F11-01 Editor de temas con importar/exportar JSON. (#39)
- [ ] F11-02 Temas nuevos (Gruvbox, Catppuccin, Solarized Dark, Pizarra, Manuscrito). (#40)
- [ ] F11-03 Tema de día y de noche automáticos. (#41)
- [ ] F11-04 Fuentes instaladas en el sistema. (#42)
- [ ] F11-05 Perfiles de ajustes. (#43)

### Fase 12 — Exportación avanzada
- [ ] F12-01 Cabecera y pie con números de página; portada. (#44)
- [ ] F12-02 Copiar como HTML con formato. (#45)
- [ ] F12-03 DOCX / EPUB vía Pandoc. (#46)
- [ ] F12-04 Modo presentación. (#47)
- [ ] F12-05 Plantillas de exportación. (#48)

### Fase 13 — Organización
- [ ] F13-01 Enlaces `[[wiki]]` y backlinks. (#49)
- [ ] F13-02 Etiquetas. (#50)
- [ ] F13-03 Indicadores git en el árbol. (#51)
- [ ] F13-04 Grafo de notas. (#52)
- [ ] F13-05 Citas con BibTeX/Zotero. (#53)

### Fase 14 — Distribución
- [ ] F14-01 Instaladores: `.dmg` universal, `.msi`, `.AppImage`/`.deb`/`.rpm` (CI en GitHub Actions). (#54)
- [ ] F14-02 Firma y notarización (macOS), firma (Windows). (#55)
- [ ] F14-03 Actualizaciones automáticas. (#56)
- [ ] F14-04 CLI `dotmd`. (#57)
- [ ] F14-05 Extensión de Quick Look. (#58)
- [ ] F14-06 Más idiomas. (#59)

---

## 6. Estructura del código

```
src-tauri/src/
  lib.rs        arranque, comandos, apertura desde el SO
  markdown.rs   comrak (Markdown → HTML)
  fs.rs         leer/escribir (atómico), listar carpetas, árbol recursivo, imágenes a base64
  watch.rs      recarga en vivo (notify)
  export.rs     escritura de HTML y PDF con Chromium sin interfaz
src/lib/
  state.svelte.ts       ajustes, sesión y estado de la app (persisten en localStorage)
  themes.ts             temas como datos (se reutilizan en app, Mermaid y exportación)
  appearance.svelte.ts  aplica tema, fuentes y efectos
  i18n.ts               textos en inglés y español
  stats.ts              estadísticas y legibilidad
  render.ts             post-proceso: imágenes, KaTeX, Mermaid, resaltado
  export.ts             documento HTML autocontenido
  exportRequest.svelte.ts  exportación individual y en lote
  editor/source.ts      CodeMirror + concentración + máquina de escribir + comandos de formato
  editor/visual.ts      Milkdown (WYSIWYG)
  sound.ts              sonidos de tecleo sintetizados
  components/           interfaz (barra lateral, toolbar, preview, ajustes, exportar…)
```

### Fuentes de la investigación
- [Best markdown editors 2026 (unmarkdown)](https://unmarkdown.com/blog/best-markdown-editors-2026)
- [Typora vs Obsidian (AFFiNE)](https://affine.pro/blog/typora-vs-obsidian)
- [iA Writer — Focus Mode](https://ia.net/writer/support/editor/focus-mode) · [iA Writer](https://ia.net/writer)
- [Obsidian — Typewriter Mode plugin](https://community.obsidian.md/plugins/typewriter-mode) · [Hemingway Typewriter](https://community.obsidian.md/plugins/hemingway-typewriter)
- [Focused — Minimal Markdown App](https://waerfa.com/focused-minimal-markdown-app)
- [Marked 2 review (Macworld)](https://www.macworld.com/article/223783/marked-2-review-preview-and-improve-your-online-writing-on-the-fly.html) · [Better stats in Marked 2](https://brettterpstra.com/2019/03/12/get-better-stats-for-your-writing-with-marked-2/)
- [Zoho Writer — distraction-free writing](https://help.zoho.com/portal/fr/community/topic/tip-2-the-road-to-distraction-free-writing?page=15)
