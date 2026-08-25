/**
 * preview.js — Live gradient preview panel.
 */

import { serializeMultipleGradients } from '../engine/gradient-serializer.js';
import { getStore } from '../store.js';

export function createPreview(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-preview-panel">
            <div class="ge-preview-canvas" id="ge-preview-canvas"></div>
        </div>
    `;

    const canvas = container.querySelector('#ge-preview-canvas');

    function render() {
        const state = store.getState();
        const gradients = state.gradients.filter((g) => g.enabled);

        if (gradients.length === 0) {
            canvas.style.background = 'transparent';
            return;
        }

        const css = serializeMultipleGradients(gradients, state.colorFormat);
        const bgValue = css.replace(/^background:\s*/, '').replace(/;$/, '').trim();
        canvas.style.background = bgValue;
    }

    store.subscribe(render);
    render();
}
