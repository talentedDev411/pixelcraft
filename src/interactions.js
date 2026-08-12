// All pointer interactions on the canvas (drag, resize) plus the right-click
// context menu. Kept separate from rendering so the canvas module only knows
// how to draw, and this module only knows how to manipulate.

import { emit } from './bus.js';
import { dom } from './dom.js';
import { updateElementModelAndDOM } from './canvas.js';
import {
    deleteElement,
    duplicateElement,
    moveElementToBack,
    moveElementToFront,
} from './elements.js';
import { deselectAll, selectElement } from './selection.js';
import {
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getSelectedElement,
} from './state.js';
import { findElementById } from './utils.js';

/** Wire up drag, resize, click-to-deselect and the context menu. */
export function initInteractions() {
    const { designCanvas, contextMenu, fitModeMenuItem } = dom;

    // ── Resize state ──
    let isResizing = false;
    let resizeHandle = null;
    let resizeStart = {};

    // ── Drag state ──
    let draggedElement = null;
    let dragOffset = {};

    // ── Context menu state ──
    let contextMenuTargetId = null;

    // ── Resize ──
    function startResize(handle, e) {
        e.stopPropagation();
        e.preventDefault();
        const el = getSelectedElement();
        if (!el || el.type !== 'image') return;
        isResizing = true;
        resizeHandle = handle;
        resizeStart = {
            elX: el.x, elY: el.y, elW: el.width, elH: el.height,
            mouseX: e.clientX, mouseY: e.clientY,
        };
    }

    window.addEventListener('mousemove', e => {
        if (isResizing && resizeHandle) {
            const el = getSelectedElement();
            if (el) {
                const dx = e.clientX - resizeStart.mouseX;
                const dy = e.clientY - resizeStart.mouseY;
                const handle = resizeHandle.dataset.handle;
                let newX = el.x, newY = el.y, newW = el.width, newH = el.height;
                switch (handle) {
                    case 'nw': newX = resizeStart.elX + dx; newY = resizeStart.elY + dy; newW = resizeStart.elW - dx; newH = resizeStart.elH - dy; break;
                    case 'ne': newY = resizeStart.elY + dy; newW = resizeStart.elW + dx; newH = resizeStart.elH - dy; break;
                    case 'sw': newX = resizeStart.elX + dx; newW = resizeStart.elW - dx; newH = resizeStart.elH + dy; break;
                    case 'se': newW = resizeStart.elW + dx; newH = resizeStart.elH + dy; break;
                    case 'w':  newX = resizeStart.elX + dx; newW = resizeStart.elW - dx; break;
                    case 'e':  newW = resizeStart.elW + dx; break;
                    case 'n':  newY = resizeStart.elY + dy; newH = resizeStart.elH - dy; break;
                    case 's':  newH = resizeStart.elH + dy; break;
                }
                updateElementModelAndDOM(el.id, { x: newX, y: newY, width: newW, height: newH }, true);
                emit('transform', el.id);
            }
            return;
        }
        if (draggedElement && !isResizing) {
            const rect = designCanvas.getBoundingClientRect();
            const newX = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, getCanvasWidth() - draggedElement.width));
            const newY = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, getCanvasHeight() - draggedElement.height));
            updateElementModelAndDOM(draggedElement.id, { x: newX, y: newY });
            emit('transform', draggedElement.id);
        }
    });

    window.addEventListener('mouseup', () => {
        isResizing = false;
        resizeHandle = null;
        draggedElement = null;
    });

    // ── Drag start / select / resize handle hit ──
    designCanvas.addEventListener('mousedown', e => {
        if (isResizing) return;
        const handle = e.target.closest('.resize-handle');
        if (handle) { startResize(handle, e); return; }
        const elementDiv = e.target.closest('.element');
        if (!elementDiv) return;
        const id = elementDiv.dataset.id;
        selectElement(id);
        draggedElement = findElementById(getElements(), id);
        if (!draggedElement) return;
        const rect = designCanvas.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left - draggedElement.x;
        dragOffset.y = e.clientY - rect.top - draggedElement.y;
        e.preventDefault();
    });

    // Click on empty canvas deselects.
    designCanvas.addEventListener('click', e => {
        if (e.target === designCanvas) deselectAll();
    });

    // ── Context menu ──
    designCanvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        const elementDiv = e.target.closest('.element');
        if (!elementDiv) { contextMenu.style.display = 'none'; return; }
        const id = elementDiv.dataset.id;
        contextMenuTargetId = id;
        selectElement(id);
        const el = findElementById(getElements(), id);
        const scaleItem = contextMenu.querySelector('[data-action="scaleToCanvas"]');
        scaleItem.style.display = (el && el.type === 'image') ? 'flex' : 'none';
        if (el && el.type === 'image') {
            fitModeMenuItem.style.display = 'flex';
            const currentMode = el.fitMode || 'fill';
            fitModeMenuItem.textContent = currentMode === 'cover'
                ? '🔄 Fit Mode: Cover (crop)'
                : '🔄 Fit Mode: Fill (no crop)';
        } else {
            fitModeMenuItem.style.display = 'none';
        }
        contextMenu.style.display = 'block';
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
    });

    document.addEventListener('click', e => {
        if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
    });

    contextMenu.addEventListener('click', e => {
        const item = e.target.closest('.menu-item');
        const action = item?.dataset.action;
        if (!action || !contextMenuTargetId) return;
        const el = findElementById(getElements(), contextMenuTargetId);

        switch (action) {
            case 'bringToFront': moveElementToFront(contextMenuTargetId); break;
            case 'sendToBack': moveElementToBack(contextMenuTargetId); break;
            case 'duplicate': duplicateElement(contextMenuTargetId); break;
            case 'delete': deleteElement(contextMenuTargetId); break;
            case 'scaleToCanvas':
                if (el && el.type === 'image') scaleImageToCanvas(el);
                break;
            case 'fitModeToggle':
                if (el && el.type === 'image') {
                    const newMode = el.fitMode === 'cover' ? 'fill' : 'cover';
                    updateElementModelAndDOM(el.id, { fitMode: newMode });
                    fitModeMenuItem.textContent = newMode === 'cover'
                        ? '🔄 Fit Mode: Cover (crop)'
                        : '🔄 Fit Mode: Fill (no crop)';
                }
                break;
        }
        contextMenu.style.display = 'none';
    });

    /** Fit an image element to the canvas while preserving its aspect ratio. */
    function scaleImageToCanvas(el) {
        const img = new Image();
        img.src = el.src;
        img.onload = () => {
            const cw = getCanvasWidth(), ch = getCanvasHeight();
            const imgRatio = img.width / img.height;
            const canvasRatio = cw / ch;
            let w, h;
            if (imgRatio > canvasRatio) { w = cw; h = cw / imgRatio; }
            else { h = ch; w = ch * imgRatio; }
            updateElementModelAndDOM(el.id, { x: (cw - w) / 2, y: (ch - h) / 2, width: w, height: h });
        };
    }
}
