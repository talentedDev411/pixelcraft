/**
 * toolbar.js — Top toolbar: gradient type selector, color format, reverse, undo/redo.
 */

import { getStore } from '../store.js';

const GRADIENT_TYPES = [
    { value: 'linear', label: 'Linear' },
    { value: 'radial', label: 'Radial' },
    { value: 'conic', label: 'Conic' },
    { value: 'repeating-linear', label: 'Repeating Linear' },
    { value: 'repeating-radial', label: 'Repeating Radial' },
    { value: 'repeating-conic', label: 'Repeating Conic' },
];

const COLOR_FORMATS = [
    { value: 'hex', label: 'HEX' },
    { value: 'rgb', label: 'RGB' },
    { value: 'rgba', label: 'RGBA' },
    { value: 'hsl', label: 'HSL' },
    { value: 'hsla', label: 'HSLA' },
];

export function createToolbar(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-toolbar">
            <div class="ge-toolbar-group">
                <label class="ge-toolbar-label">Type</label>
                <select id="ge-gradient-type-select" class="ge-select-input ge-select-sm">
                    ${GRADIENT_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
            </div>
            <div class="ge-toolbar-group">
                <label class="ge-toolbar-label">Format</label>
                <select id="ge-color-format-select" class="ge-select-input ge-select-sm">
                    ${COLOR_FORMATS.map((f) => `<option value="${f.value}">${f.label}</option>`).join('')}
                </select>
            </div>
            <div class="ge-toolbar-group ge-toolbar-actions">
                <button class="ge-btn ge-btn-toolbar" id="ge-btn-reverse" title="Reverse">⇅</button>
                <button class="ge-btn ge-btn-toolbar" id="ge-btn-undo" title="Undo">↶</button>
                <button class="ge-btn ge-btn-toolbar" id="ge-btn-redo" title="Redo">↷</button>
            </div>
        </div>
    `;

    const typeSelect = container.querySelector('#ge-gradient-type-select');
    const formatSelect = container.querySelector('#ge-color-format-select');

    typeSelect.addEventListener('change', (e) => {
        store.dispatch({ type: 'SET_GRADIENT_TYPE', gradientType: e.target.value });
    });
    formatSelect.addEventListener('change', (e) => {
        store.dispatch({ type: 'SET_COLOR_FORMAT', format: e.target.value });
    });
    container.querySelector('#ge-btn-reverse').addEventListener('click', () => {
        store.dispatch({ type: 'REVERSE_GRADIENT' });
    });
    container.querySelector('#ge-btn-undo').addEventListener('click', () => {
        store.dispatch({ type: 'UNDO' });
    });
    container.querySelector('#ge-btn-redo').addEventListener('click', () => {
        store.dispatch({ type: 'REDO' });
    });

    function render() {
        const state = store.getState();
        const grad = state.gradients.find((g) => g.id === state.activeGradientId);
        if (grad) {
            typeSelect.value = grad.repeating ? `repeating-${grad.type}` : grad.type;
        }
        formatSelect.value = state.colorFormat;
    }

    store.subscribe(render);
    render();
}
