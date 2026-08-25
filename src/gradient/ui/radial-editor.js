/**
 * radial-editor.js — Radial gradient controls: shape, size, center.
 */

import { getStore } from '../store.js';
import { clamp } from '../engine/color-utils.js';

const SHAPES = ['ellipse', 'circle'];
const SIZES = ['farthest-corner', 'farthest-side', 'closest-corner', 'closest-side'];

export function createRadialEditor(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-radial-editor" id="ge-radial-editor" style="display:none;">
            <div class="ge-section-title">Radial Geometry</div>
            <div class="ge-form-group">
                <label>Shape</label>
                <select id="ge-radial-shape" class="ge-select-input">
                    ${SHAPES.map((s) => `<option value="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
                </select>
            </div>
            <div class="ge-form-group">
                <label>Size</label>
                <select id="ge-radial-size" class="ge-select-input">
                    ${SIZES.map((s) => `<option value="${s}">${s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>`).join('')}
                </select>
            </div>
            <div class="ge-form-group">
                <label>Center</label>
                <div class="ge-center-row">
                    <div class="ge-rgb-field">
                        <label class="ge-sub-label">X</label>
                        <div class="ge-slider-row">
                            <input type="range" id="ge-radial-cx" min="0" max="100" value="50" />
                            <input type="number" id="ge-radial-cx-num" value="50" min="0" max="100" class="ge-input-number ge-input-number-sm" />
                            <span class="ge-unit">%</span>
                        </div>
                    </div>
                    <div class="ge-rgb-field">
                        <label class="ge-sub-label">Y</label>
                        <div class="ge-slider-row">
                            <input type="range" id="ge-radial-cy" min="0" max="100" value="50" />
                            <input type="number" id="ge-radial-cy-num" value="50" min="0" max="100" class="ge-input-number ge-input-number-sm" />
                            <span class="ge-unit">%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const shapeSelect = container.querySelector('#ge-radial-shape');
    const sizeSelect = container.querySelector('#ge-radial-size');
    const cxSlider = container.querySelector('#ge-radial-cx');
    const cxNum = container.querySelector('#ge-radial-cx-num');
    const cySlider = container.querySelector('#ge-radial-cy');
    const cyNum = container.querySelector('#ge-radial-cy-num');
    const editorEl = container.querySelector('#ge-radial-editor');

    shapeSelect.addEventListener('change', (e) => {
        store.dispatch({ type: 'SET_RADIAL_GEOMETRY', geometry: { shape: e.target.value } });
    });
    sizeSelect.addEventListener('change', (e) => {
        store.dispatch({ type: 'SET_RADIAL_GEOMETRY', geometry: { size: e.target.value } });
    });
    cxSlider.addEventListener('input', (e) => {
        cxNum.value = e.target.value;
        store.dispatch({ type: 'SET_RADIAL_GEOMETRY', geometry: { center: { x: parseInt(e.target.value) } } });
    });
    cxNum.addEventListener('change', (e) => {
        const v = clamp(parseInt(e.target.value) || 50, 0, 100);
        cxSlider.value = v;
        store.dispatch({ type: 'SET_RADIAL_GEOMETRY', geometry: { center: { x: v } } });
    });
    cySlider.addEventListener('input', (e) => {
        cyNum.value = e.target.value;
        store.dispatch({ type: 'SET_RADIAL_GEOMETRY', geometry: { center: { y: parseInt(e.target.value) } } });
    });
    cyNum.addEventListener('change', (e) => {
        const v = clamp(parseInt(e.target.value) || 50, 0, 100);
        cySlider.value = v;
        store.dispatch({ type: 'SET_RADIAL_GEOMETRY', geometry: { center: { y: v } } });
    });

    function render() {
        const state = store.getState();
        const grad = state.gradients.find((g) => g.id === state.activeGradientId);
        if (!grad || grad.type !== 'radial') {
            editorEl.style.display = 'none';
            return;
        }
        editorEl.style.display = '';
        shapeSelect.value = grad.radial.shape;
        sizeSelect.value = grad.radial.size;
        cxSlider.value = grad.radial.center.x;
        cxNum.value = grad.radial.center.x;
        cySlider.value = grad.radial.center.y;
        cyNum.value = grad.radial.center.y;
    }

    store.subscribe(render);
    render();
}
