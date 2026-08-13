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
    moveElementsToPage,
} from './elements.js';
import { beginGesture, endGesture } from './history.js';
import { getThumbPageIdAt, setDropHighlight } from './pages.js';
import { deselectAll, selectElement, toggleSelectElement } from './selection.js';
import {
    getActivePageId,
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getSelectedElement,
    getSelectedIds,
    isSelected,
} from './state.js';
import { clamp, findElementById } from './utils.js';

/** Wire up drag, resize, click-to-deselect and the context menu. */
export function initInteractions() {
    const { designCanvas, contextMenu, fitModeMenuItem } = dom;

    // ── Resize state ──
    let isResizing = false;
    let resizeHandle = null;
    let resizeStart = {};

    // ── Rotate state ──
    let isRotating = false;
    let rotateStart = {};

    // ── Drag state ──
    let draggedElement = null;
    let dragStart = { mouseX: 0, mouseY: 0, positions: [] };

    // ── Cross-page drag state (drop onto a page thumbnail) ──
    let dropTargetPageId = null;

    // ── Context menu state ──
    let contextMenuTargetId = null;

    // ── Resize ──
    function startResize(handle, e) {
        e.stopPropagation();
        e.preventDefault();
        const el = getSelectedElement();
        if (!el) return; // images and text are both resizable
        beginGesture(); // one undo step for the whole resize
        isResizing = true;
        resizeHandle = handle;
        resizeStart = {
            elX: el.x, elY: el.y, elW: el.width, elH: el.height,
            mouseX: e.clientX, mouseY: e.clientY,
        };
    }

    window.addEventListener('mousemove', e => {
        if (isRotating) {
            const el = getSelectedElement();
            if (el) {
                let angle = Math.round(
                    Math.atan2(e.clientY - rotateStart.cy, e.clientX - rotateStart.cx) * 180 / Math.PI + 90
                );
                angle = ((angle + 180) % 360 + 360) % 360 - 180; // normalize to [-180, 180]
                updateElementModelAndDOM(el.id, { rotation: angle });
                emit('transform', el.id);
            }
            return;
        }
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
            // Delta from the drag start, clamped so the whole group stays
            // inside the canvas (single selection behaves identically).
            const xs = dragStart.positions.map(p => p.x);
            const rs = dragStart.positions.map(p => p.x + p.w);
            const dx = clamp(e.clientX - dragStart.mouseX, -Math.min(...xs), getCanvasWidth() - Math.max(...rs));
            const ys = dragStart.positions.map(p => p.y);
            const bs = dragStart.positions.map(p => p.y + p.h);
            const dy = clamp(e.clientY - dragStart.mouseY, -Math.min(...ys), getCanvasHeight() - Math.max(...bs));
            dragStart.positions.forEach(p => {
                updateElementModelAndDOM(p.id, { x: p.x + dx, y: p.y + dy });
            });
            emit('transform', draggedElement.id);
            // Hovering a page thumbnail while dragging previews a cross-page move.
            // The highlight is re-applied every frame because the live track
            // refresh rebuilds the thumbnail nodes while we drag.
            dropTargetPageId = getThumbPageIdAt(e.clientX, e.clientY);
            setDropHighlight(dropTargetPageId);
        }
    });

    window.addEventListener('mouseup', () => {
        // Dropping on a thumbnail of a different page moves the whole group.
        if (draggedElement && dropTargetPageId && dropTargetPageId !== getActivePageId()) {
            moveElementsToPage(getSelectedIds(), dropTargetPageId);
        }
        isResizing = false;
        resizeHandle = null;
        isRotating = false;
        draggedElement = null;
        dragStart = { mouseX: 0, mouseY: 0, positions: [] };
        dropTargetPageId = null;
        setDropHighlight(null);
        endGesture();
    });

    // ── Drag start / select / resize / rotate handle hit ──
    designCanvas.addEventListener('mousedown', e => {
        if (isResizing) return;
        const rotateHandle = e.target.closest('.rotate-handle');
        if (rotateHandle) {
            e.stopPropagation();
            e.preventDefault();
            const el = getSelectedElement();
            if (!el) return;
            beginGesture(); // one undo step for the whole rotation
            isRotating = true;
            const rect = designCanvas.getBoundingClientRect();
            rotateStart = {
                cx: rect.left + el.x + el.width / 2,
                cy: rect.top + el.y + el.height / 2,
            };
            return;
        }
        const handle = e.target.closest('.resize-handle');
        if (handle) { startResize(handle, e); return; }
        const elementDiv = e.target.closest('.element');
        if (!elementDiv) return;
        const id = elementDiv.dataset.id;
        // Ctrl+click toggles membership in the selection (multi-select);
        // it never starts a drag.
        if (e.ctrlKey || e.metaKey) {
            toggleSelectElement(id);
            return;
        }
        // Plain click on an already-selected element keeps the group (group
        // drag); a click on an unselected element narrows to it alone.
        if (!isSelected(id)) selectElement(id);
        draggedElement = findElementById(getElements(), id);
        if (!draggedElement) return;
        beginGesture(); // one undo step for the whole drag
        dragStart = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            positions: getSelectedIds()
                .map(sid => {
                    const el = findElementById(getElements(), sid);
                    return el ? { id: sid, x: el.x, y: el.y, w: el.width, h: el.height } : null;
                })
                .filter(Boolean),
        };
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
