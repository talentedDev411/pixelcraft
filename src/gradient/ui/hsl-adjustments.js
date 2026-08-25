/**
 * hsl-adjustments.js — Global HSL adjustment sliders for all stops.
 */

import { getStore } from '../store.js';

export function createHSLAdjustments(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-hsl-adjustments" id="ge-hsl-adjustments">
            <div class="ge-section-title">HSL Adjustments</div>
            <div class="ge-form-group">
                <label>Hue</label>
                <div class="ge-slider-row">
                    <button class="ge-btn ge-btn-xs" id="ge-hue-down">-10</button>
                    <input type="range" id="ge-hue-adj" min="-180" max="180" value="0" />
                    <button class="ge-btn ge-btn-xs" id="ge-hue-up">+10</button>
                </div>
            </div>
            <div class="ge-form-group">
                <label>Saturation</label>
                <div class="ge-slider-row">
                    <button class="ge-btn ge-btn-xs" id="ge-sat-down">-10</button>
                    <input type="range" id="ge-sat-adj" min="-100" max="100" value="0" />
                    <button class="ge-btn ge-btn-xs" id="ge-sat-up">+10</button>
                </div>
            </div>
            <div class="ge-form-group">
                <label>Lightness</label>
                <div class="ge-slider-row">
                    <button class="ge-btn ge-btn-xs" id="ge-light-down">-10</button>
                    <input type="range" id="ge-light-adj" min="-100" max="100" value="0" />
                    <button class="ge-btn ge-btn-xs" id="ge-light-up">+10</button>
                </div>
            </div>
            <div class="ge-form-group">
                <button class="ge-btn ge-btn-secondary" id="ge-btn-reset-hsl">Reset Adjustments</button>
            </div>
        </div>
    `;

    const hueSlider = container.querySelector('#ge-hue-adj');
    const satSlider = container.querySelector('#ge-sat-adj');
    const lightSlider = container.querySelector('#ge-light-adj');

    function applyAdjustments() {
        store.dispatch({
            type: 'ADJUST_ALL_COLORS',
            hDelta: parseInt(hueSlider.value),
            sDelta: parseInt(satSlider.value),
            lDelta: parseInt(lightSlider.value),
        });
    }

    hueSlider.addEventListener('change', applyAdjustments);
    satSlider.addEventListener('change', applyAdjustments);
    lightSlider.addEventListener('change', applyAdjustments);

    container.querySelector('#ge-hue-up').addEventListener('click', () => {
        store.dispatch({ type: 'ADJUST_ALL_COLORS', hDelta: 10, sDelta: 0, lDelta: 0 });
    });
    container.querySelector('#ge-hue-down').addEventListener('click', () => {
        store.dispatch({ type: 'ADJUST_ALL_COLORS', hDelta: -10, sDelta: 0, lDelta: 0 });
    });
    container.querySelector('#ge-sat-up').addEventListener('click', () => {
        store.dispatch({ type: 'ADJUST_ALL_COLORS', hDelta: 0, sDelta: 10, lDelta: 0 });
    });
    container.querySelector('#ge-sat-down').addEventListener('click', () => {
        store.dispatch({ type: 'ADJUST_ALL_COLORS', hDelta: 0, sDelta: -10, lDelta: 0 });
    });
    container.querySelector('#ge-light-up').addEventListener('click', () => {
        store.dispatch({ type: 'ADJUST_ALL_COLORS', hDelta: 0, sDelta: 0, lDelta: 10 });
    });
    container.querySelector('#ge-light-down').addEventListener('click', () => {
        store.dispatch({ type: 'ADJUST_ALL_COLORS', hDelta: 0, sDelta: 0, lDelta: -10 });
    });

    container.querySelector('#ge-btn-reset-hsl').addEventListener('click', () => {
        hueSlider.value = 0;
        satSlider.value = 0;
        lightSlider.value = 0;
    });
}
