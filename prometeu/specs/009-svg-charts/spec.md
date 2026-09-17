# Specification: SVG charts

Status: draft
Owner: João Moog

## Problem

The prototype draws every chart by concatenating SVG strings inside the editor
script, next to the data selection, the click handlers and the DOM updates. The
drawing cannot be reused by the presentation export, cannot be rendered on a
server, cannot be unit-tested without a browser, and every appearance key
(colours, fonts, toggles, unit, condition, target) is interpreted in three
slightly different places. The studio canvas, the assistant's before/after
preview and the HTML export all need the same eight drawings from the same
inputs, and finance users need them to read correctly with negative values,
missing comparisons and many categories, which the prototype only handles by
accident.

## Goal

Eight deterministic, accessible SVG renderers (column, bar, line, area, donut,
waterfall, indicator, table) that turn engine chart data plus a widget's
appearance keys into identical markup on the client and on the server, so the
canvas, the preview and the export draw the same picture.

## Out of scope

- The text, image, button and filter widgets; they are ordinary markup owned by
  011-widget-editing and 013-filters-and-interactions.
- Computing the numbers: selection, filter inheritance, grouping, sorting, top,
  aggregation, waterfall bridge arithmetic and conditional-colour decisions are
  defined in 003-query-engine; the renderers only draw what they receive.
- Number, currency and percent formatting rules, which are defined in
  002-domain-schema; the renderers call them.
- Animation, custom tooltips, zoom, brushing, or any interactivity beyond the
  browser's native hover title and the selection hook that
  013-filters-and-interactions attaches.
- The card chrome around a drawing that belongs to the canvas (drag handle,
  duplicate button, resize grip, selection outline) — 010-studio-canvas and
  012-layout-drag-resize.
