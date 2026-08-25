/**
 * stop-editor.js — Selected stop details panel.
 */

import { getStore } from '../store.js';
import { parseColorString, formatColor, hexToRgb, rgbToHsl, hslToRgb, rgbToHex, clamp } from '../engine/color-utils.js';

export function createStopEditor(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-stop-editor" id="ge-stop-editor">
            <div class="ge-section-title">Selected Stop</div>
            <div id="ge-stop-editor-content" class="ge-stop-editor-content">
                <p class="ge-hint-text">Click a stop on the gradient bar to select it.</p>
            </div>
        </div>
    `;

    function render() {
        const state = store.getState();
        const grad = state.gradients.find((g) => g.id === state.activeGradientId);
        const content = container.querySelector('#ge-stop-editor-content');

        if (!grad || !state.selectedStopId) {
            content.innerHTML = '<p class="ge-hint-text">Click a stop on the gradient bar to select it.</p>';
            return;
        }

        const stop = grad.stops.find((s) => s.id === state.selectedStopId);
        if (!stop) {
            content.innerHTML = '<p class="ge-hint-text">Stop not found.</p>';
            return;
        }

        content.innerHTML = `
            <div class="ge-form-group">
                <label>Color</label>
                <div class="ge-color-input-row">
                    <input type="color" id="ge-stop-color-picker" value="${stop.color}" />
                    <input type="text" id="ge-stop-color-hex" value="${stop.color}" class="ge-input-text" maxlength="9" />
                </div>
            </div>
            <div class="ge-form-group">
                <label>Opacity</label>
                <div class="ge-slider-row">
                    <input type="range" id="ge-stop-opacity" min="0" max="100" value="${Math.round(stop.alpha * 100)}" />
                    <input type="number" id="ge-stop-opacity-num" value="${Math.round(stop.alpha * 100)}" min="0" max="100" class="ge-input-number ge-input-number-sm" />
                    <span class="ge-unit">%</span>
                </div>
            </div>
            <div class="ge-form-group">
                <label>Position</label>
                <div class="ge-slider-row">
                    <input type="range" id="ge-stop-position" min="0" max="100" value="${stop.position}" step="0.1" />
                    <input type="number" id="ge-stop-position-num" value="${stop.position}" min="0" max="100" step="0.1" class="ge-input-number ge-input-number-sm" />
                    <span class="ge-unit">%</span>
                </div>
            </div>
            <div class="ge-form-group">
                <button class="ge-btn ge-btn-danger" id="ge-btn-delete-stop">Delete Stop</button>
            </div>
        `;

        const colorPicker = content.querySelector('#ge-stop-color-picker');
        const hexInput = content.querySelector('#ge-stop-color-hex');
        const opacitySlider = content.querySelector('#ge-stop-opacity');
        const opacityNum = content.querySelector('#ge-stop-opacity-num');
        const posSlider = content.querySelector('#ge-stop-position');
        const posNum = content.querySelector('#ge-stop-position-num');
        const deleteBtn = content.querySelector('#ge-btn-delete-stop');

        colorPicker.addEventListener('input', (e) => {
            store.dispatch({ type: 'UPDATE_STOP_COLOR', stopId: stop.id, color: e.target.value });
            hexInput.value = e.target.value;
        });

        hexInput.addEventListener('change', (e) => {
            let val = e.target.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            const parsed = parseColorString(val);
            store.dispatch({ type: 'UPDATE_STOP_COLOR', stopId: stop.id, color: rgbToHex(parsed.r, parsed.g, parsed.b) });
            colorPicker.value = rgbToHex(parsed.r, parsed.g, parsed.b);
        });

        opacitySlider.addEventListener('input', (e) => {
            opacityNum.value = e.target.value;
            store.dispatch({ type: 'UPDATE_STOP_ALPHA', stopId: stop.id, alpha: parseInt(e.target.value) / 100 });
        });
        opacityNum.addEventListener('change', (e) => {
            const v = clamp(parseInt(e.target.value) || 0, 0, 100);
            opacitySlider.value = v;
            store.dispatch({ type: 'UPDATE_STOP_ALPHA', stopId: stop.id, alpha: v / 100 });
        });

        posSlider.addEventListener('input', (e) => {
            posNum.value = e.target.value;
            store.dispatch({ type: 'UPDATE_STOP_POSITION', stopId: stop.id, position: parseFloat(e.target.value) });
        });
        posNum.addEventListener('change', (e) => {
            const v = clamp(parseFloat(e.target.value) || 0, 0, 100);
            posSlider.value = v;
            store.dispatch({ type: 'UPDATE_STOP_POSITION', stopId: stop.id, position: v });
        });

        deleteBtn.addEventListener('click', () => {
            store.dispatch({ type: 'REMOVE_STOP', stopId: stop.id });
        });
    }

    store.subscribe(render);
    render();
}
