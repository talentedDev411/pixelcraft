# Architecture

Detailed documentation of PixelCraft's internal architecture, module responsibilities, data flow, and extension points.

---

## High-Level Overview

PixelCraft is a **single-page, client-side** image editor. There is no backend — all images are stored as Data URIs in memory. The app boots from a single `<script type="module" src="/src/main.js">` tag in `index.html`.

```
┌─────────────────────────────────────────────────────┐
│  index.html  (single page shell)                    │
│  ┌───────────┬─────────────────┬──────────────────┐ │
│  │  Toolbox  │  Canvas Area    │  Properties      │ │
│  │  (left)   │  (center)       │  Panel (right)   │ │
│  └───────────┴─────────────────┴──────────────────┘ │
│  ┌──────────────────────────────────────────────────┐│
│  │  Page Track (thumbnails)                         ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

---

## Core Modules

### `main.js` — Composition Root

The entry point. Boots every module in order, wires top-bar buttons (aspect ratios, export, clear, background color), and initializes the SVG picker. No logic lives here beyond delegation.

**Boot order:**
1. `initCanvas()` — subscribes to `render`/`selection` events, wires text editing
2. `initPages()` — builds the page track, adds the first page
3. `initInteractions()` — wires drag, resize, rotate, context menu
4. `initProperties()` — subscribes to `selection`/`render`, wires all property inputs
5. `initShortcuts()` — keyboard shortcuts (undo/redo, cut/copy/paste, delete)
6. `initSvgPicker(selectElement)` — builds the SVG picker modal
7. Top-bar wiring (aspect ratios, export dropdown, background color)

### `state.js` — Single Source of Truth

All application state lives in a module-scoped `state` object:

```js
{
  pages: [                        // Array of page objects
    {
      id: string,
      elements: [                 // Element models (text, image, svg)
        { id, type, x, y, width, height, ... }
      ],
      bgColor: string             // Per-page background color
    }
  ],
  activePageId: string,           // Currently visible page
  selectedElementIds: string[],   // Multi-select: primary is [0]
  currentAspectRatio: string,     // e.g. "1:1", "4:5"
  canvasWidth: number,            // Computed from ratio + viewport
  canvasHeight: number
}
```

All access goes through exported getters/setters (`getElements()`, `setElements()`, `getSelectedIds()`, etc.) — no module touches `state` directly.

**Key design:** element accessors are scoped to the *active page*. `getElements()` returns `getActivePage().elements`. Modules that only care about "current elements" don't need to know about pages.

### `bus.js` — Event Bus

A minimal pub/sub system with `on(event, fn)` and `emit(event, ...args)`. Decouples modules so producers don't know about consumers.

| Event | Payload | Produced by | Consumed by |
|-------|---------|-------------|-------------|
| `render` | — | `elements.js`, `pages.js` | `canvas.js`, `pages.js` |
| `selection` | — | `selection.js` | `canvas.js`, `properties.js` |
| `transform` | `id` | `interactions.js` | `properties.js` |
| `text-edited` | `content` | `canvas.js` | `properties.js` |
| `history` | — | `history.js` | `main.js` (undo/redo buttons) |

### `history.js` — Undo / Redo

Full-document snapshots stored as JSON strings. The undo stack holds up to 100 snapshots.

**Key behaviors:**
- `record()` — called *before* a mutation; no-ops if state hasn't changed since last record
- `beginGesture()` / `endGesture()` — wraps drag/resize/rotate so the entire gesture is one undo step
- `inGesture()` — checked by `updateElementModelAndDOM()` to skip per-keystroke recording
- `undo()` / `redo()` — restore a snapshot, emit `history`, and re-render

### `dom.js` — DOM Reference Registry

A single object that queries every interactive DOM element once at load time. Other modules import `dom.xxx` instead of calling `getElementById`. This centralizes all ID-to-element mappings — renaming a DOM id only requires changing one line.

---

## Canvas System

### `canvas.js` — Rendering & Model Sync

The canvas module has three main jobs:

1. **Sizing** — `updateCanvasSize()` computes pixel dimensions from the selected aspect ratio and viewport, then applies them to `#canvasWrapper`.