- Packaging the static markup into an export file — 017-presentation-and-export.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-00901 | Ubiquitous | The chart module SHALL provide one renderer for each widget type `column`, `bar`, `line`, `area`, `donut`, `waterfall`, `kpi` and `table`, each accepting the widget's keys as defined in 002-domain-schema and the chart data computed as defined in 003-query-engine, and returning markup with no other input. |
| FR-00902 | Ubiquitous | Every renderer SHALL draw inside a shared frame that renders the title at `titleSize` px, the subtitle when it is not empty, and applies `padding`, `radius`, `border` with `borderColor`, `background`, `textColor`, `font` and `fontSize` to the card, so that two widgets with the same keys are visually identical regardless of type. |
| FR-00903 | Event | WHEN a column, bar, line or area widget has `comparison` other than `none` and `legendField` equal to `none`, the renderer SHALL draw two series: the value series in `color` and the comparison series in `comparisonColor`, named `Realizado`, `Orçamento`, `Registros` or the measure's name according to the key each one reads. |
| FR-00904 | State | WHILE `legendField` is a dimension, a column, bar, line or area renderer SHALL draw one series per distinct value of that dimension, at most 12 series, coloured in the order `color`, `comparisonColor`, `#078e97`, `#8b67c5`, `#bc833b`, `#7386a2` and cycling, with no comparison series. |
| FR-00905 | State | WHILE `axes` is on, a cartesian renderer SHALL draw five tick labels at 0, ¼, ½, ¾ and 1 of the value range, formatted as millions with one decimal and ` mi` when the range top is at least 1 000 000, as thousands with no decimal and ` mil` when it is at least 10 000, and as an integer otherwise, plus one category label per group, truncated to 16 characters followed by `…` when longer than 18 characters, and rendered as abbreviated pt-BR month and two-digit year when the dimension is `month`. |
| FR-00906 | State | WHILE `grid` is on, a cartesian renderer SHALL draw exactly one grid line per tick across the plot area (and none at all while it is off). |
| FR-00907 | State | WHILE `labels` is on and at most two series are drawn, a cartesian renderer SHALL write each mark's value next to it, using unit `mil` for absolute values of at least 10 000 and `mi` for at least 1 000 000 when `unit` is `auto`; with three or more series no value labels SHALL be drawn. |
| FR-00908 | State | WHILE `legend` is on, the renderer SHALL list every drawn series below the drawing with a colour swatch and its name, followed by `Meta: <target>` formatted with the widget's unit when `target` is not 0. |
| FR-00909 | Event | WHEN `target` is not 0 on a cartesian widget, the renderer SHALL draw a dashed target line in `#c07d32` at the target value and SHALL extend the value range so the target is inside the plot. |
| FR-00910 | Event | WHEN `condition` is `budget` or `target`, the renderer SHALL fill every first-series mark, table value cell, indicator value and donut slice whose value exceeds its comparison (for `budget`) or the `target` (for `target`) with `conditionColor` instead of `color`, leaving the other marks unchanged. |
| FR-00911 | Event | WHEN any value in the data is negative, a cartesian renderer SHALL place the zero baseline inside the plot, extend the range 15 % beyond the most negative value, and draw each mark from the baseline toward its value. |
| FR-00912 | Ubiquitous | The donut renderer SHALL draw one arc per group with a positive value, proportional to that value over the sum of positive values, the group labels with their percentage to one decimal when `labels` is on, and the formatted total at the centre, using unit `mil` when `unit` is `auto`. |
| FR-00913 | Ubiquitous | The waterfall renderer SHALL draw, when `comparison` is not `none`, a bridge from a first bar labelled with the comparison name through one floating bar per group (value minus comparison) to a last bar labelled with the value name, colouring decreases `#078e97`, increases `conditionColor` and the two end bars `color`, with the caption `Da comparação ao valor, por variação de cada grupo.`; and when `comparison` is `none`, a cumulative sum from zero to a bar labelled `Total` with the caption `Soma acumulada de <value name>`. |
| FR-00914 | Ubiquitous | The indicator renderer SHALL show the aggregated value formatted with the widget's unit, decimals and format, the value name below it, and `<comparison name>: <comparison value>` when `comparison` is not `none`, colouring the value by FR-00910's rule. |
| FR-00915 | Ubiquitous | The table renderer SHALL render one column per entry of `columns`, in that order, with headers `Mês`/`Área`/`Categoria` for `label`, the value and comparison names for `value` and `comparison`, and `Diferença` for `delta`, where `delta` is value minus comparison and shows `—` when the comparison is absent. |
| FR-00916 | Unwanted | IF the chart data has no groups, THEN every renderer SHALL show the text `Nenhum registro para estes filtros.` inside the frame and no drawing element. |
| FR-00917 | Unwanted | IF the donut receives no group with a positive value, THEN it SHALL show `A rosca precisa de valores positivos.` inside the frame and no arc. |
| FR-00918 | Unwanted | IF a value or comparison is absent or not a finite number, THEN the renderer SHALL skip that mark, print `—` wherever the number would be written, and still draw the remaining marks. |
| FR-00919 | Ubiquitous | Every drawing SHALL carry `role="img"` and an accessible name equal to the widget title, a `<title>` element on each mark reading `<label> · <series>: <value>`, and text that inherits the card's `textColor` and `fontSize`. |
| FR-00920 | Optional | WHERE a selection handler is supplied to a renderer, each mark SHALL be focusable, expose an accessible name `<label>: <value>` and call the handler with the group key on click, Enter or Space (without a handler no mark is focusable). |
| FR-00921 | Ubiquitous | The drawing SHALL fill the width of its container and keep the renderer's aspect ratio, with no dimension derived from the window or from an absolute pixel width, so the same markup is valid at any card span. |
| FR-00922 | Ubiquitous | Rendering the same widget and data twice, on the client or on the server, SHALL produce byte-identical markup, with no generated ids, timestamps or random values in it. |
| NFR-00901 | Ubiquitous | A column renderer with 50 groups and 2 series SHALL render in under 16 ms per call, measured as the median of 20 calls in the unit-test environment. |
| NFR-00902 | Ubiquitous | With 50 groups, no two category labels of a column, line or area chart SHALL overlap; labels are thinned to every n-th group until none overlaps, and every mark keeps its `<title>`. |
| NFR-00903 | Ubiquitous | The markup of one widget with 50 groups and 12 series SHALL not exceed 150 KB, so a 100-widget export stays under the export cap. |
| NFR-00904 | Ubiquitous | An automated accessibility scan of a page containing one widget of each of the eight types SHALL report zero violations of impact `serious` or `critical`. |
| NFR-00905 | Ubiquitous | The chart module SHALL have zero references to `window`, `document` or a resize observer inside the render path, so a static render on the server needs no browser globals. |

## Open questions

`[NEEDS CLARIFICATION: tooltips — is the browser's native hover title (what the prototype has) enough, or is a positioned tooltip with the formatted value required? A custom tooltip adds client-only state and cannot exist in the static export.]`

`[NEEDS CLARIFICATION: palette order for series split by a legend field — the prototype cycles the widget's two colours then four fixed hues; should the six colours instead come from the design tokens so every widget shares one categorical palette? It changes FR-00904 and the tokens file.]`

`[NEEDS CLARIFICATION: tick rule — keep the prototype's five evenly spaced ticks over the padded range (labels such as `1.234 mil`) or round to "nice" numbers (0, 500 mil, 1 mi)? It changes FR-00905 and every snapshot test.]`

`[NEEDS CLARIFICATION: more than 50 groups — `top` is capped at 50 but `top = 0` means all, and a real source can have hundreds of categories; draw all, draw the first 50 with a caption, or refuse? It changes NFR-00902 and the table renderer.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/009-svg-charts
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.
