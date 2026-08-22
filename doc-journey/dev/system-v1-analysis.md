# Overall Objective of the Feature

## The objective in one statement

Build a **Canva-style image editor** that runs entirely in the browser — no
sign-up, no backend — where the user can compose **social-media designs**
(1:1 posts, 4:5, 9:16 stories, 16:9 landscape) by placing **images and text
boxes** on a canvas — across **multiple pages** (each with its own
contents and background), with **multi-select** (Ctrl+click) for group
editing — styling them like a pro design tool (**5 brand-style font
families + custom font imports, text shadows with presets, independent
padding & corner radius, rotation & skew**), **resizing and transforming
elements with drag handles**, and finally **exporting a clean high-resolution
PNG, a ZIP archive, or a PDF** — all while every action is **undoable/redoable and keyboard-driven the
way a text field behaves** (Ctrl+Z / Ctrl+Y / Ctrl+X / Ctrl+C / Ctrl+V), so a
mistake is never permanent.

## What the feature delivers — the key points

- **A typed, event-driven architecture.** The app is split into
  single-purpose ES modules (`state.js` model → `canvas.js` render →
  `properties.js` panel → `elements.js` structure ops), decoupled by a tiny
  pub/sub bus (`'render'`, `'selection'`, `'transform'`, `'history'`). No
  module reaches into another module's DOM; adding a new element type means a
  factory in `elements.js` and a branch in `canvas.js`, nothing else.
