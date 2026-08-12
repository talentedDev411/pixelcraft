// Creating, deleting, duplicating and re-ordering elements. Structural changes
// go through `setElements` + a 'render' event so the canvas stays the single
// place that knows how to draw.

import { emit } from './bus.js';
import { ELEMENT_DEFAULTS, MAX_IMAGE_DIM } from './constants.js';
import {
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getSelectedElementId,
    setElements,
} from './state.js';
import { generateId } from './utils.js';
import { deselectAll, selectElement } from './selection.js';

/** Add a model element, re-render, and select it. */
function addElement(el) {
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
    setElements(getElements().filter(el => el.id !== id));
    if (getSelectedElementId() === id) deselectAll();
    emit('render');
}

export function duplicateElement(id) {
    const idx = getElements().findIndex(el => el.id === id);
    if (idx === -1) return;
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
    setElements([...getElements().filter(e => e.id !== id), el]);
    emit('render');
    selectElement(el.id);
}

export function moveElementToBack(id) {
    const el = getElements().find(e => e.id === id);
    if (!el) return;
    setElements([el, ...getElements().filter(e => e.id !== id)]);
    emit('render');
    selectElement(el.id);
}