2. **Full re-render** — `fullRender()` clears `#designCanvas` and rebuilds every element DOM node from the active page's model. Called on `render` events.

3. **Live editing** — `updateElementModelAndDOM(id, updates)` patches a single element's model and applies incremental DOM changes without a full re-render. This is used during property panel edits and drag/resize/rotate gestures.

#### `buildElementDiv(el, options)`

Builds a DOM node for one element. Used by both the canvas and page-track thumbnails (via the `scale` option). The function branches on `el.type`:

- **`text`** — creates a `<div>` with `textContent`, inline styles for font, color, shadow, padding, border-radius, and transform
- **`image` / `svg`** — creates a `<div>` containing an `<img>` with `src`, `objectFit`, and transform
- For SVGs, `recolorSvg()` is called on the `src` data URL before setting `img.src`

#### `recolorSvg(dataUrl, fillColor)`

Takes an SVG data URL and returns a new one with all fill colors replaced. Used by both `buildElementDiv()` (full render) and `updateElementModelAndDOM()` (live edit). The replacement targets:
- `fill: #xxxxxx` in CSS `<style>` blocks
- `fill="#xxxxxx"` inline attributes

#### Selection Chrome

`applySelectionToDOM(ids)` adds/removes CSS classes and resize/rotate handles:
- All selected elements get `.selected` (blue outline)
- Only the primary element (first in the selection) gets resize handles (8 positions) and the rotate handle
- Text elements get `contenteditable="true"` only for the primary in non-select-mode

---

## Element System

### `elements.js` — CRUD Operations

Every structural change (add, delete, duplicate, reorder, cut/copy/paste, move-across-pages) goes through this module.

**Public API:**

| Function | Description |
|----------|-------------|
| `addTextElement()` | Creates a centered text box with defaults |
| `addImageElement(file)` | Reads a file, scales if >4096px, centers on canvas |
| `addSvgElement(dataUrl, name)` | Creates a 60×60 SVG element centered on canvas |
| `deleteElement(id)` | Removes an element and deselects it |
| `duplicateElement(id)` | Deep-copies an element 20px down-right |
| `moveElementToFront(id)` | Moves element to the end of the array (top z-order) |
| `moveElementToBack(id)` | Moves element to the start (bottom z-order) |
| `cutElement(id)` / `copyElement(id)` | Clipboard operations (same-session) |
| `pasteElement()` | Pastes with increasing 20px offset per repeat |
| `deleteSelectedElements()` | Deletes all currently selected elements |
| `moveElementToPage(id, targetPageId)` | Drag-to-thumbnail cross-page move |

Every function calls `record()` first, mutates `setElements()`, then emits `render`.

### Element Model Shapes

**Text:**
```js
{
  id: string,
  type: 'text',
  content: string,
  x: number, y: number,
  width: number, height: number,
  fontSize: number,              // 8–120
  fontWeight: string,            // '400'–'800'
  fontFamily: string,
  color: string,                 // hex
  bgColor: string,               // hex or 'transparent'
  textShadow: string,            // CSS shadow string or 'none'
  padding: { top, right, bottom, left },
  borderRadius: { tl, tr, bl, br },
  rotation: number,              // -180 to 180
  skewX: number,                 // -90 to 90
  skewY: number                  // -90 to 90
}
```

**Image:**
```js
{
  id: string,
  type: 'image',
  src: string,                   // Data URI
  x: number, y: number,
  width: number, height: number,
  fitMode: string,               // 'fill' or 'cover'
  rotation: number,
  skewX: number,
  skewY: number
}
```

**SVG:**
```js
{
  id: string,
  type: 'svg',
  src: string,                   // SVG data URL
  svgName: string,               // e.g. 'arrow-01'
  fillColor: string,             // hex, default '#231f20'
  x: number, y: number,
  width: number, height: number,
  fitMode: string,
  rotation: number,
  skewX: number,
  skewY: number
}
```

---

## SVG System

### Overview

