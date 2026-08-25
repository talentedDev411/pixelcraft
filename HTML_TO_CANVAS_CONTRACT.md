# HTML-to-Canvas Contract — Mandatory

This is the authoritative constraint for AI and contributors working on the HTML importer, serializer, or canvas renderer. The source design notes are in [`html_code_parser_logic/`](html_code_parser_logic/), but this file defines what is allowed in this editor.

## Non-negotiable document structure

1. Canonical import/export content starts directly with one or more `<section>` tags. Do not generate `<html>`, `<head>`, or `<body>` tags.
2. One top-level `<section>` equals exactly one canvas page.
3. An optional `<style>` block may appear before the first `<section>` as static CSS source. It is never imported as an element.
4. The importer may temporarily wrap a fragment in a browser document only to measure layout. That wrapper is internal implementation detail and must never be serialized or treated as a canvas component.
5. `<script>`, `<link>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<video>`, `<audio>`, `<canvas>`, and every unlisted tag are forbidden import content. Remove or skip them. Never create a generic editor element for an unrecognized tag.
6. Supported visual tags inside a section are only `<div>`, `<span>`, `<p>`, `<h1>`–`<h6>`, `<label>`, `<a>`, `<strong>`, `<em>`, `<b>`, `<i>`, `<button>`, `<img>`, and inline `<svg>`. A button imports as a text leaf; the editor preserves its measured visual box and supported text/background properties, not click behavior.
7. A `<section>` is a page root, not a `data-component="div"`. A visual container is always a `<div data-component="div" data-role="container">`.

Valid shape:

```html
<style>
  .card { background: #fff; }
</style>
<section data-section="0" data-page-id="page_0">
  <div data-component="div" data-role="container">...</div>
</section>
<section data-section="1" data-page-id="page_1">...</section>
```

Invalid shape — do not generate, import, or normalize into this editor:

```html
<html><body><section>...</section></body></html>
<main>...</main>
<article>...</article>
<script>...</script>
<custom-card>...</custom-card>
```

## How CSS and geometry are assessed

Do not write a fake CSS/flex/grid engine. Render static, sanitized input in an isolated same-origin document, wait for fonts and images, then use the browser values:

```js
const style = iframe.contentWindow.getComputedStyle(node);
const rect = node.getBoundingClientRect();
const sectionRect = section.getBoundingClientRect();
```

Final geometry is always measured from the final rendered box, relative to its section, then scaled to the editor canvas:

```text
data-x      = (rect.left - sectionRect.left) * scale
data-y      = (rect.top  - sectionRect.top)  * scale
data-width  = rect.width  * scale
data-height = rect.height * scale
```

Therefore `position: relative; left: 2rem; top: -1rem` must be rendered at the shifted measured `data-x/data-y`. Preserve the source intent with `data-position="relative"`, `data-offset-left`, and `data-offset-top`; never replace its position with a guessed sibling offset.

CSS cascade is only: inline style → matching simple class rule from an in-document `<style>` block → inherited text properties. The inheritable subset is color, font size/weight/family, line height, text alignment, and letter spacing. Do not inherit background, border, radius, padding, gap, display, dimensions, or shadow.

## Allowed page attributes (`<section>` only)

| Attribute | Required / meaning |
| --- | --- |
| `data-page-id` | Required stable page ID. |
| `data-section` | Required zero-based page index. |
| `data-bg-color` | Solid computed section background. |
| `data-bg-gradient` | Computed CSS gradient; use when present instead of flattening it to a color. |

The canvas page renderer supports only `bgColor` and `bgGradient`. Do not add section background-image/size/position/repeat fields until those features exist in the editor.

## Attributes required on every editor component

Every recognized visual component must use a supported tag plus all applicable attributes below.

| Attribute | Meaning |
| --- | --- |
| `data-id` | Required unique editor element ID. |
| `data-component` | Required: `text`, `img`, `svg`, or `div`. |
| `data-role` | Required: `leaf` or `container`. |
| `data-section` | Required owning page index. |
| `data-group` | Required owning group ID. |
| `data-depth` | Required nesting depth. |
| `data-classes` | Original CSS class list; empty string when absent. |
| `data-x`, `data-y`, `data-width`, `data-height` | Required final measured canvas geometry. |
| `data-position` | CSS position when it is not `static`. |
| `data-positioned` | `true` for offset-positioned elements. |
| `data-offset-left`, `data-offset-top` | CSS left/top offset when supplied. |
| `data-rotation`, `data-skew-x`, `data-skew-y` | Editor transform fields. Serialize only when non-zero. |
| `data-opacity` | Editor opacity field. Serialize only when not `1`. |

Do not invent attributes outside this contract. If a CSS property is not represented below, preserve neither a fake data attribute nor a fake editor feature.

## Text component: supported fields only

Text uses a supported text tag with `data-component="text"` and `data-role="leaf"`.

