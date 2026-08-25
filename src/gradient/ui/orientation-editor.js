/**
 * orientation-editor.js — Orientation control for linear gradients.
 */

import { getStore } from '../store.js';

const DIRECTIONS = [
    { label: 'To Top', angle: 0, icon: '↑' },
    { label: 'To Top Right', angle: 45, icon: '↗' },
    { label: 'To Right', angle: 90, icon: '→' },
    { label: 'To Bottom Right', angle: 135, icon: '↘' },
    { label: 'To Bottom', angle: 180, icon: '↓' },
    { label: 'To Bottom Left', angle: 225, icon: '↙' },
    { label: 'To Left', angle: 270, icon: '←' },
    { label: 'To Top Left', angle: 315, icon: '↖' },
];

export function createOrientationEditor(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-orientation-editor" id="ge-orientation-editor">
            <div class="ge-section-title">Orientation</div>
            <div class="ge-compass-grid" id="ge-compass-grid"></div>
            <div class="ge-form-group">
                <label>Angle</label>
                <div class="ge-slider-row">
                    <input type="range" id="ge-angle-slider" min="0" max="360" value="180" />
                    <input type="number" id="ge-angle-input" value="180" min="0" max="360" class="ge-input-number ge-input-number-sm" />
                    <span class="ge-unit">°</span>
                </div>
            </div>
        </div>
    `;

    const compass = container.querySelector('#ge-compass-grid');
    const angleSlider = container.querySelector('#ge-angle-slider');
    const angleInput = container.querySelector('#ge-angle-input');

    DIRECTIONS.forEach((dir) => {
        const btn = document.createElement('button');
        btn.className = 'ge-compass-btn';
        btn.dataset.angle = dir.angle;
        btn.innerHTML = `<span class="ge-compass-icon">${dir.icon}</span><span class="ge-compass-label">${dir.label}</span>`;
        btn.addEventListener('click', () => {
            store.dispatch({ type: 'SET_ORIENTATION', orientation: { mode: 'angle', angle: dir.angle } });
        });
        compass.appendChild(btn);
    });

    angleSlider.addEventListener('input', (e) => {
        angleInput.value = e.target.value;
        store.dispatch({ type: 'SET_ORIENTATION', orientation: { mode: 'angle', angle: parseInt(e.target.value) } });
    });
    angleInput.addEventListener('change', (e) => {
        const v = Math.max(0, Math.min(360, parseInt(e.target.value) || 0));
        angleSlider.value = v;
        store.dispatch({ type: 'SET_ORIENTATION', orientation: { mode: 'angle', angle: v } });
    });

    function render() {
        const state = store.getState();
        const grad = state.gradients.find((g) => g.id === state.activeGradientId);
        const editorEl = container.querySelector('#ge-orientation-editor');

        if (!grad || grad.type !== 'linear') {
            editorEl.style.display = 'none';
            return;
        }
        editorEl.style.display = '';

        const angle = grad.orientation?.angle ?? 180;
        angleSlider.value = angle;
        angleInput.value = angle;

        compass.querySelectorAll('.ge-compass-btn').forEach((btn) => {
            btn.classList.toggle('active', parseInt(btn.dataset.angle) === angle);
        });
    }

    store.subscribe(render);
    render();
}
