// Composition root: initializes every module and wires up the top-level UI
// (aspect ratios, toolbox, clear). All other logic lives in its own module.

import { emit } from './bus.js';
import { dom } from './dom.js';
import { initCanvas, updateCanvasSize } from './canvas.js';
import { initInteractions } from './interactions.js';
import { initProperties } from './properties.js';
import { initExport } from './export.js';
import { addImageElement, addTextElement } from './elements.js';
import {
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    setElements,
    setSelectedElementId,
    setAspectRatio,
} from './state.js';

// ── Boot modules (each subscribes to the events it cares about) ──
initCanvas();
initInteractions();
initProperties();
initExport();

// ── Aspect ratio buttons ──
dom.aspectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        dom.aspectBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setAspectRatio(btn.dataset.ratio);
        updateCanvasSize();
        // Keep elements inside the resized canvas.
        getElements().forEach(el => {
            el.x = Math.min(el.x, getCanvasWidth() - el.width);
            el.x = Math.max(0, el.x);
            el.y = Math.min(el.y, getCanvasHeight() - el.height);
            el.y = Math.max(0, el.y);
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
    dom.designCanvas.style.backgroundColor = e.target.value;
});

// ── Top bar ──
dom.clearCanvasBtn.addEventListener('click', () => {
    setElements([]);
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
dom.designCanvas.style.backgroundColor = '#ffffff';
emit('render');