| Attribute | Editor model field |
| --- | --- |
| `data-text` | `content` |
| `data-font-size` | `fontSize` |
| `data-font-weight` | `fontWeight` |
| `data-font-family` | `fontFamily` |
| `data-text-color` | `color` |
| `data-bg-color` | `bgColor` |
| `data-bg-gradient` | `bgGradient` |
| `data-line-height` | `lineHeight` |
| `data-text-align` | `textAlign` |
| `data-letter-spacing` | `letterSpacing` |
| `data-shadow` | `textShadow` |
| `data-border-radius` | `borderRadius` |
| `data-padding` | `padding` |

Text example:

```html
<div
  data-id="el_title"
  data-component="text"
  data-role="leaf"
  data-section="0"
  data-group="grp_A"
  data-depth="1"
  data-classes="card-title"
  data-text="Hello World"
  data-font-size="18"
  data-font-weight="700"
  data-font-family="Inter"
  data-text-color="#1a1a1a"
  data-x="16" data-y="16" data-width="180" data-height="28">Hello World</div>
```

## Image component: supported fields only

Images use only `<img data-component="img" data-role="leaf">`.

| Attribute | Editor model field |
| --- | --- |
| `data-src` | `src`; resolved data URL or retained external URL |
| `data-alt` | `alt` |
| `data-img-width`, `data-img-height` | Image display dimensions |
| `data-img-fit` | `fitMode` |
| `data-border-radius` | Image radius metadata |

Relative source resolution is mandatory: resolve relative to the imported HTML file, read the file, and set `data-src` to its base64 data URL. Preserve existing data URLs. Retain an external URL only if it cannot be embedded.

```html
<img
  data-id="el_logo"
  data-component="img"
  data-role="leaf"
  data-section="0"
  data-group="grp_A"
  data-depth="2"
  data-classes=""
  data-src="data:image/png;base64,..."
  data-alt="Logo"
  data-img-width="48"
  data-img-height="48"
  data-img-fit="contain"
  data-border-radius="50%"
  data-x="16" data-y="64" data-width="48" data-height="48"
  src="data:image/png;base64,..."
  alt="Logo">
```

Do not add image border, shadow, padding, background, loading, crossorigin, or referrer-policy editor attributes: this editor does not currently implement those image properties.

## SVG component: supported fields only

Inline `<svg>` and SVG image input normalize to `data-component="svg"` leaves. `data-src` must be a complete encoded `data:image/svg+xml,...` value—never an ellipsis or placeholder.

| Attribute | Editor model field |
| --- | --- |
| `data-src` | `src` |
| `data-svg-name` | `svgName` |
| `data-width`, `data-height` | SVG geometry |
| `data-img-fit` | `fitMode` |
| `data-fill-color` | `fillColor` |
| `data-stroke-width` | `strokeWidth` |
| `data-blur-x`, `data-blur-y` | `blurX`, `blurY` |
| `data-ghost-blur-x`, `data-ghost-blur-y` | `ghostBlurX`, `ghostBlurY` |
| `data-ghost-offset-x`, `data-ghost-offset-y` | `ghostOffsetX`, `ghostOffsetY` |
| `data-ghost-opacity` | `ghostOpacity` |
| `data-gradient-color` | `gradientColor` |
| `data-gradient-type` | `gradientType` |
| `data-gradient-angle` | `gradientAngle` |
| `data-gradient-opacity` | `gradientOpacity` |
| `data-gradient-stops` | `gradientStops` JSON |

## Container component: supported fields only

Containers use only `<div data-component="div" data-role="container">`. Containers are visual canvas components; do not treat them as invisible group metadata.

| Attribute | Editor model field |
| --- | --- |
| `data-group-parent` | Required; equals this container’s `data-group` |
| `data-children` | JSON array of immediate child IDs only |
| `data-layout` | `layout`: `block`, `flex`, or `grid` |
| `data-direction` | `direction` |
| `data-gap` | `gap` |
| `data-align` | `align` |
| `data-justify` | `justify` |
| `data-padding` | `padding` |
| `data-bg-color` | `bgColor` |
| `data-bg-gradient` | `bgGradient` |
| `data-border` | `border` |
| `data-border-radius` | `borderRadius` |
| `data-shadow` | `boxShadow` |
| `data-opacity` | `opacity` |

The canvas must render a container’s measured box, background/gradient, border, radius, shadow, and opacity. Nested containers get a new group ID; their leaves use the nested group. `data-children` contains immediate children, never every descendant.

## Explicitly unsupported

Do not implement or serialize any of these until the editor itself has a corresponding model field and canvas renderer: arbitrary HTML tags, scripts, event handlers, external stylesheets, pseudo-elements, animations, media queries, generic CSS variables, image box shadow/border/background/padding, text decoration/font style/font variant/word spacing/indent/white-space/direction, container margin/min-max size/grid track placement/overflow, and generic CSS transform matrices.

If an unsupported tag or property is encountered, skip it or emit an importer warning. Do not create a fallback element. Do not guess.
