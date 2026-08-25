/**
 * css-editor.js — CSS import panel and CSS output display.
 */

import { getStore } from '../store.js';
import { parseGradient, parseMultipleGradients } from '../engine/gradient-parser.js';
import { normalizeGradient } from '../engine/gradient-normalizer.js';
import { serializeGradient, serializeMultipleGradients } from '../engine/gradient-serializer.js';

export function createCSSEditor(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-css-section">
            <div class="ge-css-import-panel" id="ge-css-import-panel">
                <div class="ge-section-title">Import CSS</div>
                <textarea id="ge-css-import-input" class="ge-textarea-code" rows="3" placeholder="Paste a CSS gradient here..."></textarea>
                <div class="ge-import-actions">
                    <button class="ge-btn ge-btn-primary" id="ge-btn-import-css">Import CSS</button>
                    <button class="ge-btn ge-btn-secondary" id="ge-btn-clear-import">Clear</button>
                </div>
                <div id="ge-import-error" class="ge-error-text" style="display:none;"></div>
            </div>
            <div class="ge-css-output-panel" id="ge-css-output-panel">
                <div class="ge-section-title">Generated CSS</div>
                <div class="ge-css-output-code" id="ge-css-output-code"></div>
                <div class="ge-export-actions">
                    <button class="ge-btn ge-btn-primary" id="ge-btn-copy-css">Copy CSS</button>
                </div>
                <div id="ge-copy-feedback" class="ge-success-text" style="display:none;">Copied!</div>
            </div>
        </div>
    `;

    const importInput = container.querySelector('#ge-css-import-input');
    const importBtn = container.querySelector('#ge-btn-import-css');
    const clearBtn = container.querySelector('#ge-btn-clear-import');
    const errorEl = container.querySelector('#ge-import-error');
    const outputEl = container.querySelector('#ge-css-output-code');
    const copyBtn = container.querySelector('#ge-btn-copy-css');
    const copyFeedback = container.querySelector('#ge-copy-feedback');

    importBtn.addEventListener('click', () => {
        const css = importInput.value.trim();
        if (!css) return;
        errorEl.style.display = 'none';
        const results = parseMultipleGradients(css);
        const validResults = results.filter((r) => r.model);
        if (validResults.length === 0) {
            const firstError = results.find((r) => r.error);
            errorEl.textContent = firstError?.error || 'Invalid CSS gradient.';
            errorEl.style.display = '';
            return;
        }
        const models = validResults.map((r) => normalizeGradient(r.model));
        if (models.length === 1) {
            store.dispatch({ type: 'IMPORT_GRADIENT', model: models[0], replaceCurrent: true });
        }
        importInput.value = '';
    });

    clearBtn.addEventListener('click', () => {
        importInput.value = '';
        errorEl.style.display = 'none';
    });

    copyBtn.addEventListener('click', async () => {
        const css = outputEl.textContent;
        try {
            await navigator.clipboard.writeText(css);
            copyFeedback.style.display = '';
            setTimeout(() => (copyFeedback.style.display = 'none'), 2000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = css;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            copyFeedback.style.display = '';
            setTimeout(() => (copyFeedback.style.display = 'none'), 2000);
        }
    });

    function render() {
        const state = store.getState();
        const gradients = state.gradients.filter((g) => g.enabled);
        if (gradients.length === 0) {
            outputEl.textContent = '';
            return;
        }
        const css = serializeMultipleGradients(gradients, state.colorFormat);
        outputEl.textContent = css;
    }

    store.subscribe(render);
    render();
}
