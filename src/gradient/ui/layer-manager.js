/**
 * layer-manager.js — Multiple gradient layer management.
 */

import { getStore } from '../store.js';
import { serializeGradient } from '../engine/gradient-serializer.js';

const GRADIENT_LABELS = {
    linear: 'Linear Gradient',
    radial: 'Radial Gradient',
    conic: 'Conic Gradient',
};

export function createLayerManager(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-layer-manager" id="ge-layer-manager">
            <div class="ge-section-title">Layers</div>
            <div class="ge-layer-list" id="ge-layer-list"></div>
            <div class="ge-layer-actions">
                <button class="ge-btn ge-btn-sm ge-btn-secondary" id="ge-btn-add-layer">+ Add</button>
                <button class="ge-btn ge-btn-sm ge-btn-secondary" id="ge-btn-duplicate-layer">⧉ Clone</button>
                <button class="ge-btn ge-btn-sm ge-btn-danger" id="ge-btn-delete-layer">🗑</button>
            </div>
        </div>
    `;

    const layerList = container.querySelector('#ge-layer-list');
    container.querySelector('#ge-btn-add-layer').addEventListener('click', () => {
        store.dispatch({ type: 'ADD_GRADIENT_LAYER' });
    });
    container.querySelector('#ge-btn-duplicate-layer').addEventListener('click', () => {
        const state = store.getState();
        const grad = state.gradients.find((g) => g.id === state.activeGradientId);
        if (!grad) return;
        const dup = JSON.parse(JSON.stringify(grad));
        dup.id = `grad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        dup.stops.forEach((s) => (s.id = `stop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`));
        const idx = state.gradients.indexOf(grad);
        state.gradients.splice(idx + 1, 0, dup);
        state.activeGradientId = dup.id;
        store._notify();
    });
    container.querySelector('#ge-btn-delete-layer').addEventListener('click', () => {
        store.dispatch({ type: 'DELETE_GRADIENT_LAYER' });
    });

    function render() {
        const state = store.getState();
        layerList.innerHTML = '';

        state.gradients.forEach((grad) => {
            const layer = document.createElement('div');
            layer.className = 'ge-layer-item' + (grad.id === state.activeGradientId ? ' active' : '');

            const label = GRADIENT_LABELS[grad.type] || 'Gradient';
            const sub = grad.type === 'linear'
                ? `${grad.orientation.angle}deg`
                : grad.type === 'radial' ? grad.radial.shape
                : grad.type === 'conic' ? `${grad.conic.from}deg` : '';

            const miniPreview = document.createElement('div');
            miniPreview.className = 'ge-layer-mini-preview';
            const bg = grad.stops.map((s) => `${s.color} ${s.position}%`).join(', ');
            miniPreview.style.background = `linear-gradient(to right, ${bg})`;

            layer.innerHTML = `
                <div class="ge-layer-info">
                    <div class="ge-layer-name">${label}</div>
                    <div class="ge-layer-sub">${sub}</div>
                </div>
            `;
            layer.prepend(miniPreview);

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'ge-layer-toggle';
            toggleBtn.textContent = grad.enabled ? '👁' : '👁‍🗨';
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                store.dispatch({ type: 'TOGGLE_GRADIENT_LAYER', gradientId: grad.id });
            });
            layer.appendChild(toggleBtn);

            layer.addEventListener('click', () => {
                store.dispatch({ type: 'SET_ACTIVE_GRADIENT', gradientId: grad.id });
            });

            layerList.appendChild(layer);
        });
    }

    store.subscribe(render);
    render();
}
