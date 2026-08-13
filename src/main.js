// Composition root: initializes every module and wires up the top-level UI
// (aspect ratios, toolbox, clear). All other logic lives in its own module.

// Bundle the built-in brand-style font faces (woff2 files ride along).
import '../resources/fonts/fonts.css';

import { emit, on } from './bus.js';
import { dom } from './dom.js';
import { initCanvas, updateCanvasSize } from './canvas.js';
import { initInteractions } from './interactions.js';
import { initProperties } from './properties.js';
import { initExport } from './export.js';
import { addImageElement, addTextElement } from './elements.js';
import { loadUserFonts } from './fonts.js';
import { initPages, addPage, cloneActivePage } from './pages.js';
import { initSelectMode } from './selectmode.js';
import { initShortcuts } from './shortcuts.js';
import { canRedo, canUndo, record, redo, undo } from './history.js';
import {
    getActivePage,
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getPages,
    setSelectedElementId,
    setAspectRatio,
} from './state.js';

// ── Boot modules (each subscribes to the events it cares about) ──
initCanvas();
initInteractions();
initProperties();
initExport();
initShortcuts();
initSelectMode();
initPages();

// ── Aspect ratio buttons ──
dom.aspectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        dom.aspectBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setAspectRatio(btn.dataset.ratio);
        updateCanvasSize();
        // Keep every page's elements inside the resized canvas.
        getPages().forEach(page => {
            page.elements.forEach(el => {
                el.x = Math.min(el.x, getCanvasWidth() - el.width);
                el.x = Math.max(0, el.x);
                el.y = Math.min(el.y, getCanvasHeight() - el.height);
                el.y = Math.max(0, el.y);
            });
        });
        emit('render');
    });
});

// ── Toolbox ──
dom.addTextTool.addEventListener('click', addTextElement);
dom.imageUploadInput.addEventListener('change', e => {
    if (e.target.files[0]) {
        addImageElement(e.target.files[0]);
        dom.imageUploadInput.value = '';
    }
});
dom.bgColorInput.addEventListener('input', e => {
    // Background lives on the active page so each page keeps its own color.
    const page = getActivePage();
    if (page) page.bgColor = e.target.value;
    dom.designCanvas.style.backgroundColor = e.target.value;
});

// ── Toolbox: undo / redo buttons ──
function syncHistoryButtons() {
    dom.undoTool.classList.toggle('disabled', !canUndo());
    dom.redoTool.classList.toggle('disabled', !canRedo());
    dom.undoTool.setAttribute('aria-disabled', String(!canUndo()));
    dom.redoTool.setAttribute('aria-disabled', String(!canRedo()));
}
on('history', syncHistoryButtons);
dom.undoTool.addEventListener('click', () => { if (canUndo()) undo(); });
dom.redoTool.addEventListener('click', () => { if (canRedo()) redo(); });
syncHistoryButtons();

// ── Top bar ──
dom.clearCanvasBtn.addEventListener('click', () => {
    record(); // so Ctrl+Z can bring the cleared design back
    const page = getActivePage();
    if (page) {
        page.elements = [];
        page.bgColor = '#ffffff';
    }
    setSelectedElementId(null);
    dom.designCanvas.style.backgroundColor = '#ffffff';
    dom.bgColorInput.value = '#ffffff';
    emit('render');
});

// ── Viewport changes ──
window.addEventListener('resize', () => {
    updateCanvasSize();
    emit('render');
});

// ── Initial layout ──
updateCanvasSize();
emit('render'); // paints the first page, its background and the page track

// Load custom fonts saved in resources/user/fonts/ (errors are printed).
loadUserFonts();
