// Creating, deleting, duplicating and re-ordering elements. Structural changes
// go through `setElements` + a 'render' event so the canvas stays the single
// place that knows how to draw.

import { emit } from './bus.js';
import { ELEMENT_DEFAULTS, MAX_IMAGE_DIM } from './constants.js';
import { record } from './history.js';
import {
    getActivePage,
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getPageById,
    getSelectedElementId,
    getSelectedIds,
    setActivePageId,
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

// ── Cut / copy / paste (same-session clipboard, supports multi-select) ──

/** Internal clipboard holding the last cut/copied elements, if any. */
let clipboard = null;

/** The ids of every currently selected element, or null when none. */
function selectedIdsOrNull() {
    const ids = getSelectedIds();
    return ids.length ? ids : null;
}

/** Remove the selected element(s) and remember them for Ctrl+V (Ctrl+X). */
export function cutElement(id) {
    const ids = id ? [id] : selectedIdsOrNull();
    if (!ids) return false;
    const els = ids.map(i => findElementById(getElements(), i)).filter(Boolean);
    if (!els.length) return false;
    record();
    clipboard = { elements: els.map(e => structuredClone(e)), pasteCount: 0 };
    setElements(getElements().filter(e => !ids.includes(e.id)));
    deselectAll();
    emit('render');
    return true;
}

/** Remember the selected element(s) for Ctrl+V without removing them (Ctrl+C). */
export function copyElement(id) {
    const ids = id ? [id] : selectedIdsOrNull();
    if (!ids) return false;
    const els = ids.map(i => findElementById(getElements(), i)).filter(Boolean);
    if (!els.length) return false;
    clipboard = { elements: els.map(e => structuredClone(e)), pasteCount: 0 };
    return true;
}

/** Drop the element clipboard (e.g. after a native text cut/copy). */
export function clearClipboard() {
    clipboard = null;
}

/**
 * Paste the clipped element(s), nudged away from the original spot each time
 * so repeats stay visible. Returns true when anything was pasted.
 */
export function pasteElement() {
    if (!clipboard || !clipboard.elements.length) return false;
    record();
    const step = 20 * (clipboard.pasteCount + 1);
    const copies = clipboard.elements.map(src => ({
        ...src,
        id: generateId(),
        x: clamp(src.x + step, 0, Math.max(0, getCanvasWidth() - src.width)),
        y: clamp(src.y + step, 0, Math.max(0, getCanvasHeight() - src.height)),
    }));
    setElements([...getElements(), ...copies]);
    emit('render');
    selectElement(copies[0].id);
    clipboard.pasteCount += 1;
    return true;
}

/** Delete every selected element (used by the Delete/Backspace shortcut). */
export function deleteSelectedElements() {
    const ids = getSelectedIds();
    if (!ids.length) return false;
    record();
    setElements(getElements().filter(e => !ids.includes(e.id)));
    deselectAll();
    emit('render');
    return true;
}

/**
 * Move an element from the active page onto another page (drag-to-thumbnail).
 * Switches to the target page and keeps the element selected.
 */
export function moveElementToPage(id, targetPageId) {
    return moveElementsToPage([id], targetPageId);
}

/** Move every given element (all selected) onto another page together. */
export function moveElementsToPage(ids, targetPageId) {
    const srcPage = getActivePage();
    const els = ids.map(i => findElementById(srcPage ? srcPage.elements : [], i)).filter(Boolean);
    const target = getPageById(targetPageId);
    if (!srcPage || !els.length || !target || target.id === srcPage.id) return false;
    record();
    const idSet = new Set(els.map(el => el.id));
    srcPage.elements = srcPage.elements.filter(e => !idSet.has(e.id));
    target.elements = [...target.elements, ...els];
    setActivePageId(target.id);
    emit('render'); // renders the target page; the selection ids are unchanged
    return true;
}
