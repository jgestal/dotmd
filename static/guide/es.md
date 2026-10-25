# Guía de Markdown

Todo lo que entiende DotMD, en una página. A la izquierda lo que escribes; a la derecha, el resultado.

<!-- toc -->
<!-- tocstop -->

## Texto

**Negrita**, *cursiva*, ~~tachado~~, ==resaltado== y `código en línea`.
Para separar párrafos deja una línea en blanco.

## Títulos

# Título
## Sección
### Subsección

## Listas

- Un elemento
- Otro
  - Anidado con dos espacios

1. Primero
2. Segundo

- [x] Una tarea hecha (haz clic en ella en modo Lectura)
- [ ] Una tarea pendiente

## Enlaces e imágenes

[Un enlace](https://example.com) · [Otra nota](notas/otra.md) · <https://example.com>

![Descripción de la imagen](assets/foto.png)

Pega o arrastra una imagen mientras editas: se copia en `assets/`, junto al documento.

## Citas y avisos

> Una cita.

> [!NOTE]
> Información útil.

> [!TIP]
> Un consejo.

> [!WARNING]
> Cuidado con esto.

## Tablas

| Nombre | Hecho | Precio |
|:-------|:-----:|-------:|
| Papel  |   ✓   |   4,50 |
| Tinta  |       |  12,00 |

Formato → Alinear columnas de la tabla (⌘⇧T) las ordena.

## Código

```python
def hola(nombre):
    return f"¡Hola, {nombre}!"
```

## Diagramas y matemáticas

```mermaid
flowchart LR
  Idea --> Borrador --> Libro
```

Matemáticas en línea $E = mc^2$ y en bloque:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

## Notas al pie

Una frase con nota.[^1]

[^1]: La nota, que aparece al final.

## Secciones plegables

<details>
<summary>Haz clic para abrir</summary>

Contenido oculto.

</details>

## Índice

Escribe `<!-- toc -->` y `<!-- tocstop -->` donde lo quieras y usa Formato → Insertar / actualizar índice (⌘⌥T).

## Saltos de página

<div class="page-break"></div>

Formato → Salto de página fuerza una página nueva en la vista de páginas y en los PDF.

## Diapositivas

Una línea con solo `---` empieza una diapositiva nueva; un párrafo que empiece por `Note:` lleva las notas del ponente. Presenta con ⌘⌥↩.

## Guion (hoja y formato Guion)

`#` título · `##` encabezado de escena · `###` personaje · `>` diálogo · `*(…)*` acotación · `####` transición.
