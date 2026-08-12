// Right-hand properties panel: populating it from the selected element and
// wiring every input back into the element model.

import { on } from './bus.js';
import { dom } from './dom.js';
import { updateElementModelAndDOM } from './canvas.js';
import { deleteElement } from './elements.js';
import {
    getCanvasHeight,
    getCanvasWidth,
    getSelectedElement,
    getSelectedElementId,
} from './state.js';
import { clamp } from './utils.js';

/** Reflect an element's position and size into the X/Y/W/H inputs. */
function syncTransformInputs(el) {
    dom.positionXInput.value = Math.round(el.x);
    dom.positionYInput.value = Math.round(el.y);
    dom.sizeWidthInput.value = Math.round(el.width);
    dom.sizeHeightInput.value = Math.round(el.height);
}

export function updatePropertiesPanel() {
    const el = getSelectedElement();
    if (!el) {
        dom.noSelection.style.display = 'block';
        dom.positionProperties.style.display = 'none';
        dom.textProperties.style.display = 'none';
        dom.imageProperties.style.display = 'none';
        return;
    }
    dom.noSelection.style.display = 'none';
    dom.positionProperties.style.display = 'block';
    syncTransformInputs(el);
    if (el.type === 'text') {
        dom.textProperties.style.display = 'block';
        dom.imageProperties.style.display = 'none';
        dom.textContentInput.value = el.content;
        dom.fontSizeInput.value = el.fontSize;
        dom.fontWeightInput.value = el.fontWeight || '400';
        dom.textColorInput.value = el.color;
        dom.textBgColorInput.value = el.bgColor === 'transparent' ? '#ffffff00' : el.bgColor;
        dom.textShadowInput.value = el.textShadow;
    } else {
        dom.imageProperties.style.display = 'block';
        dom.textProperties.style.display = 'none';
    }
}

/** Wire up all properties-panel controls. Call once on startup. */
export function initProperties() {
    on('selection', updatePropertiesPanel);
    on('render', updatePropertiesPanel);
    on('text-edited', content => { dom.textContentInput.value = content; });
    // Live sync while dragging/resizing, so the panel tracks position and size.
    on('transform', id => {
        const el = getSelectedElement();
        if (el && el.id === id) syncTransformInputs(el);
    });

    dom.textContentInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') updateElementModelAndDOM(el.id, { content: dom.textContentInput.value });
    });
    dom.fontSizeInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') updateElementModelAndDOM(el.id, { fontSize: parseInt(dom.fontSizeInput.value) || 24 });
    });
    dom.fontWeightInput.addEventListener('change', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') updateElementModelAndDOM(el.id, { fontWeight: dom.fontWeightInput.value });
    });
    dom.textColorInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') updateElementModelAndDOM(el.id, { color: dom.textColorInput.value });
    });
    dom.textBgColorInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') {
            const val = dom.textBgColorInput.value === '#ffffff00' ? 'transparent' : dom.textBgColorInput.value;
            updateElementModelAndDOM(el.id, { bgColor: val });
        }
    });
    dom.textShadowInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') updateElementModelAndDOM(el.id, { textShadow: dom.textShadowInput.value });
    });

    // Position: keep the element inside the canvas so it never gets lost.
    dom.positionXInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el) return;
        const v = parseInt(dom.positionXInput.value, 10);
        if (Number.isNaN(v)) return;
        const x = clamp(v, 0, Math.max(0, getCanvasWidth() - el.width));
        updateElementModelAndDOM(el.id, { x });
        dom.positionXInput.value = x;
    });
    dom.positionYInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el) return;
        const v = parseInt(dom.positionYInput.value, 10);
        if (Number.isNaN(v)) return;
        const y = clamp(v, 0, Math.max(0, getCanvasHeight() - el.height));
        updateElementModelAndDOM(el.id, { y });
        dom.positionYInput.value = y;
    });

    // Size: keep elements at least 20px and inside the canvas.
    dom.sizeWidthInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el) return;
        const v = parseInt(dom.sizeWidthInput.value, 10);
        if (Number.isNaN(v)) return;
        const w = clamp(v, 20, Math.max(20, getCanvasWidth() - el.x));
        updateElementModelAndDOM(el.id, { width: w });
        dom.sizeWidthInput.value = w;
    });
    dom.sizeHeightInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el) return;
        const v = parseInt(dom.sizeHeightInput.value, 10);
        if (Number.isNaN(v)) return;
        const h = clamp(v, 20, Math.max(20, getCanvasHeight() - el.y));
        updateElementModelAndDOM(el.id, { height: h });
        dom.sizeHeightInput.value = h;
    });

    dom.deleteElementBtn.addEventListener('click', () => {
        if (getSelectedElementId()) deleteElement(getSelectedElementId());
    });
    dom.deleteImageBtn.addEventListener('click', () => {
        if (getSelectedElementId()) deleteElement(getSelectedElementId());
    });
    dom.swapImageInput.addEventListener('change', e => {
        const el = getSelectedElement();
        if (!el || el.type !== 'image') return;
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => updateElementModelAndDOM(el.id, { src: ev.target.result });
        reader.readAsDataURL(file);
    });
}
