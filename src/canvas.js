// Everything that reads/writes the canvas DOM: sizing, full re-render,
// selection chrome, and live model→DOM updates.

import { emit, on } from './bus.js';
import { dom } from './dom.js';
import { ASPECT_RATIOS, paddingCss, radiusCss, transformCss } from './constants.js';
import { inGesture, record } from './history.js';
import { isSelectMode } from './selectmode.js';
import {
    getActivePage,
    getAspectRatio,
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getSelectedIds,
    isSelected,
    setCanvasSize,
} from './state.js';
import { findElementById } from './utils.js';

/** Recompute canvas pixel size from the selected aspect ratio and viewport. */
export function updateCanvasSize() {
    const { canvasArea, canvasWrapper } = dom;
    const ratio = ASPECT_RATIOS[getAspectRatio()];
    const maxW = Math.min(canvasArea.clientWidth - 60, 600);
    // Reserve room for the page track below the canvas.
    const trackH = dom.pageTrack ? dom.pageTrack.offsetHeight : 0;
    const maxH = canvasArea.clientHeight - 60 - trackH;
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

/**
 * Build a DOM node for one element model. Shared by the canvas and the page
 * track thumbnails (scale < 1).
 *
 * For thumbnails the node is wrapped in a box whose left/top/width/height are
 * scaled to the thumb's pixel size, and the inner element is shrunk with a
 * CSS scale around its top-left corner — so an element lands exactly where it
 * sits on the real canvas instead of being clipped by the thumb's bounds.
 */
export function buildElementDiv(el, { selected = false, scale = 1 } = {}) {
    const div = document.createElement('div');
    div.className = `element ${el.type}-element`;
    if (selected) div.classList.add('selected');
    div.style.left = el.x + 'px';
    div.style.top = el.y + 'px';
    div.style.width = el.width + 'px';
    div.style.height = el.height + 'px';
    div.dataset.id = el.id;

    if (el.type === 'text') {
        div.textContent = el.content;
        div.style.fontSize = el.fontSize + 'px';
        div.style.fontWeight = el.fontWeight || '400';
        div.style.fontFamily = `'${el.fontFamily}', sans-serif`;
        div.style.color = el.color;
        div.style.backgroundColor = el.bgColor === 'transparent' ? 'transparent' : el.bgColor;
        div.style.textShadow = el.textShadow;
        div.style.borderRadius = radiusCss(el);
        div.style.padding = paddingCss(el);
        div.style.transform = transformCss(el);
    } else if (el.type === 'image') {
        const img = document.createElement('img');
        img.src = el.src;
        img.draggable = false;
        img.style.objectFit = el.fitMode || 'fill';
        div.appendChild(img);
        div.style.transform = transformCss(el);
    }
    if (scale !== 1) {
        // Thumbnail mode: a wrapper pinned to the scaled canvas position.
        const wrap = document.createElement('div');
        wrap.className = 'thumb-el';
        wrap.dataset.id = el.id;
        wrap.style.left = (el.x * scale) + 'px';
        wrap.style.top = (el.y * scale) + 'px';
        wrap.style.width = (el.width * scale) + 'px';
        wrap.style.height = (el.height * scale) + 'px';
        div.style.position = 'absolute';
        div.style.left = '0';
        div.style.top = '0';
        div.style.transformOrigin = '0 0';
        div.style.transform = `scale(${scale}) ${transformCss(el)}`;
        wrap.appendChild(div);
        return wrap;
    }
    return div;
}

/** Rebuild every element in the canvas DOM from the current model. */
export function fullRender() {
    const { designCanvas } = dom;
    designCanvas.innerHTML = '';
    // The canvas paints the active page's background, and the toolbox swatch
    // follows it (also after undo/redo restores a different background).
    const page = getActivePage();
    const bg = page ? page.bgColor : '#ffffff';
    designCanvas.style.backgroundColor = bg;
    if (dom.bgColorInput) dom.bgColorInput.value = bg;

    getElements().forEach(el => {
        designCanvas.appendChild(buildElementDiv(el, { selected: isSelected(el.id) }));
    });
    if (getSelectedIds().length) applySelectionToDOM(getSelectedIds());
}

/**
 * Reflect the current selection in the DOM. Every selected element gets the
 * outline; only the primary (first) element gets the resize/rotate handles
 * and — for text — the contenteditable caret.
 */
export function applySelectionToDOM(ids) {
    const { designCanvas } = dom;
    const list = Array.isArray(ids) ? ids : (ids ? [ids] : []);
    const primary = list[0] || null;

    // Clear previous chrome: outline, edit mode, handles.
    designCanvas.querySelectorAll('.element.selected').forEach(elDiv => {
        elDiv.classList.remove('selected');
        if (elDiv.classList.contains('text-element')) {
            elDiv.setAttribute('contenteditable', 'false');
        }
        elDiv.querySelectorAll('.resize-handle, .rotate-handle').forEach(h => h.remove());
    });

    list.forEach(id => {
        const elDiv = designCanvas.querySelector(`[data-id="${id}"]`);
        if (!elDiv) return;
        elDiv.classList.add('selected');
        const el = findElementById(getElements(), id);
        if (!el || id !== primary) return;
        // Primary only: editable text + drag handles.
        if (el.type === 'text') {
            elDiv.setAttribute('contenteditable', 'true');
            addResizeHandles(elDiv);
            addRotateHandle(elDiv);
            // In select mode a tap must never summon the keyboard — the
            // mobile user is picking elements, not editing text.
            if (document.activeElement !== elDiv && !isSelectMode()) {
                elDiv.focus();
                const range = document.createRange();
                range.selectNodeContents(elDiv);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        } else if (el.type === 'image') {
            addResizeHandles(elDiv);
            addRotateHandle(elDiv);
        }
    });
}

/** Live-editing: update the model and apply changes to the existing DOM node. */
export function updateElementModelAndDOM(id, updates, clampToCanvas = false) {
    const el = findElementById(getElements(), id);
    if (!el) return;
    // Record the pre-change state as an undo point (skipped while a drag /
    // resize / rotate gesture is running — that records once at start).
    if (!inGesture()) record();
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
    if (updates.fontFamily !== undefined) el.fontFamily = updates.fontFamily;
    if (updates.rotation !== undefined) el.rotation = updates.rotation;
    if (updates.skewX !== undefined) el.skewX = updates.skewX;
    if (updates.skewY !== undefined) el.skewY = updates.skewY;
    if (updates.padding !== undefined) {
        // Padding can be a single number (legacy) or a partial {top,right,bottom,left}.
        el.padding = typeof updates.padding === 'object'
            ? { ...(typeof el.padding === 'object' ? el.padding : {}), ...updates.padding }
            : updates.padding;
    }
    if (updates.borderRadius !== undefined) el.borderRadius = { ...(el.borderRadius || {}), ...updates.borderRadius };
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
        if (updates.fontFamily !== undefined) domEl.style.fontFamily = `'${updates.fontFamily}', sans-serif`;
        if (updates.padding !== undefined) domEl.style.padding = paddingCss(el);
        if (updates.borderRadius !== undefined) domEl.style.borderRadius = radiusCss(el);
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
    if (updates.rotation !== undefined || updates.skewX !== undefined || updates.skewY !== undefined) {
        domEl.style.transform = transformCss(el);
    }
}

/** Bootstrap: subscribe to domain events and wire the canvas event delegation. */
export function initCanvas() {
    on('render', fullRender);
    on('selection', () => applySelectionToDOM(getSelectedIds()));

    // Live text editing happens directly in the canvas (contenteditable).
    // Delegated listener keeps the model in sync without a full re-render,
    // which would steal focus and break the cursor position.
    dom.designCanvas.addEventListener('input', e => {
        const div = e.target.closest('.text-element');
        if (!div) return;
        const el = findElementById(getElements(), div.dataset.id);
        if (!el) return;
        record();
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
        handle.contentEditable = 'false';
        parentDiv.appendChild(handle);
    });
}

/** Attach the rotate handle to a selected element (text or image). */
function addRotateHandle(parentDiv) {
    const handle = document.createElement('div');
    handle.className = 'rotate-handle';
    handle.contentEditable = 'false';
    parentDiv.appendChild(handle);
}
