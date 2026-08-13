# PixelCraft

A **web‑based, Canva‑style image editor** for designing social media carousels, posts, and visual content directly in your browser. No sign‑up, no backend – everything runs client‑side.

Built with vanilla HTML, CSS, and JavaScript (ES modules), this editor lets you combine images and text on a flexible canvas, adjust aspect ratios, and export your creation as a high‑resolution PNG image.

---

## ✨ Features

### Canvas & Aspect Ratios
- **Preset aspect ratios**: 1:1 (square), 4:5, 9:16 (story), 16:9 (landscape), 2:3 and more.
- **Custom canvas size**: the canvas adapts to the selected ratio and your screen, keeping the design area clean and usable.

### Position & Layout
- **Exact X/Y coordinates** – set any element's position numerically in the properties panel; the fields update live while you drag or resize, so you can align elements to the same coordinates.
- **Width & Height** – track any element's size live while resizing, or type a size directly.
- Compact, responsive 2×2 position/size grid that stays usable on narrow panels.

### Image Handling
- **Upload multiple images** – drag & drop or use the toolbox button.
- **Swap images** on the fly from the properties panel.
- **Resize images** using 8 drag handles (corners, edges) for independent width/height or proportional scaling.
- **Image fit mode** (right‑click context menu):
  - **Fill** – stretches the image to the exact container size (no crop).
  - **Cover** – scales the image to cover the container while maintaining aspect ratio (crops as needed, like `object-fit: cover`).
- **Scale to canvas** – instantly fit an image to the full canvas while preserving its aspect ratio.

### Text Elements
- **Click‑to‑edit** text boxes – just like PowerPoint, select a text element and start typing.
- **Resizable text boxes** – the same 8 drag handles images get (corners, edges) for exact sizing, independent of the text content.
- **Style options**:
  - Font size
  - Font weight (normal, medium, semi-bold, bold, extra bold)
  - **Font family** – 5 bundled brand‑style families (Inter, Roboto, Poppins, Montserrat, Playfair Display) plus your own imports
  - Text color
  - Background color (including transparent), with a one‑click **🗑 Remove BG** button to go transparent instantly
  - **Text shadow editor** – pick from 4 pro presets (Soft Drop, Hard Drop, Neon Glow, Paper Cut), fine‑tune offsets X/Y, blur, color and opacity, write an advanced CSS string, or remove the shadow entirely
  - **Text padding** – four independent sides (top, right, bottom, left) inside the text box
  - **Corner radius** – four independent corners (top‑left, top‑right, bottom‑left, bottom‑right)
- **Live preview** – all changes appear immediately.

### Transform (Text & Images)
- **Rotate** – type any angle in the Transform panel, or drag the ⟳ handle above a selected element (text or image).
- **Skew** – independent Skew X and Skew Y angles for both text and image elements.

### Custom Fonts
- Import your own `.ttf`, `.otf`, `.woff`, or `.woff2` files via the **＋ Custom Font…** option in the Font Family dropdown.
- Files are validated (extension + font magic bytes) and saved to `resources/user/fonts/` behind a `manifest.json` — random files are rejected and only registered fonts are ever loaded.
- Imported fonts are loaded automatically on every launch; a failed load prints the error message instead of crashing.
- The built‑in families live in `resources/fonts/` and can be re‑downloaded with `npm run fonts`.

### Multi‑Select (Ctrl+Click)
- **Select several elements at once** — hold **Ctrl** (or **Cmd**) and click elements to add/remove them from the selection; the panel shows how many are selected.
- **Drag the whole group** together (positions stay locked relative to each other, clamped to the canvas).
- **Copy / Cut / Paste the group** in one shot — Ctrl+C / Ctrl+X / Ctrl+V duplicates or moves every selected element, and Delete removes them all.
- The first selected element stays the **primary** (it keeps the resize/rotate handles and drives the properties panel — edits there apply to it).

### Select Mode (mobile-friendly copy/paste)
- **Select tool** in the left toolbox has two states — off, or **active** (darker background) — and while active a small **Copy / Paste menu** appears right next to the button.
- **Tap elements** to toggle them in/out of the selection (taps never start a drag or pop the keyboard) — the mobile equivalent of Ctrl+click.
- **Copy** becomes selectable once at least one element is selected; clicking it copies the whole selection and turns it off while **Paste** lights up (repeatable — each paste steps away from the original spot).
- **Cancellable** — tap the Select tool again (or press **Esc**): if nothing was pasted yet the selected components are dropped; after a paste, exiting just keeps the result.

### Layering & Organisation
- **Drag** any element (text or image) freely on the canvas — or drag a multi‑selected group together.
- **Bring to front / Send to back** via right‑click context menu.
- **Duplicate** elements in one click.
- **Delete** elements when they’re no longer needed.

### Undo / Redo & Keyboard Shortcuts
- **Undo / Redo** every user action (add, move, resize, rotate, style edits, text typing, delete…) with **Ctrl+Z** and **Ctrl+Y** / **Ctrl+Shift+Z**, or the single **↩️ / ↪️ undo-redo** control in the left toolbox (one button, two halves; each half disables independently) — one undo step per drag/resize/rotate gesture.
- **Cut / Copy / Paste** the selected element(s) with **Ctrl+X / Ctrl+C / Ctrl+V** (same‑session clipboard; multi‑select copies the whole group); repeated pastes step away from the original spot.
- **Delete** (or **Backspace**) removes the selected element(s).
- Everything behaves like a text field: typing inside a text box keeps native text cut/copy/paste for highlighted text, and the properties‑panel fields keep their native field behavior (undo/redo there still shares the same history).

