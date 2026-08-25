/**
 * conic-editor.js — Conic gradient controls: from angle, center X/Y.
 */

import { getStore } from '../store.js';
import { clamp } from '../engine/color-utils.js';

export function createConicEditor(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-conic-editor" id="ge-conic-editor" style="display:none;">
            <div class="ge-section-title">Conic Geometry</div>
            <div class="ge-form-group">
                <label>Starting Angle</label>
                <div class="ge-slider-row">
                    <input type="range" id="ge-conic-from" min="0" max="360" value="0" />
                    <input type="number" id="ge-conic-from-num" value="0" min="0" max="360" class="ge-input-number ge-input-number-sm" />
                    <span class="ge-unit">°</span>
                </div>
            </div>
            <div class="ge-form-group">
                <label>Center</label>
                <div class="ge-center-row">
                    <div class="ge-rgb-field">
                        <label class="ge-sub-label">X</label>
                        <div class="ge-slider-row">
                            <input type="range" id="ge-conic-cx" min="0" max="100" value="50" />
                            <input type="number" id="ge-conic-cx-num" value="50" min="0" max="100" class="ge-input-number ge-input-number-sm" />
                            <span class="ge-unit">%</span>
                        </div>
                    </div>
                    <div class="ge-rgb-field">
                        <label class="ge-sub-label">Y</label>
                        <div class="ge-slider-row">
                            <input type="range" id="ge-conic-cy" min="0" max="100" value="50" />
                            <input type="number" id="ge-conic-cy-num" value="50" min="0" max="100" class="ge-input-number ge-input-number-sm" />
                            <span class="ge-unit">%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const fromSlider = container.querySelector('#ge-conic-from');
    const fromNum = container.querySelector('#ge-conic-from-num');
    const cxSlider = container.querySelector('#ge-conic-cx');
    const cxNum = container.querySelector('#ge-conic-cx-num');
    const cySlider = container.querySelector('#ge-conic-cy');
    const cyNum = container.querySelector('#ge-conic-cy-num');
    const editorEl = container.querySelector('#ge-conic-editor');

    fromSlider.addEventListener('input', (e) => {
        fromNum.value = e.target.value;
        store.dispatch({ type: 'SET_CONIC_GEOMETRY', geometry: { from: parseInt(e.target.value) } });
    });
    fromNum.addEventListener('change', (e) => {
        const v = clamp(parseInt(e.target.value) || 0, 0, 360);
        fromSlider.value = v;
        store.dispatch({ type: 'SET_CONIC_GEOMETRY', geometry: { from: v } });
    });
    cxSlider.addEventListener('input', (e) => {
        cxNum.value = e.target.value;
        store.dispatch({ type: 'SET_CONIC_GEOMETRY', geometry: { center: { x: parseInt(e.target.value) } } });
    });
    cxNum.addEventListener('change', (e) => {
        const v = clamp(parseInt(e.target.value) || 50, 0, 100);
        cxSlider.value = v;
        store.dispatch({ type: 'SET_CONIC_GEOMETRY', geometry: { center: { x: v } } });
    });
    cySlider.addEventListener('input', (e) => {
        cyNum.value = e.target.value;
        store.dispatch({ type: 'SET_CONIC_GEOMETRY', geometry: { center: { y: parseInt(e.target.value) } } });
    });
    cyNum.addEventListener('change', (e) => {
        const v = clamp(parseInt(e.target.value) || 50, 0, 100);
        cySlider.value = v;
        store.dispatch({ type: 'SET_CONIC_GEOMETRY', geometry: { center: { y: v } } });
    });

    function render() {
        const state = store.getState();
        const grad = state.gradients.find((g) => g.id === state.activeGradientId);
        if (!grad || grad.type !== 'conic') {
            editorEl.style.display = 'none';
            return;
        }
        editorEl.style.display = '';
        fromSlider.value = grad.conic.from;
        fromNum.value = grad.conic.from;
        cxSlider.value = grad.conic.center.x;
        cxNum.value = grad.conic.center.x;
        cySlider.value = grad.conic.center.y;
        cyNum.value = grad.conic.center.y;
    }

    store.subscribe(render);
    render();
}
