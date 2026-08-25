/**
 * opacity-editor.js — Opacity stop editor.
 */

import { getStore } from '../store.js';
import { clamp } from '../engine/color-utils.js';

export function createOpacityEditor(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-opacity-editor" id="ge-opacity-editor" style="display:none;">
            <div class="ge-section-title">Opacity Stops</div>
            <div id="ge-opacity-content">
                <p class="ge-hint-text">No opacity stops yet.</p>
            </div>
        </div>
    `;

    function render() {
        const state = store.getState();
        const grad = state.gradients.find((g) => g.id === state.activeGradientId);
        const content = container.querySelector('#ge-opacity-content');
        const editorEl = container.querySelector('#ge-opacity-editor');

        if (!grad) { editorEl.style.display = 'none'; return; }

        if (grad.opacityStops.length === 0) {
            editorEl.style.display = 'none';
            return;
        }

        editorEl.style.display = '';

        if (!state.selectedOpacityStopId) {
            content.innerHTML = '<p class="ge-hint-text">Click an opacity stop to select it.</p>';
            return;
        }

        const stop = grad.opacityStops.find((s) => s.id === state.selectedOpacityStopId);
        if (!stop) {
            content.innerHTML = '<p class="ge-hint-text">Stop not found.</p>';
            return;
        }

        content.innerHTML = `
            <div class="ge-form-group">
                <label>Opacity</label>
                <div class="ge-slider-row">
                    <input type="range" id="ge-opstop-opacity" min="0" max="100" value="${Math.round(stop.alpha * 100)}" />
                    <input type="number" id="ge-opstop-opacity-num" value="${Math.round(stop.alpha * 100)}" min="0" max="100" class="ge-input-number ge-input-number-sm" />
                    <span class="ge-unit">%</span>
                </div>
            </div>
            <div class="ge-form-group">
                <label>Position</label>
                <div class="ge-slider-row">
                    <input type="range" id="ge-opstop-position" min="0" max="100" value="${stop.position}" step="0.1" />
                    <input type="number" id="ge-opstop-position-num" value="${stop.position}" min="0" max="100" step="0.1" class="ge-input-number ge-input-number-sm" />
                    <span class="ge-unit">%</span>
                </div>
            </div>
            <div class="ge-form-group">
                <button class="ge-btn ge-btn-danger" id="ge-btn-delete-opstop">Delete</button>
            </div>
        `;

        const opSlider = content.querySelector('#ge-opstop-opacity');
        const opNum = content.querySelector('#ge-opstop-opacity-num');
        const posSlider = content.querySelector('#ge-opstop-position');
        const posNum = content.querySelector('#ge-opstop-position-num');
        const deleteBtn = content.querySelector('#ge-btn-delete-opstop');

        opSlider.addEventListener('input', (e) => {
            opNum.value = e.target.value;
            store.dispatch({ type: 'UPDATE_OPACITY_STOP', stopId: stop.id, alpha: parseInt(e.target.value) / 100 });
        });
        opNum.addEventListener('change', (e) => {
            const v = clamp(parseInt(e.target.value) || 0, 0, 100);
            opSlider.value = v;
            store.dispatch({ type: 'UPDATE_OPACITY_STOP', stopId: stop.id, alpha: v / 100 });
        });
        posSlider.addEventListener('input', (e) => {
            posNum.value = e.target.value;
            store.dispatch({ type: 'UPDATE_OPACITY_STOP', stopId: stop.id, position: parseFloat(e.target.value) });
        });
        posNum.addEventListener('change', (e) => {
            const v = clamp(parseFloat(e.target.value) || 0, 0, 100);
            posSlider.value = v;
            store.dispatch({ type: 'UPDATE_OPACITY_STOP', stopId: stop.id, position: v });
        });
        deleteBtn.addEventListener('click', () => {
            store.dispatch({ type: 'REMOVE_OPACITY_STOP', stopId: stop.id });
        });
    }

    store.subscribe(render);
    render();
}
