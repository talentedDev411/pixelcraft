// Everything that reads/writes the canvas DOM: sizing, full re-render,
// selection chrome, and live model→DOM updates.

import { emit, on } from './bus.js';
import { dom } from './dom.js';
import { ASPECT_RATIOS } from './constants.js';
import {
    getAspectRatio,
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getSelectedElementId,
    setCanvasSize,
} from './state.js';
import { findElementById } from './utils.js';

/** Recompute canvas pixel size from the selected aspect ratio and viewport. */
export function updateCanvasSize() {
    const { canvasArea, canvasWrapper } = dom;
    const ratio = ASPECT_RATIOS[getAspectRatio()];
    const maxW = Math.min(canvasArea.clientWidth - 60, 600);
    const maxH = canvasArea.clientHeight - 60;
    let w, h;
    if (ratio[0] / ratio[1] > maxW / maxH) {
        w = maxW;
        h = w * (ratio[1] / ratio[0]);
    } else {
        h = maxH;
        w = h * (ratio[0] / ratio[1]);
    }
    setCanvasSize(w, h);
    canvasWrapper.style.width = w + 'px';
    canvasWrapper.style.height = h + 'px';
}

/** Rebuild every element in the canvas DOM from the current model. */
export function fullRender() {
    const { designCanvas } = dom;
    designCanvas.innerHTML = '';
    getElements().forEach(el => {
        const div = document.createElement('div');
        div.className = `element ${el.type}-element`;
        if (el.id === getSelectedElementId()) div.classList.add('selected');
        div.style.left = el.x + 'px';
        div.style.top = el.y + 'px';
        div.style.width = el.width + 'px';
        div.style.height = el.height + 'px';
        div.dataset.id = el.id;

        if (el.type === 'text') {
            div.textContent = el.content;
            div.style.fontSize = el.fontSize + 'px';
            div.style.fontWeight = el.fontWeight || '400';
            div.style.color = el.color;
            div.style.backgroundColor = el.bgColor === 'transparent' ? 'transparent' : el.bgColor;
            div.style.textShadow = el.textShadow;
        } else if (el.type === 'image') {
            const img = document.createElement('img');
            img.src = el.src;
            img.draggable = false;
            img.style.objectFit = el.fitMode || 'fill';
            div.appendChild(img);
        }
        designCanvas.appendChild(div);
    });
    if (getSelectedElementId()) applySelectionToDOM(getSelectedElementId());
}

/** Reflect the current selection in the DOM (handles, edit mode, focus). */
export function applySelectionToDOM(id) {
    const { designCanvas } = dom;
    const prevSelected = designCanvas.querySelector('.element.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
        if (prevSelected.classList.contains('text-element')) {
            prevSelected.setAttribute('contenteditable', 'false');
        }
        prevSelected.querySelectorAll('.resize-handle').forEach(h => h.remove());
    }
    if (!id) return;
    const elDiv = designCanvas.querySelector(`[data-id="${id}"]`);
    if (!elDiv) return;
    elDiv.classList.add('selected');
    const el = findElementById(getElements(), id);
    if (el && el.type === 'text') {
        elDiv.setAttribute('contenteditable', 'true');
        if (document.activeElement !== elDiv) {
            elDiv.focus();
            const range = document.createRange();
            range.selectNodeContents(elDiv);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    } else if (el && el.type === 'image') {
        addResizeHandles(elDiv);
    }
}

/** Live-editing: update the model and apply changes to the existing DOM node. */
export function updateElementModelAndDOM(id, updates, clampToCanvas = false) {
    const el = findElementById(getElements(), id);
    if (!el) return;
    // Keep the model in sync — the DOM must never be ahead of the state,
    // or a later fullRender would silently revert live edits.
    if (updates.x !== undefined) el.x = updates.x;
    if (updates.y !== undefined) el.y = updates.y;
    if (updates.width !== undefined) el.width = updates.width;
    if (updates.height !== undefined) el.height = updates.height;
    if (updates.fitMode !== undefined) el.fitMode = updates.fitMode;
    if (updates.content !== undefined) el.content = updates.content;
    if (updates.fontSize !== undefined) el.fontSize = updates.fontSize;
    if (updates.fontWeight !== undefined) el.fontWeight = updates.fontWeight;
    if (updates.color !== undefined) el.color = updates.color;
    if (updates.bgColor !== undefined) el.bgColor = updates.bgColor;
    if (updates.textShadow !== undefined) el.textShadow = updates.textShadow;
    if (updates.src !== undefined) el.src = updates.src;
    if (clampToCanvas) {
        if (el.x < 0) { el.width += el.x; el.x = 0; }
        if (el.y < 0) { el.height += el.y; el.y = 0; }
        if (el.x + el.width > getCanvasWidth()) el.width = getCanvasWidth() - el.x;
        if (el.y + el.height > getCanvasHeight()) el.height = getCanvasHeight() - el.y;
        el.width = Math.max(20, el.width);
        el.height = Math.max(20, el.height);
    }
    const domEl = dom.designCanvas.querySelector(`[data-id="${id}"]`);
    if (!domEl) return;
    domEl.style.left = el.x + 'px';
    domEl.style.top = el.y + 'px';
    domEl.style.width = el.width + 'px';
    domEl.style.height = el.height + 'px';
    if (el.type === 'text') {
        if (updates.content !== undefined) domEl.textContent = updates.content;
        if (updates.fontSize !== undefined) domEl.style.fontSize = updates.fontSize + 'px';
        if (updates.fontWeight !== undefined) domEl.style.fontWeight = updates.fontWeight;
        if (updates.color !== undefined) domEl.style.color = updates.color;
        if (updates.bgColor !== undefined) domEl.style.backgroundColor = updates.bgColor === 'transparent' ? 'transparent' : updates.bgColor;
        if (updates.textShadow !== undefined) domEl.style.textShadow = updates.textShadow;
    } else if (el.type === 'image') {
        if (updates.src !== undefined) {
            const img = domEl.querySelector('img');
            if (img) img.src = updates.src;
        }
        if (updates.fitMode !== undefined) {
            const img = domEl.querySelector('img');
            if (img) img.style.objectFit = updates.fitMode;
        }
    }
}

/** Bootstrap: subscribe to domain events and wire the canvas event delegation. */
export function initCanvas() {
    on('render', fullRender);
    on('selection', () => applySelectionToDOM(getSelectedElementId()));

    // Live text editing happens directly in the canvas (contenteditable).
    // Delegated listener keeps the model in sync without a full re-render,
    // which would steal focus and break the cursor position.
    dom.designCanvas.addEventListener('input', e => {
        const div = e.target.closest('.text-element');
        if (!div) return;
        const el = findElementById(getElements(), div.dataset.id);
        if (!el) return;
        el.content = div.textContent;
        emit('text-edited', el.content);
    });
}

/** Attach the 8 resize handles to a selected element's DOM node. */
function addResizeHandles(parentDiv) {
    ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        handle.dataset.handle = pos;
        parentDiv.appendChild(handle);
    });
}