The SVG system provides a modal library of pre-built SVG icons (currently 36 arrows) that users can browse, multi-select, and place on the canvas. Placed SVGs are fully integrated into the editor — they can be dragged, resized, rotated, recolored, and exported.

### Components

```
resources/svgs/arrows/          ← 36 individual .svg files
         ↓ (build-time script)
src/svg-data.js                 ← ARROW_SVGS array of { name, dataUrl }
         ↓ (runtime)
src/svg-picker.js               ← Modal with multi-select UI
         ↓ (confirm)
src/elements.js                 ← addSvgElement() creates the model
         ↓
src/canvas.js                   ← Renders SVG, handles recolorSvg()
         ↓
src/properties.js               ← SVG fill color picker panel
```

### `svg-data.js` — SVG Data URLs

Auto-generated at build time. Each SVG from `resources/svgs/arrows/` is read, URL-encoded, and bundled as a `data:image/svg+xml,...` string. The module exports:

```js
export const ARROW_SVGS = [
  { name: "arrow-01", dataUrl: "data:image/svg+xml,..." },
  { name: "arrow-02", dataUrl: "data:image/svg+xml,..." },
  // ... 36 total
];
```

**Regenerating:** run the extraction script (or the node one-liner) after adding new SVGs to `resources/svgs/arrows/`.

### `svg-picker.js` — Multi-Select Modal

The picker builds its DOM dynamically (no static HTML in `index.html`). Key features:

- **Categories** — currently one (`Arrows`), but the `CATEGORIES` array is extensible
- **Multi-select** — click toggles an SVG on/off; a count badge shows selection size
- **Grid reordering** — selected items move to the top of their category grid; deselected items return to alphabetical order
- **Preview** — the last-clicked SVG appears large in the preview area
- **Confirm** — places all selected SVGs on the canvas, centered with 15px stacking offset

**Internal state:**
- `selectedSvgs[]` — array of `{ name, dataUrl }` for currently toggled items
- `_selectElement` — injected reference to `selectElement()` from `selection.js` (avoids circular import)

**Keyboard/pointer:**
- `Escape` or backdrop click closes the modal
- Cells sort back to alphabetical order on open

### SVG Recoloring

`recolorSvg(dataUrl, fillColor)` in `canvas.js` performs a string replacement on the decoded SVG markup:

1. Replaces `fill: #xxxxxx` patterns in `<style>` blocks
2. Replaces `fill="#xxxxxx"` inline attributes
3. Re-encodes the modified SVG as a new data URL

This is called during both full renders and live property edits. The color is stored as `fillColor` on the element model and persisted in undo/redo snapshots.

### Adding New SVG Categories

1. Add SVG files to `resources/svgs/<category>/`
2. Run the extraction script to regenerate `src/svg-data.js`
3. Add a new entry to the `CATEGORIES` array in `src/svg-picker.js`:
   ```js
   const CATEGORIES = [
     { id: 'arrows', label: 'Arrows', svgs: ARROW_SVGS },
     { id: 'shapes', label: 'Shapes', svgs: SHAPE_SVGS },
   ];
   ```

---

## Properties Panel

### `properties.js` — Right-Hand Panel

The properties panel shows different sections based on the selected element type:

| Element type | Sections shown |
|-------------|---------------|
| None | "Select an element to edit" placeholder |
| `text` | Position, Text (content, font, colors, shadow, padding, corners), Transform |
| `image` | Position, Image (swap), Transform |
| `svg` | Position, SVG (fill color, reset, delete), Transform |
| Multi-select | Position + "N elements selected — edits apply to the first one" |

**Wiring pattern:** `initProperties()` subscribes to `selection` and `render` events. On each event, `updatePropertiesPanel()` reads the selected element and shows/hides sections. Input change listeners call `updateElementModelAndDOM()` for live updates.

---

## Multi-Page System

### `pages.js` — Page Track & Navigation

Each page is an independent canvas with its own elements and background color. The page track (strip below the canvas) shows thumbnails with live previews.

**Operations:**
- **Add** — new empty page after current
- **Clone** — deep-copy current page (structuredClone) after current
- **Delete** — removes current page (never the last one), switches to neighbor
- **Navigate** — click a thumbnail to switch
- **Drag-across** — drag an element onto another page's thumbnail to move it