- **Five bundled brand-style font families** — Inter ("Big Tech"), Roboto
  ("Google / Android"), Poppins ("Tech Marketing"), Montserrat ("Luxury
  Fashion"), Playfair Display ("Luxury Editorial") — shipped as woff2 files in
  `resources/fonts/`, bundled at build time, and re-downloadable with
  `npm run fonts` (`scripts/download-fonts.mjs`).
- **Custom font import that survives reloads.** The Font Family dropdown's
  "＋ Custom Font…" option validates a `.ttf/.otf/.woff/.woff2` file (extension
  **and** 4-byte magic-byte signature), POSTs it to a Vite dev-server plugin
  which persists it to `resources/user/fonts/` behind a `manifest.json`, and
  every registered font is auto-loaded at launch — a failed load prints the
  error instead of crashing the app.
- **A full text-shadow editor** — 4 pro presets (Soft Drop, Hard Drop, Neon
  Glow, Paper Cut), discrete X / Y / blur / color / opacity inputs, a raw CSS
  string field, and a remove-shadow reset. Presets, sliders, and raw CSS all
  derive from one stored `textShadow` string (compose/parse round-trip), so
  they can never contradict each other.
- **Per-element box styling** — padding on four independent sides, four
  independent corner radii, and legacy single-value padding still works.
- **Transform panel + drag-to-rotate** — numeric Rotate (°) and Skew X/Y (°)
  inputs, plus a ⟳ handle above any selected element (text *or* image) that
  drags the angle visually; one central `transformCss()` composes
  `rotate() + skewX() + skewY()`.
- **Resizable text** — selected text boxes now show the same 8 drag handles
  images get (corners + edges), so text can be sized precisely instead of
  only auto-sizing. Handles are marked `contenteditable="false"` so the caret
  can never jump into them while typing.
- **Undo / Redo everywhere.** Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z **and** ↩️ Undo /
  ↪️ Redo buttons in the left toolbox (with live disabled states). One
  history for the whole app — add, delete, duplicate, reorder, drag, resize,
  rotate, every style edit, canvas text typing, cut/paste, and Clear — capped
  at 100 JSON snapshots, with **one drag/resize/rotate gesture = one undo
  step**.
- **Cut / Copy / Paste elements** — Ctrl+X / Ctrl+C / Ctrl+V with a
  same-session clipboard; repeated pastes step +20px away from the original so
  stacks stay visible. Highlighted text inside a text box keeps its native
  text cut/copy/paste — the shortcuts never hijack normal editing.
- **Image fit modes** — Fill (stretch) vs Cover (crop like `object-fit:
  cover`) from the right-click menu, plus scale-to-canvas.
- **Clean 2× PNG export** — `html-to-image` captures the design with every
  piece of editor chrome hidden (selection outline, side lines, resize
  handles, `::selection` colors, in-progress transitions) **for every element
  type**, so nothing but the design lands in the download.
- **One-click Remove BG** for text — a "🗑 Remove BG" button beside the
  Background Color picker sets the text element's background to transparent
  (and records into the undo history like any other edit).
- **Multiple pages (canvases)** — a design can hold any number of pages,
  and every page owns its **own elements and its own background color**. A
  **page track** under the canvas lists each page as a numbered thumbnail
  with a **live, correctly-scaled preview** of its contents plus a content
  badge (🔤 text / 🖼️ image counts,
  or *Empty*); ＋ Add / ⧉ Clone (with all contents, deep-copied) /
  🗑 Delete / click-to-switch, and **drag any element — or a
  multi-selected group — onto a thumbnail to move it to that page**.
  Every page operation (add, clone, delete, move-across) is a single undo
  step; Ctrl+Z restores the page you were on. Export always captures the
  active page.
- **Multi-select (Ctrl+click)** — hold Ctrl/Cmd and click elements to
  toggle them in/out of the selection; every selected element shows the
  outline while the **first one stays primary** (it keeps the resize/rotate
  handles and drives the properties panel, which shows “N elements
  selected”). The whole group **drags together** with relative positions
  locked, and **copy / cut / paste / delete** operate on the entire
  selection in one step (the clipboard holds the group).
- **Live page thumbnails** — thumbnails render contents at the correct
  scaled position (layout box *and* content scaled, correct z-order) and
  update **in place during the gesture** — dragging, resizing, rotating
  or typing moves the preview in the track in real time.
- **Compact toolbox + select mode (mobile)** — a slimmer left toolbox
  (54px, smaller icons/labels) with undo/redo merged into **one split
  control**, and a **Select tool** with two states: off, or active (darker
  background) with a small **Copy / Paste menu anchored next to the
  button** — tap elements to multi-select (no drag, no keyboard),
  Copy → Paste state machine, and a cancellable selection.
- **Four-way export dropdown** — the top-bar Export button now opens
  a menu with four outputs: **Current Canvas** (this page as a 2× PNG),
  **All Pages** (every page rendered as its own PNG, downloaded one by
  one), **ZIP** (all page PNGs packed into one archive via JSZip), and
  **PDF** (all pages in a single document via jsPDF, sized to the canvas
  aspect). Pages are captured from their model into an **offscreen node**
  built with the same `buildElementDiv` the canvas and thumbnails use —
  exporting never disturbs the live canvas, the active page or the
  selection.

---

## How it was built — the struggles behind the objective

Each entry below is framed the same way: **objective** (the piece of the
overall goal being built), **symptom** (what failed), **root cause**, **fix**,
and **verification**.

### 1. Custom fonts had nowhere to persist — this is a zero-backend app

**Objective.** Users must be able to import their own fonts once and have them
available every launch, offered in the Font Family dropdown next to the 5
bundled families.

**Symptom.** A purely client-side app cannot write files — a font picked from
disk existed only in the browser's memory and vanished on reload.

**Root cause.** The app was designed as static files with no server, so there
was no storage layer for user assets at all.

**Fix.** A Vite dev-server plugin (`scripts/user-fonts-plugin.mjs`) adds a
small API: `GET /api/fonts` returns the saved-font manifest, `POST /api/fonts`
persists a validated file to `resources/user/fonts/` and registers it in
`manifest.json`. `fonts.js` validates **before** the network (extension
allowlist + 4-byte magic-byte signature, so a renamed `.txt` is rejected), and
`loadUserFonts()` registers every manifest entry at boot — catching a bad
entry prints the error to console + alert instead of crashing the editor.

**Verified.** Importing a `.woff2` saved it under `resources/user/fonts/`,
added a manifest entry, and the dropdown offered it as "(custom)" on the next
launch; a random file failed the magic-byte check with a clear message.

### 2. The export PNG leaked the editor into the design

**Objective.** Export must produce *exactly the design* — a clean,
high-resolution image that matches what the user composed.

**Symptom.** The downloaded PNG contained selection outlines, side lines,
resize handles, highlighted-text background colors, and a ghost glow on
elements — all editor chrome, none of it part of the design.

**Root cause.** `html-to-image` renders the **live DOM**, and the selection
chrome (box-shadow outline, handles, `::selection` styling) lives in that same
DOM. Worse, the selection box-shadow has a 0.15s transition, so a capture
mid-animation froze a half-faded glow.

**Fix.** Before capture the canvas gets an `.exporting` class that hides every
piece of selection chrome — outline, side lines, resize handles, and
`::selection` colors — for all element types; any in-canvas focus (caret /
text highlight) is blurred first; and transitions are suppressed during
capture so the mid-transition glow can't leak. The class rides along on the
cloned node html-to-image renders.

**Verified.** Exported PNGs for text and image designs were free of every
selection artifact, at 2× pixel ratio.

### 3. Text-shadow "spread" silently killed the whole shadow

**Objective.** The shadow editor must accept what a designer expects to type —
offsets, blur, and optionally a 4th length — and always produce a *valid*
CSS declaration.

**Symptom.** A shadow typed with four lengths (X Y blur **spread** color)
disappeared entirely — the box just had no shadow.

**Root cause.** `text-shadow` supports only offset X, offset Y, and blur;
**spread is a `box-shadow` feature**, so a 4-length `text-shadow` declaration
is invalid CSS and the browser drops the *whole* rule.

**Fix.** `composeShadow()` only ever emits the three supported lengths
(`x y blur rgba(...)`), and `parseShadow()` tolerates an optional 4th length
by simply dropping it — so a pasted pro-style string degrades gracefully
instead of vanishing. Anything not decomposable (multi-shadow strings, etc.)
stays editable as a raw CSS string.

**Verified.** Round-tripping preset and custom values through
compose→apply→parse reproduced the same inputs; pasting a 4-length shadow
string applied a valid 3-length shadow instead of nothing.

### 4. Three shadow UIs fought over one value

**Objective.** The preset dropdown, the four numeric inputs (X/Y/blur/
color/opacity), and the raw CSS field must never contradict each other.

**Symptom.** Picking "Neon Glow" then nudging the X offset left the dropdown
claiming "Neon Glow" even though the value no longer matched; typing a raw
multi-shadow string couldn't be decomposed back into the sliders.

**Root cause.** Three views, no agreed source of truth — each updated
independently and drifted.

**Fix.** The element's stored `textShadow` string is the single source of
truth; all three views are *derived*. The preset is matched by exact
compose-equality against the stored string, else it falls back to "Custom…";
`parseShadow()` returns null for non-decomposable strings, which flips the UI
to raw-CSS mode; "Remove Shadow" resets everything to `none` in one move.

**Verified.** Editing any of the four views re-synced the others and the raw
field; removing the shadow left all inputs at neutral and the dropdown at
"None".

### 5. Resizing an image distorted the photo

**Objective.** An image must stay a *photo* while being scaled — stretching it
to a resized box shouldn't smear it.

**Symptom.** Dragging an image's width/height handles squashed the picture.

**Root cause.** The image was stretched to the container (`object-fit: fill`
by default) with no way to preserve aspect ratio.

**Fix.** A `fitMode` on the image model drives `object-fit` (`fill` stretches,
`cover` scales and crops like a real design tool), selectable from the
right-click context menu, plus a "scale to canvas" action that fits an image
to the canvas while keeping its aspect ratio.

**Verified.** Toggling Cover on a resized box kept the subject framed without
distortion; Fill preserved the old stretch behavior for pixel-art workflows.

### 6. Text couldn't be resized, and handles fought the caret

**Objective.** Text boxes must be resizable with the same 8 drag handles images
get — and typing inside them must stay normal.

**Symptom.** Only images had resize handles; text boxes auto-sized and
couldn't be sized or aligned precisely. And a first naive attempt to add
handles to text made the **caret jump into the handle** when clicked — the
handle sits inside a `contenteditable` box, so it became part of the editing
surface.

**Root cause.** `startResize` rejected any element that wasn't an image, and
handles appended to a contenteditable element are selectable/editable by
nature.

**Fix.** Resize now accepts text and images; every handle is marked
`contenteditable="false"` so clicks land on the handle, never the caret. The
resize math is shared, so corner/edge drags work identically for both types.

**Verified.** Dragging a text box's SE handle grew it 160×60 → 220×100, and
clicking to edit afterward put the caret in the text, not on the handle.

### 7. One undo history for a dozen mutation sites

**Objective.** Undo/redo must cover *every* user action — add, delete,
duplicate, reorder, drag, resize, rotate, style edits, canvas text typing,
cut/paste, Clear — as one consistent, text-field-like history, from both the
keyboard and the toolbox buttons.

**Symptom.** Two failure modes loomed: a mutation site that forgot to record
would silently skip a step (undo does "nothing" once), and recording naively
would make one drag = dozens of undo steps (every mousemove a separate step).

**Root cause.** Mutations happen in many modules (`elements.js` ops,
`canvas.js` model updates + text input, `main.js` Clear), and continuous
gestures update the model continuously.

**Fix.** A central `history.js` keeps JSON snapshots of the element list
(deduped by string compare, capped at 100). Every mutation site calls
`record()` **before** mutating; gestures wrap with `beginGesture()` /
`endGesture()` so one drag/resize/rotate = one undo step. Undo/redo restores
the snapshot, drops a selection id if the element no longer exists, and
re-focuses the previously-active panel input when it survives the re-render —
so Ctrl+Z inside a properties field keeps the caret there. The toolbox
buttons subscribe to a `'history'` bus event to toggle their disabled state.

**Verified.** Live end-to-end: resize→undo→redo, typing→undo, cut→paste→undo,
Clear→undo restores the design, and panel-edit undo keeps focus in the panel
input. Buttons start disabled on an empty canvas and enable/disable in sync
with the stacks.

### 8. Shortcuts had to behave exactly like a text field

**Objective.** Ctrl+X/C/V/Z must act on the *selected element* — but never
hijack normal text editing when the user is actually editing text.

**Symptom.** Naive global handlers cut/copied the **element** while the user
had text highlighted inside a text box; a native text copy left a stale
element in the internal clipboard, so the next Ctrl+V pasted an old element
instead of the copied text; Delete removed the whole box while typing inside
it.

**Root cause.** No context detection — the handler treated every keystroke the
same, and the element clipboard was never invalidated by text-level clipboard
activity.

**Fix.** Context rules, in order: a real form field (properties panel) keeps
native cut/copy/paste but routes undo/redo through the app history so both
share one stack; highlighted text inside a `.text-element` keeps native text
cut/copy/paste; native `cut`/`copy` events **clear the element clipboard** so
a stale element can't be pasted; Delete/Backspace deletes characters when the
caret is inside a text box and the element only otherwise; paste falls back to
native text paste when the element clipboard is empty.

**Verified.** Cut→paste stepped the element +20px (and kept stepping on
repeat); typing undo worked; copying text natively then Ctrl+V pasted text,
not the old element; Delete inside a text box removed a character, not the box.

### 9. "Remove background" meant the text section — not the canvas

**Objective.** One click should strip the background color from a text element
so it sits transparently on the design.

**Symptom.** The feature was initially built for the **canvas**: a "No BG"
toolbox tool wired through `state.js`/`main.js` that toggled the canvas
background. The user clarified — *"the remove background was for text section
not canvas so revise em"*.

**Root cause.** The requirement was read too broadly ("background" → the
canvas behind everything) instead of the text element's own background color.

**Fix.** Reverted the canvas experiment (the `No BG` tool and its state wiring
removed entirely) and implemented the small, correct thing: a "🗑 Remove BG"
button in the text panel's Background Color row that sets the selected text
element's `bgColor` to `transparent` and re-syncs the picker. Because the edit
goes through the normal model-update path, it records into undo history
automatically. A quirk surfaced along the way: the browser sanitizes the
`#ffffff00` color-input value to `#000000` in the picker, while the model
correctly stores `transparent` — cosmetic only.

**Verified.** Text bg red → Remove BG → transparent; Ctrl+Z restored red,
Ctrl+Y re-applied transparent; the canvas-side tool was gone.

### 10. Legacy padding broke the new 4-side editor

**Objective.** The new independent top/right/bottom/left padding must not break
elements created before the feature existed.

**Symptom.** Older elements stored padding as a single number; the new
4-side editor expected an object, so those elements rendered inconsistently
or the editor misread them.

**Root cause.** Two data shapes for the same property across element
generations.

**Fix.** `paddingCss()` treats a number as legacy uniform padding (`8px` on all
sides) and an object as the 4-side form; `updateElementModelAndDOM` merges
partial `{top,right,bottom,left}` updates over whatever the element already
has, so either shape is read and written safely.

**Verified.** Legacy number-padding elements rendered with the old look, and
editing one side migrated it to the object form without disturbing the others.

### 11. One canvas became many

**Objective.** The single canvas had to become **multiple canvases** — any
number of pages, a track that navigates to each one, elements draggable to
another page, and pages clonable *with their contents* — without breaking a
single existing feature.

**Symptom.** Three structural breaks loomed at once: every module read one
global `elements` array (so “the elements” meant one canvas); undo/redo
snapshotted only that array (so restoring a step lost the other pages); and
the background color was a single global value (so pages couldn’t have
their own).

**Root cause.** The single-canvas model was baked into the state accessors,
the history snapshots, and the Clear/background logic — not just in one
place, but in the *contract* every module was written against.

**Fix.** `state.js` now holds a `pages` array ({ id, elements, bgColor }),
with `getElements()` / `setElements()` **scoped to the active page** — so
every existing module (drag, resize, panel, shortcuts, export) kept working
with zero changes. `history.js` snapshots the whole document
(`{ pages, activePageId }`), so undo/redo spans pages and restores the page
you were on. The BG picker writes to the active page; Clear clears only the
active page (and undo now restores its background too — it was never in
history before). Clone deep-copies the page with **fresh element ids** so
nothing aliases.

**Verified.** Live end-to-end: add → clone (contents copied with
independent ids) → drag an element onto page 2’s thumbnail (auto-switch,
still selected) → delete the page → full undo replay of every step across
pages; per-page backgrounds held.

### 12. Selecting several elements at once

**Objective.** Ctrl+click must select **multiple elements** and let the user
copy / paste / delete / drag them as one unit — “to be able to copy paste
simultaneously”.

**Symptom.** The selection was a single id, so Ctrl+click could only ever
re-select; and a naive group drag would let members drift apart while the
primary snapped to the pointer.

**Root cause.** One selection slot, and drag math anchored to a single
element’s offset.

**Fix.** Selection is now a list: `selectedElementIds` with the **primary =
first id**. `toggleSelectElement()` flips membership; every selected element
gets the outline while only the primary keeps resize/rotate handles and
drives the panel (which shows “N elements selected — edits apply to the
first one”). Group drag snapshots every member’s position and applies the
same delta (clamped), so relative layout is preserved; the clipboard stores
the whole group, and cut/copy/paste/delete operate on the full selection in
one undo step.

**Verified.** Ctrl+click on 2 elements → both outlined, panel note correct
→ Ctrl+C / Ctrl+V duplicated exactly 2 (undo/redo replay) → group drag
moved both by the same delta → Delete removed both → group drag onto a
page thumbnail moved both across.

### 13. The thumbnail showed the wrong picture

**Objective.** The page track is the *visual* of each canvas — it must
faithfully show what’s on each page, and move live while content is dragged.

**Symptom.** Four failures: elements sat at the wrong positions (a
center-placed text box didn’t appear at all), an image **vanished when its
z-order changed**, text never showed in the indicator, and thumbnails froze
during drags instead of tracking the content.

**Root cause.** One coordinate bug: thumbnails reused `buildElementDiv`,
which positions in **canvas pixels** (`left/top` = 250px etc.) — but the
thumbnail canvas is only ~120px wide, so `overflow:hidden` clipped everything
except the top-left corner. That single bug produced the wrong positions, the
“vanishing” image (most content was already clipped out; reordering just
shuffled which sliver was on top), and the missing text (default text sits at
canvas center, outside the clip). A separate issue: the active thumbnail
**rebuilt** on every transform, so it never animated mid-drag and wiped the
drop-target highlight.

**Fix.** Thumbnail elements are wrapped in a **scaled layout box** —
`left/top/width/height` × the thumbnail scale, with the inner element
shrunk via CSS `scale` around its top-left — so they land exactly where the
model says, at the right size, with correct z-order (thumb stacking follows
model order). The active thumbnail now subscribes to `transform`
(drag/resize/rotate) and `text-edited` and mutates its nodes **in place**
instead of rebuilding — no node churn, so the preview moves live during the
gesture *and* the drop-target highlight survives.

**Verified.** Scaled positions match the model for text and image; both stay
visible through send-to-front/back; the thumb tracks the drag **mid-gesture**
(before mouseup); typing updates the thumb text; the drop highlight persists
while dragging across the live-refreshing track; the moved element lands on
page 2’s thumb at the correct scaled position.

### 14. Mobile copy/paste, a crowded toolbox, and a menu that fought the panel

**Objective.** Mobile users have no Ctrl+C/Ctrl+X keyboard, so a button must
let them select components and copy/paste them — with an explicit cancel.
At the same time the left toolbox needed slimming and the two undo/redo
buttons needed to become one.

**Symptom.** Three failures: (1) a first draft over-built — a six-button
bottom action bar (Copy/Cut/Paste/All/Delete/Cancel) that was heavier than
the ask; (2) the floating Copy/Paste menu was fixed to the right edge of
the screen, which landed it **on top of the properties panel** — the two
UIs fought for the same space; (3) tapping a text element in select mode
summoned the keyboard, because the selection chrome auto-focuses the
primary text element to place the caret.

**Root cause.** (1) Building a generic action bar instead of the smallest
thing that matches the sentence; (2) hard-coded right-edge positioning —
the panel already owns that side of the screen; (3) `applySelectionToDOM`
had no idea select mode existed.

**Fix.** Reduced the menu to exactly two actions — **Copy then Paste** —
with a strict state machine (nothing selected → both off; selected → Copy
on, Paste off; Copy clicked → Copy off, Paste on, repeatable). The menu is
now positioned **relative to the Select button** via `getBoundingClientRect`
— right of the button on desktop, dropping below it on narrow screens,
clamped to the viewport, and repositioned on resize — so it can never
cover the panel. `applySelectionToDOM` skips the caret-focus while select
mode is on, so a tap never pops the mobile keyboard. Cancellable exactly
as specified: tapping Select again (or Esc) while Paste is still off drops
the selected components; after a paste, exiting just keeps the result.
The toolbox shrank 72px→54px with tighter padding/icons, and undo/redo
became one split control whose halves disable independently.

**Verified.** State machine asserted end-to-end (tap → Copy on/Paste off;
Copy → Copy off/Paste on; Paste → pasted + Paste stays on; toggle-off
with Paste still off → selection cleared); menu geometry checked against
the Select button with **zero overlap with the properties panel** and
in-viewport clamping; `document.activeElement` stayed on BODY after a
select-mode tap (no caret); undo/redo round-trip worked through the merged
control; screenshots confirmed the compact toolbox and the darker active
Select state.

---

### 15. One Export button became four outputs

**Objective.** Replace the single Export button with a dropdown offering four
ways out of the app: the current canvas as a PNG, every page as its own PNG,
all pages wrapped in a ZIP, and all pages in one PDF.

**Symptom.** The existing exporter could only capture the live canvas —
the page the user happened to be looking at. Exporting “all pages”
naively would have meant switching pages (disturbing the user's view,
selection and undo state), and there was no zip or PDF path at all.

**Root cause.** The exporter was coupled to the visible DOM: it captured
`designCanvas` directly instead of the model. The model→DOM split
(`buildElementDiv`) existed for the thumbnails but wasn't reused, so a second
render surface had to be built anyway — and every new output format
(zip, pdf) would have meant duplicating the capture logic.

**Fix.** Split export into capture + delivery. `capturePage(page)` renders
*any* page model — not just the active one — into an offscreen
`.canvas` node built with the same `buildElementDiv` the canvas and
thumbnails use, then hands the blob to html-to-image; the live canvas,
selection and focus are never touched. One capture primitive now feeds all
four menu actions: current (live capture, unchanged behavior), all (loop,
with a small delay between downloads so browsers don't throttle the burst),
ZIP (JSZip packs every page PNG into `design-pages.zip`), and PDF (jsPDF
adds each PNG as a full page sized to the canvas aspect ratio). The button
became a dropdown with per-step busy labels (“⏳ Page 2/3…”),
outside-click/Escape close, and a busy guard.

**Verified.** All four actions run end-to-end against real pages: current
→ `design-*.png`; all → `page-1.png`/`page-2.png`/`page-3.png`;
ZIP → valid archive whose entries include every page PNG; PDF →
valid `%PDF` with exactly N pages. The offscreen capture leaves the canvas,
active page and selection untouched, the menu closes on outside click and
stays in-viewport, and the button label restores after every export. Only
the pre-existing `#ffffff00` color-input warning remains in the console.

**Follow-up bug (reported by the user).** "PDF blank pages, ZIP doesn't
export" — the offscreen capture was producing *blank* PNGs, which made
the PDF pages empty and the ZIP useless. Root cause: html-to-image renders
the cloned node at its own `left/top`, so parking the capture node at
`left:-99999px` (the usual "hide it" trick) rendered the clone
99,999px off-canvas — a completely white image that still decoded fine,
so the earlier check only counting filenames and byte sizes passed. Fix:
wrap the capture node inside an offscreen *host* div and keep the node
itself at `position:absolute; left:0; top:0` — the clone then lands at
the render container's origin where it is visible, with nothing flickering
on screen. Re-verified by decoding the PNGs *inside* the ZIP (text and
image pixels present) and checking the PDF's embedded image stream is the
full RGB payload, not a compressed blank.

---

### 16. SVG library — from hardcoded JS arrays to a JSON-driven category system

**The problem:** The user wanted a library of pre-built SVG icons (arrows) that
could be browsed, multi-selected, and placed on the canvas. The initial
implementation hardcoded SVGs as a JavaScript array in `svg-data.js`, which
meant adding a new category required editing the JS file and updating the
`CATEGORIES` constant — tight coupling between data and UI.

**What was built:**
- A **modal picker** (`svg-picker.js`) with category-based grid layout, multi-select
  (click to toggle), live preview of the last-selected SVG, and a count badge.
- **36 arrow SVGs** extracted from an HTML sample file into individual files
  under `resources/svgs/arrows/`.
- A **recolor system** in `canvas.js` (`recolorSvg()`) that replaces fill colors
  in SVG markup, with a color picker and reset button in the properties panel.
- Full integration: placed SVGs support drag, resize, rotate, duplicate,
  layering, and export — same as text and image elements.

**The JSON refactor:** The SVG data was moved from a JS module
(`svg-data.js`) to a JSON file (`svg-data.json`) with categories as top-level
keys:

```json
{
  "arrows": {
    "arrow-01": "<svg viewBox=\"0 0 191.56 62.36\">...</svg>",
    "arrow-02": "<svg viewBox=\"0 0 203 48.99\">...</svg>"
  }
}
```

The picker now **derives categories dynamically** from the JSON keys — adding a
new category (e.g. `"shapes"`, `"icons"`) means adding a new key to the JSON
file. No code changes needed. The category label is auto-capitalized from the
key name.

**Key insight:** When data is organized by structure (category keys) rather than
flat arrays, the UI can adapt without code changes. The JSON file becomes the
single source of truth for both data and taxonomy.

**Files involved:**
- `src/svg-data.json` — SVG icons organized by category
- `src/svg-picker.js` — modal with dynamic category derivation
- `src/canvas.js` — `recolorSvg()` for live fill-color changes
- `src/properties.js` — SVG fill color picker panel
- `resources/svgs/arrows/` — individual SVG source files


### 17. Directory restructuring — from flat src/ to feature-based folders with path aliases

**The problem:** All 19 source files lived flat in `src/` with no hierarchy. As
the codebase grew (text, image, SVG elements, multi-page, export, custom fonts,
shadow editor, select mode), finding anything required scanning the entire
directory. Relative imports like `../../resources/svgs/arrows/svg-data.json`
created fragile, hard-to-read paths.

**What was done:**
- Organized `src/` into **feature-based directories**: `core/`, `canvas/`,
  `elements/`, `interactions/`, `selection/`, `history/`, `properties/`,
  `pages/`, `export/`, `fonts/`, `shortcuts/`, `shadow/`, `svg/`.
- Each directory owns exactly one concern — `core/` holds foundational modules
  (state, bus, dom, constants, utils), while feature directories each contain
  their single file.
- Set up **Vite path aliases**: `@` → `src/`, `@resources` → `resources/`.
  Imports now read `@/core/bus.js` instead of `../bus.js`.
- Moved `svg-data.json` out of `src/` into `resources/svgs/arrows/` where it
  belongs — it's data, not code.

**New import style:**
```js
// Before
import { emit } from '../bus.js';
import svgData from '../resources/svgs/arrows/svg-data.json';

// After
import { emit } from '@/core/bus.js';
import svgData from '@resources/svgs/arrows/svg-data.json';
```

**Key insight:** Directories should reflect *what something is*, not just that
it's a file. Resources (SVGs, fonts, images) live in `resources/`. Code lives
in `src/`, subdivided by feature. Path aliases eliminate the brittle `../../`
chains that break every time a file moves.


## Recurring theme (worth remembering)

Most of these struggles were one of **three things**:

1. **Misreading the requirement.** "Remove background" was the text section,
   not the canvas. The fix wasn't more engineering — it was reading the user's
   words precisely, reverting the wrong build fast, and shipping the small
   correct one. When in doubt, build the smallest thing that matches the exact
   sentence.
2. **Silent invalidity and silent drift.** A 4-length `text-shadow` was
   *valid-looking* but dropped whole by the browser; three shadow UIs drifted
   because there was no single source of truth; a stale element clipboard
   pasted the wrong thing. The pattern: **one source of truth (the model),
   everything else derived, and invalid input degraded explicitly** — never
   silently.
3. **Context blindness in global behavior.** Global shortcuts and export
   capture treat every state the same and break text editing or leak editor
   chrome. The fix is context detection and hiding, not more special cases.
4. **Two coordinate spaces, one model.** The thumbnail bug was the classic
   “scaled preview” trap: shrinking the *content* without scaling the
   *layout box* (`left/top/width/height`) clips and misplaces everything.
   Whenever a preview or export renders the model at a different size, scale
   the box and the content together. And dev tools can bite too: many edits
   across modules left Vite’s HMR with duplicate state instances (dynamic
   imports saw a different `state.js`), which only a clean dev-server restart
   cured.
5. **One model, many render surfaces.** The canvas, the page thumbnails and
   every export are just surfaces for the same element models. Each new
   surface (thumbnails, per-page export) was the fix *reusing* the shared
   `buildElementDiv` instead of duplicating layout logic — and the two
   real rendering bugs in this project (unscaled thumbnails, selection chrome
   leaking into PNGs) both came from surfaces that had drifted off that
   shared path.

The single highest-value debugging move was running the real dev server and
driving real input events end-to-end. That's how the undo chains, focus
retention, and clipboard fallbacks were proven — and it's also where one
testing trap surfaced: **undo/redo re-renders replace every DOM node**, so a
captured element reference goes stale after each step; always re-query the DOM
fresh after a re-render instead of reusing old handles.
