# Markdown guide

Everything DotMD understands, on one page. The left side is what you type, the right side what you get.

<!-- toc -->
<!-- tocstop -->

## Text

**Bold**, *italic*, ~~strikethrough~~, ==highlight== and `inline code`.
A line break needs an empty line between paragraphs.

## Headings

# Title
## Section
### Subsection

## Lists

- An item
- Another one
  - Nested with two spaces

1. First
2. Second

- [x] A done task (click it in Read mode)
- [ ] A pending task

## Links and images

[A link](https://example.com) · [Another note](notes/other.md) · <https://example.com>

![Description of the image](assets/picture.png)

Paste or drop an image while editing: it is copied to `assets/` next to the document.

## Quotes and callouts

> A quote.

> [!NOTE]
> Useful information.

> [!TIP]
> A helpful hint.

> [!WARNING]
> Careful with this.

## Tables

| Name  | Done | Price |
|:------|:----:|------:|
| Paper |  ✓   |  4.50 |
| Ink   |      | 12.00 |

Format → Align table columns (⌘⇧T) tidies them up.

## Code

```python
def hello(name):
    return f"Hello, {name}!"
```

## Diagrams and maths

```mermaid
flowchart LR
  Idea --> Draft --> Book
```

Inline maths $E = mc^2$ and a block:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

## Footnotes

A sentence with a note.[^1]

[^1]: The note itself, shown at the end.

## Collapsible sections

<details>
<summary>Click to open</summary>

Hidden content.

</details>

## Table of contents

Put `<!-- toc -->` and `<!-- tocstop -->` where you want it, then Format → Insert / update table of contents (⌘⌥T).

## Page breaks

<div class="page-break"></div>

Format → Page break forces a new page in page view and PDFs.

## Slides

A line with only `---` starts a new slide; a paragraph beginning with `Note:` holds the speaker notes. Present with ⌘⌥↩.

## Screenplay (Screenplay sheet and format)

`#` title · `##` scene heading · `###` character · `>` dialogue · `*(…)*` parenthetical · `####` transition.
