/**
 * presets.js — Gradient preset library with categories.
 */

import { getStore } from '../store.js';
import { createGradient, createStop } from '../engine/gradient-model.js';

const BUILTIN_PRESETS = {
    Popular: [
        { name: 'Sunset', model: buildPreset('linear', 180, [['#ff6b6b', 0], ['#ffa500', 50], ['#ff6347', 100]]) },
        { name: 'Ocean', model: buildPreset('linear', 180, [['#667eea', 0], ['#764ba2', 100]]) },
        { name: 'Cool Blues', model: buildPreset('linear', 135, [['#2193b0', 0], ['#6dd5ed', 100]]) },
        { name: 'Shifter', model: buildPreset('linear', 180, [['#bc4e9c', 0], ['#f80759', 100]]) },
    ],
    Blue: [
        { name: 'Blue sky', model: buildPreset('linear', 180, [['#00b4db', 0], ['#0083b0', 100]]) },
        { name: 'Blue Flame', model: buildPreset('linear', 180, [['#00cdff', 0], ['#0088cc', 100]]) },
        { name: 'Deep Blue', model: buildPreset('linear', 180, [['#1a2a6c', 0], ['#b21f1f', 50], ['#fdbb2d', 100]]) },
    ],
    Purple: [
        { name: 'Purple Rain', model: buildPreset('linear', 180, [['#544a7d', 0], ['#ffd452', 100]]) },
        { name: 'Royal Purple', model: buildPreset('linear', 135, [['#6a3093', 0], ['#a044ff', 100]]) },
    ],
    Red: [
        { name: 'Red Sunset', model: buildPreset('linear', 180, [['#cb2d3e', 0], ['#ef473a', 100]]) },
        { name: 'Crimson', model: buildPreset('linear', 180, [['#a80077', 0], ['#66ff00', 100]]) },
    ],
    Green: [
        { name: 'Emerald', model: buildPreset('linear', 180, [['#11998e', 0], ['#38ef7d', 100]]) },
        { name: 'Forest', model: buildPreset('linear', 180, [['#134e5e', 0], ['#71b280', 100]]) },
    ],
    Dark: [
        { name: 'Midnight', model: buildPreset('linear', 180, [['#232526', 0], ['#414345', 100]]) },
        { name: 'Dark Matter', model: buildPreset('linear', 180, [['#000000', 0], ['#1a1a2e', 50], ['#16213e', 100]]) },
    ],
    Neon: [
        { name: 'Neon City', model: buildPreset('linear', 180, [['#fc466b', 0], ['#3f5efb', 100]]) },
        { name: 'Electric', model: buildPreset('linear', 180, [['#ff00cc', 0], ['#3333cc', 50], ['#ff00cc', 100]]) },
    ],
};

function buildPreset(type, angle, stops) {
    return createGradient({
        type,
        orientation: { mode: 'angle', angle },
        stops: stops.map(([color, position]) => createStop(color, position)),
    });
}

function createPresetCard(name, model) {
    const card = document.createElement('div');
    card.className = 'ge-preset-card';
    const preview = document.createElement('div');
    preview.className = 'ge-preset-preview';
    const bg = model.stops.map((s) => `${s.color} ${s.position}%`).join(', ');
    preview.style.background = `linear-gradient(to right, ${bg})`;
    const label = document.createElement('div');
    label.className = 'ge-preset-label';
    label.textContent = name;
    card.appendChild(preview);
    card.appendChild(label);
    card.addEventListener('click', () => {
        const store = getStore();
        store.dispatch({ type: 'IMPORT_GRADIENT', model: JSON.parse(JSON.stringify(model)), replaceCurrent: true });
    });
    return card;
}

export function createPresets(container) {
    container.innerHTML = `
        <div class="ge-presets-panel" id="ge-presets-panel">
            <div class="ge-section-title">Presets</div>
            <div class="ge-presets-categories" id="ge-presets-categories"></div>
        </div>
    `;

    const categoriesEl = container.querySelector('#ge-presets-categories');

    Object.entries(BUILTIN_PRESETS).forEach(([cat, presets]) => {
        const catEl = document.createElement('div');
        catEl.className = 'ge-preset-category';
        catEl.innerHTML = `<div class="ge-preset-category-title">${cat}</div><div class="ge-preset-grid"></div>`;
        const gridEl = catEl.querySelector('.ge-preset-grid');
        presets.forEach((preset) => {
            gridEl.appendChild(createPresetCard(preset.name, preset.model));
        });
        categoriesEl.appendChild(catEl);
    });
}
