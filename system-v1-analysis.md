# Overall Objective of the Feature

## The objective in one statement

Build a **Canva-style image editor** that runs entirely in the browser — no
sign-up, no backend — where the user can compose **social-media designs**
(1:1 posts, 4:5, 9:16 stories, 16:9 landscape) by placing **images and text
boxes** on a canvas, styling them like a pro design tool (**5 brand-style font
families + custom font imports, text shadows with presets, independent
padding & corner radius, rotation & skew**), **resizing and transforming
elements with drag handles**, and finally **exporting a clean high-resolution
PNG** — all while every action is **undoable/redoable and keyboard-driven the
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

---

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

The single highest-value debugging move was running the real dev server and
driving real input events end-to-end. That's how the undo chains, focus
retention, and clipboard fallbacks were proven — and it's also where one
testing trap surfaced: **undo/redo re-renders replace every DOM node**, so a
captured element reference goes stale after each step; always re-query the DOM
fresh after a re-render instead of reusing old handles.
