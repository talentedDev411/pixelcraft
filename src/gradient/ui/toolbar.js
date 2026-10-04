/**
 * toolbar.js — Top toolbar: background type selector (Transparent / Solid /
 * gradient shapes), color format, reverse, undo/redo.
 *
 * The canvas background is ONE control: choosing "Transparent" or "Solid"
 * switches off the gradient model, choosing any gradient shape switches back
 * to it. That keeps the whole background story in a single dropdown.
 */

import { getStore } from '../store.js';

/** Flat (non-gradient) background modes, shown above the gradient shapes. */
const FLAT_MODES = [
    { value: 'transparent', label: 'Transparent' },
    { value: 'solid', label: 'Solid' },
];

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
                    ${FLAT_MODES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
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
        <div class="ge-flat-picker" id="ge-flat-picker" style="display:none;">
            <label class="ge-toolbar-label" for="ge-flat-color">Color</label>
            <input type="color" id="ge-flat-color" value="#ffffff" class="ge-color-input" />
        </div>
    `;

    const typeSelect = container.querySelector('#ge-gradient-type-select');
    const formatSelect = container.querySelector('#ge-color-format-select');
    const flatPicker = container.querySelector('#ge-flat-picker');
    const flatColor = container.querySelector('#ge-flat-color');

    typeSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'transparent' || value === 'solid') {
            store.dispatch({ type: 'SET_FLAT_MODE', mode: value });
            return;
        }
        // Picking a gradient shape leaves flat mode.
        store.dispatch({ type: 'SET_FLAT_MODE', mode: null });
        store.dispatch({ type: 'SET_GRADIENT_TYPE', gradientType: value });
    });
    formatSelect.addEventListener('change', (e) => {
        store.dispatch({ type: 'SET_COLOR_FORMAT', format: e.target.value });
    });
    flatColor.addEventListener('input', (e) => {
        store.dispatch({ type: 'SET_FLAT_COLOR', color: e.target.value });
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
        // Flat modes win when active; otherwise reflect the gradient shape.
        if (state.flatMode) {
            typeSelect.value = state.flatMode;
        } else if (grad) {
            typeSelect.value = grad.repeating ? `repeating-${grad.type}` : grad.type;
        }
        formatSelect.value = state.colorFormat;
        flatPicker.style.display = state.flatMode === 'solid' ? 'flex' : 'none';
        if (state.flatMode === 'solid') flatColor.value = state.flatColor;
    }

    store.subscribe(render);
    render();
}