All page operations are undoable. Thumbnails update in real-time as elements change.

---

## Interactions

### `interactions.js` — Drag, Resize, Rotate, Context Menu

Handles all pointer-based element manipulation:

- **Drag** — moves the element (or all selected elements) relative to pointer delta, clamped to canvas
- **Resize** — 8-handle resize with shift for proportional scaling
- **Rotate** — the ⟳ handle above the element computes angle from pointer position
- **Context menu** — right-click shows bring-to-front, send-to-back, duplicate, delete, scale-to-canvas, fit mode toggle

Gestures use `beginGesture()`/`endGesture()` from `history.js` so the entire drag is one undo step.

---

## Select Mode

### `selectmode.js` — Mobile-Friendly Multi-Select

A toggle-based selection mode for touch devices where Ctrl+click isn't available:

- Tap the **Select** tool to activate (darker background)
- Tap elements to toggle in/out of selection
- **Copy / Paste** buttons appear next to the tool when active
- Tap Select again to cancel (or press Esc)
- After a paste, exiting keeps the result

---

## Export System

### `export.js` — PNG, ZIP, PDF

Uses three npm packages:
- **html-to-image** (`toPng`) — renders an offscreen DOM node to a PNG data URL at 2× resolution
- **JSZip** — wraps multiple PNGs into a `.zip` archive
- **jsPDF** — generates a multi-page PDF sized to the canvas aspect ratio

The export renderer clones each page's elements into an offscreen node (same `buildElementDiv` as the canvas), hides selection chrome, and captures. Export never disturbs the live canvas.

---

## Custom Font System

### `fonts.js` — Registry & Manifest

Built-in fonts live in `resources/fonts/` with `@font-face` declarations in `styles.css`. User-imported fonts are stored in `resources/user/fonts/` with a `manifest.json` registry.

**Import flow:**
1. User selects a `.ttf`/`.otf`/`.woff`/`.woff2` file via the font family dropdown
2. File is POSTed to `/api/user-fonts` (Vite dev-server plugin)
3. Plugin validates extension and font magic bytes (sfVersion)
4. File is saved and registered in `manifest.json`
5. A `@font-face` rule is injected dynamically

---

## Keyboard Shortcuts

### `shortcuts.js` — Global Keybindings

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy selected element(s) |
| `Ctrl+X` | Cut selected element(s) |
| `Ctrl+V` | Paste (with offset stepping) |
| `Delete` / `Backspace` | Delete selected element(s) |
| `Escape` | Deselect all / exit select mode |

Shortcuts respect the native clipboard when text is selected in an input or contenteditable, so typing in a text box or property field works normally.

---

## Extension Points

### Adding a New Element Type

1. **Model** — define the shape in the element model (follow the text/image/svg patterns)
2. **Factory** — add `addXxxElement()` in `elements.js`
3. **Render** — add a branch in `buildElementDiv()` and `updateElementModelAndDOM()` in `canvas.js`
4. **Properties** — add a section in `index.html`, DOM refs in `dom.js`, visibility + wiring in `properties.js`
5. **Interactions** — add context menu items if needed in `interactions.js`
6. **SVG-specific** — if the element uses inline SVG, add a `recolorXxx()` helper for color changes

### Adding a New SVG Category

1. Place SVG files in `resources/svgs/<name>/`
2. Regenerate `src/svg-data.js` with the extraction script
3. Import the new array in `svg-picker.js` and add a `CATEGORIES` entry

### Adding a New Export Format

Edit only `src/export.js`. The offscreen renderer (`buildElementDiv` + `toPng`) is shared — you only need to add a new function that consumes the PNG data URLs.

---

## Build System

### Vite Configuration

`vite.config.js` configures:
- Standard Vite dev server with HMR
- A custom plugin (`user-fonts-plugin.mjs`) that serves the `/api/user-fonts` endpoint for font import

### No Transpilation

The project uses plain ES modules with no TypeScript, no JSX, and no CSS preprocessors. Vite serves `src/*.js` files directly to the browser.
