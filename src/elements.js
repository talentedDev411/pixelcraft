// Creating, deleting, duplicating and re-ordering elements. Structural changes
// go through `setElements` + a 'render' event so the canvas stays the single
// place that knows how to draw.

import { emit } from './bus.js';
import { ELEMENT_DEFAULTS, MAX_IMAGE_DIM } from './constants.js';
import { record } from './history.js';
import {
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getSelectedElementId,
    setElements,
} from './state.js';
import { clamp, findElementById, generateId } from './utils.js';
import { deselectAll, selectElement } from './selection.js';

/** Add a model element, re-render, and select it. */
function addElement(el) {
    record();
    setElements([...getElements(), el]);
    emit('render');
    selectElement(el.id);
}

export function addTextElement() {
    addElement({
        id: generateId(),
        type: 'text',
        content: 'Your text here',
        x: getCanvasWidth() / 2 - 80,
        y: getCanvasHeight() / 2 - 30,
        width: 160,
        height: 60,
        ...ELEMENT_DEFAULTS.text,
    });
}

export function addImageElement(file) {
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > MAX_IMAGE_DIM || h > MAX_IMAGE_DIM) {
                const r = Math.min(MAX_IMAGE_DIM / w, MAX_IMAGE_DIM / h);
                w *= r;
                h *= r;
            }
            addElement({
                id: generateId(),
                type: 'image',
                src: e.target.result,
                x: Math.max(0, getCanvasWidth() / 2 - w / 2),
                y: Math.max(0, getCanvasHeight() / 2 - h / 2),
                width: w,
                height: h,
                ...ELEMENT_DEFAULTS.image,
            });
        };
    };
    reader.readAsDataURL(file);
}

export function deleteElement(id) {
    record();
    setElements(getElements().filter(el => el.id !== id));
    if (getSelectedElementId() === id) deselectAll();
    emit('render');
}

export function duplicateElement(id) {
    const idx = getElements().findIndex(el => el.id === id);
    if (idx === -1) return;
    record();
    const original = getElements()[idx];
    const copy = { ...original, id: generateId(), x: original.x + 20, y: original.y + 20 };
    const next = [...getElements()];
    next.splice(idx + 1, 0, copy);
    setElements(next);
    emit('render');
    selectElement(copy.id);
}

export function moveElementToFront(id) {
    const el = getElements().find(e => e.id === id);
    if (!el) return;
    record();
    setElements([...getElements().filter(e => e.id !== id), el]);
    emit('render');
    selectElement(el.id);
}

export function moveElementToBack(id) {
    const el = getElements().find(e => e.id === id);
    if (!el) return;
    record();
    setElements([el, ...getElements().filter(e => e.id !== id)]);
    emit('render');
    selectElement(el.id);
}

// ── Cut / copy / paste (same-session clipboard) ──

/** Internal clipboard holding the last cut/copied element, if any. */
let clipboard = null;

/** Remove the selected element and remember it for Ctrl+V (Ctrl+X). */
export function cutElement(id = getSelectedElementId()) {
    const el = findElementById(getElements(), id);
    if (!el) return false;
    record();
    clipboard = { element: structuredClone(el), pasteCount: 0 };
    setElements(getElements().filter(e => e.id !== id));
    if (getSelectedElementId() === id) deselectAll();
    emit('render');
    return true;
}

/** Remember the selected element for Ctrl+V without removing it (Ctrl+C). */
export function copyElement(id = getSelectedElementId()) {
    const el = findElementById(getElements(), id);
    if (!el) return false;
    clipboard = { element: structuredClone(el), pasteCount: 0 };
    return true;
}

/** Drop the element clipboard (e.g. after a native text cut/copy). */
export function clearClipboard() {
    clipboard = null;
}

/**
 * Paste the clipped element, nudged away from the original spot each time
 * so repeats stay visible. Returns true when an element was pasted.
 */
export function pasteElement() {
    if (!clipboard) return false;
    record();
    const src = clipboard.element;
    const step = 20 * (clipboard.pasteCount + 1);
    const copy = {
        ...src,
        id: generateId(),
        x: clamp(src.x + step, 0, Math.max(0, getCanvasWidth() - src.width)),
        y: clamp(src.y + step, 0, Math.max(0, getCanvasHeight() - src.height)),
    };
    setElements([...getElements(), copy]);
    emit('render');
    selectElement(copy.id);
    clipboard.pasteCount += 1;
    return true;
}