### Multiple Pages (Canvases)
- **Multiple canvases** – a design can hold any number of pages; every page has its own elements **and its own background color** (set with the toolbox picker while that page is active).
- **Page track** – a strip under the canvas shows every page as a numbered thumbnail with a **live preview of its contents** (elements rendered at the correct scaled position — dragging, resizing or typing updates the active page's thumbnail in real time) plus a content badge (🔤 text / 🖼️ image counts, or *Empty*); click one to navigate.
- **Add / Clone / Delete** pages from the track buttons:
  - **＋ Add** – inserts a new empty page after the current one.
  - **⧉ Clone** – duplicates the current page *with all of its contents* (deep copy) right after it and jumps to the copy.
  - **🗑 Delete** – removes the current page (never the last one) and switches to a neighbour.
- **Drag an element (or a multi‑selected group) to another page** – grab it and drag onto a page thumbnail in the track (the target thumbnail highlights); releasing moves everything to that page and switches you over.
- All page operations (add, clone, delete, move‑across) are **undoable** with Ctrl+Z.
- **Export** always captures the currently active page.

### Background & Canvas Settings
- **Custom background colour** – choose any solid color for the canvas using the toolbox colour picker. The color is stored **per page**, so each canvas keeps its own background.

### Export
- **Export to PNG** – download your design as a high‑resolution (2×) image with the click of a button.
- All elements (text, images, shadows) are captured exactly as they appear on screen.
- Selection outlines, side lines, resize handles, and text highlights are hidden (and transitions suppressed) during capture, so none of the editor's selection colors leak into the download — for every element type.

---

## 🚀 Getting Started

Requires [Node.js](https://nodejs.org/) 18+.

```bash
# 1. Install dependencies (html-to-image, vite)
npm install

# 2. Start the dev server (http://localhost:5173)
npm run dev
```

### Production build

```bash
npm run build     # outputs static files to dist/
npm run preview   # serve the production build locally
```

### How to Use

1. **Set the aspect ratio** using the buttons in the top bar (e.g. 1:1 for a square post).
2. **Add elements**:
   - Click **Text** in the left toolbox to insert a text box.
   - Click **Image** to upload an image (or drag and drop it onto the canvas area).
3. **Edit**:
   - **Click** an element to select it. Handles appear around images and text (both are resizable), and text becomes editable.
   - **Drag** to move an element.
   - Use the **right‑click menu** to bring forward/send backward, duplicate, delete, or change image fit mode.
   - Use the **properties panel** on the right to change text content, font size, colours, shadow, or swap images.
4. **Work with pages**: use the **page track** under the canvas to add, clone (with contents) or delete pages; click a thumbnail to navigate; drag an element onto another page's thumbnail to move it there.
5. **Export** – click the **Export** button in the top bar to download the active page as a PNG.

---

## 🧱 Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES modules) |
| **Build**    | [Vite](https://vitejs.dev/)         |
| **Export**   | [html-to-image](https://github.com/bubkoo/html-to-image) (npm package) |
| **Images**   | Local file uploads (Data URIs, no server required) |

---

## 📁 Project Structure

The app is split into small, single‑purpose ES modules so each concern can
grow and be tested independently.

```
.
├── index.html                 # Markup shell (entry point)
├── styles.css                 # All styling
├── package.json               # npm scripts & dependencies
├── vite.config.js             # Vite config + user‑font import API plugin
├── resources/
│   ├── fonts/                 # Bundled brand‑style font families (@font-face)
│   └── user/fonts/            # Imported custom fonts + manifest.json
├── scripts/
│   ├── download-fonts.mjs     # Re‑download the bundled families (npm run fonts)
│   └── user-fonts-plugin.mjs  # Dev server API: save/validate/serve custom fonts
└── src/
    ├── main.js                # Composition root: boots modules & wires top‑bar UI
    ├── constants.js           # Aspect ratios, font list, shadow presets, defaults
    ├── utils.js               # generateId, clamp, findElementById
    ├── state.js               # Central app state (pages, elements, selection, canvas size)
    ├── pages.js               # Multi‑canvas: page track, add/clone/delete/switch, thumbnails
    ├── bus.js                 # Tiny pub/sub event bus ('render', 'selection', …)
    ├── dom.js                 # Central DOM reference registry
    ├── canvas.js              # Canvas sizing, rendering, model↔DOM sync
    ├── selection.js           # Select/deselect operations
    ├── elements.js            # Element factories (text, image) & structure ops
    ├── interactions.js        # Drag, resize, rotate, right‑click context menu
    ├── history.js             # Undo/redo snapshot stacks for user actions
    ├── shortcuts.js           # Global keyboard shortcuts (undo/redo, cut/copy/paste)
    ├── properties.js          # Right‑hand properties panel
    ├── fonts.js               # Custom font registry, manifest loading, import
    └── export.js              # High‑resolution PNG export via html-to-image
```

### Architecture notes

- **Single source of truth**: the model lives in `state.js`; rendering in
  `canvas.js`; the panel in `properties.js`. No module reaches into another
  module's DOM.
- **Event‑driven**: `bus.js` decouples modules — e.g. `elements.js` emits
  `'render'`, `canvas.js` redraws, `properties.js` refreshes on `'selection'`.
- **One concern per file**: adding a new element type means adding a factory
  in `elements.js` and a branch in `canvas.js` — no changes to the UI wiring.
- **Export is isolated**: swap `html-to-image` for another renderer by editing
  only `src/export.js`.
- **Custom fonts need the dev server**: the app is client‑side, so importing a
  font POSTs it to the Vite plugin, which validates and persists it. The
  `npm run dev` server also serves the saved files back to the browser.
