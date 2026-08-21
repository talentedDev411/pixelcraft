# Contributing to PixelCraft

Thanks for your interest in contributing! PixelCraft is a client-side image editor built with vanilla JavaScript (ES modules) and Vite. This guide covers how to set up the project, the conventions to follow, and how to add new features.

---

## Prerequisites

- [Node.js](https://nodejs.org/) **18+**
- npm (comes with Node)

No build tools, bundlers, or transpilers beyond Vite are needed. There is no backend — everything runs in the browser.

---

## Getting Started

```bash
# 1. Clone the repo
git clone <repo-url>
cd Image-Editor-Canvas

# 2. Install dependencies
npm install

# 3. Start the dev server (http://localhost:5173)
npm run dev
```

The dev server supports hot module replacement (HMR) via Vite. Edits to any file under `src/` are reflected instantly in the browser.

### Production Build

```bash
npm run build     # outputs static files to dist/
npm run preview   # serve the production build locally
```

### Re-downloading Bundled Fonts

```bash
npm run fonts     # re-download the 5 brand-style font families
```

---

## Project Structure at a Glance

```
.
├── index.html                  # Single-page shell
├── styles.css                  # All styles (single file)
├── package.json                # npm scripts & dependencies
├── vite.config.js              # Vite config + user-font API plugin
├── resources/
│   ├── fonts/                  # Bundled font families (@font-face)
│   ├── svgs/arrows/            # Individual SVG arrow files + manifest
│   └── user/fonts/             # User-imported custom fonts + manifest
├── scripts/
│   ├── download-fonts.mjs      # Re-download bundled fonts (npm run fonts)
│   └── user-fonts-plugin.mjs   # Dev-server API for custom font import
└── src/
    ├── main.js                 # Composition root: boots all modules
    ├── constants.js            # Aspect ratios, fonts, defaults
    ├── state.js                # Central state (pages, elements, selection)
    ├── bus.js                  # Pub/sub event bus
    ├── dom.js                  # Centralized DOM query registry
    ├── canvas.js               # Canvas rendering & model ↔ DOM sync
    ├── selection.js            # Select / deselect operations
    ├── elements.js             # Element CRUD (text, image, svg)
    ├── interactions.js         # Drag, resize, rotate, context menu
    ├── history.js              # Undo/redo snapshot stacks
    ├── shortcuts.js            # Global keyboard shortcuts
    ├── properties.js           # Right-hand properties panel
    ├── pages.js                # Multi-page canvas management
    ├── selectmode.js           # Mobile-friendly select mode
    ├── shadow.js               # Text shadow parse/compose helpers
    ├── fonts.js                # Custom font registry & manifest
    ├── svg-picker.js           # SVG library modal (multi-select)
    ├── svg-data.js             # Auto-generated SVG data URLs
    └── export.js               # Export: PNG, ZIP, PDF
```

---

## Architecture Principles

### Single Source of Truth

The model lives in `state.js`. Rendering happens in `canvas.js`. The properties panel reads from state in `properties.js`. No module reaches into another module's DOM directly — they all go through `dom.js`.

### Event-Driven Communication

Modules communicate through a lightweight pub/sub bus (`bus.js`). The main events are:

| Event | Emitted by | Consumed by |
|-------|-----------|-------------|
| `render` | `elements.js`, `canvas.js`, `pages.js` | `canvas.js`, `pages.js` |
| `selection` | `selection.js` | `properties.js` |
| `transform` | `interactions.js` | `properties.js` |
| `text-edited` | `canvas.js` | `properties.js` |

### One Concern Per File

Each module has a single responsibility. Adding a new element type means:

1. Add a factory in `elements.js`
2. Add rendering branches in `canvas.js`
3. Add property panel sections in `properties.js`
4. Add DOM references in `dom.js`
5. Add HTML sections in `index.html`

No changes to the event bus or other modules are typically needed.

---

## Adding a New Element Type

1. **Factory** — add an `addXxxElement()` function in `src/elements.js` that creates the model object and calls `addElement()`.
2. **DOM references** — add any new property panel inputs to `index.html` and their `dom.xxx` references in `src/dom.js`.
3. **Rendering** — add a branch in `buildElementDiv()` and `updateElementModelAndDOM()` in `src/canvas.js`.
4. **Properties** — add visibility toggling in `updatePropertiesPanel()` and event wiring in `initProperties()` in `src/properties.js`.
5. **Interactions** — if the element needs context-menu actions, add cases in `src/interactions.js`.

### Example: SVG Element Type

The SVG system (added in a recent feature) follows this pattern:

- `src/svg-picker.js` — modal for browsing and multi-selecting SVGs
- `src/svg-data.js` — auto-generated module with SVG data URLs
- Element model includes `type: 'svg'`, `src` (data URL), `fillColor`, `svgName`
- `canvas.js` re-renders the SVG with `recolorSvg()` when `fillColor` changes
- `properties.js` shows a color picker for SVG fill when an SVG is selected

---

## Code Conventions

### JavaScript

- **ES modules** — every file uses `import`/`export`. No bundler-specific syntax.
- **No frameworks** — vanilla JS only. No React, Vue, etc.
- **Descriptive names** — functions and variables use `camelCase`; constants use `UPPER_SNAKE_CASE`.
- **JSDoc** — public functions have a brief JSDoc comment. Internal helpers get a `/** */` one-liner.
- **No trailing semicolons** — the project does not enforce semicolons. Follow the existing style.
- **`const` by default**, `let` only when reassignment is needed. No `var`.

### HTML / CSS

- **Single `styles.css`** — all styles live in one file. Sections are separated by comment headers.
- **BEM-lite class names** — descriptive, hyphen-separated: `.svg-picker-backdrop`, `.tool-split`, `.position-grid`.
- **No CSS preprocessors** — plain CSS only.

### Git

Follow [Conventional Commits](https://www.conventionalcommits.org/) with these prefixes:

| Prefix | Use for |
|--------|---------|
| `feat:` | New features or capabilities |
| `fix:` | Bug fixes |
| `docs:` | Documentation changes |
| `chore:` | Tooling, config, non-code changes |
| `refactor:` | Code restructuring with no behavior change |

Examples:
```
feat: add SVG picker with multi-select
docs: add architecture and contributing guides
fix: prevent text shadow removal from clearing opacity
chore: update vite to 6.3.5
```

---

## Undo / Redo

Every structural change (add, delete, move, resize, style edit) calls `record()` from `src/history.js` **before** mutating state. This snapshots the current page's elements. Undo restores the snapshot; redo re-applies the next one.

When adding a new action, always call `record()` at the start of the action function — never after the mutation.

---

## Export System

Export is isolated in `src/export.js`. It uses three npm packages:

- **html-to-image** — renders an offscreen DOM node to a PNG data URL
- **JSZip** — wraps multiple PNGs into a `.zip` archive
- **jsPDF** — generates a PDF from page images

To swap the renderer (e.g., use a different screenshot library), edit only `src/export.js`. The rest of the app is unaffected.

---

## Custom Fonts

Fonts are imported through the Vite dev-server plugin (`scripts/user-fonts-plugin.mjs`). The flow:

1. User picks a `.ttf` / `.otf` / `.woff` / `.woff2` file
2. Frontend POSTs it to `/api/user-fonts`
3. Plugin validates file extension and font magic bytes
4. Plugin saves to `resources/user/fonts/` and registers in `manifest.json`
5. Font is available immediately and on every subsequent launch

The built-in font families live in `resources/fonts/` and can be re-downloaded with `npm run fonts`.

---

## Running Tests

There is currently no automated test suite. Verify changes by:

1. Running `npm run build` — should succeed with zero errors
2. Running `npm run dev` and manually testing in the browser
3. Checking that undo/redo works for every new action

---

## Reporting Issues

When reporting a bug, please include:

- Browser name and version
- Steps to reproduce
- Expected vs. actual behavior
- Console errors (if any)
