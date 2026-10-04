/**
 * modal.js — Gradient editor modal with Apply/Cancel buttons.
 * Wraps the gradient editor UI into a responsive modal dialog.
 */

import { getStore } from './store.js';
import { serializeMultipleGradients } from './engine/gradient-serializer.js';
import { parseGradient } from './engine/gradient-parser.js';
import { normalizeGradient } from './engine/gradient-normalizer.js';
import { createGradient } from './engine/gradient-model.js';
import './gradient-modal.css';
import { createToolbar } from './ui/toolbar.js';
import { createPreview } from './ui/preview.js';
import { createGradientBar } from './ui/gradient-bar.js';
import { createStopEditor } from './ui/stop-editor.js';
import { createOrientationEditor } from './ui/orientation-editor.js';
import { createRadialEditor } from './ui/radial-editor.js';
import { createConicEditor } from './ui/conic-editor.js';
import { createOpacityEditor } from './ui/opacity-editor.js';
import { createPresets } from './ui/presets.js';
import { createLayerManager } from './ui/layer-manager.js';
import { createHSLAdjustments } from './ui/hsl-adjustments.js';
import { createCSSEditor } from './ui/css-editor.js';
import { initColorPicker } from './ui/color-picker.js';

let modalEl = null;
let initialized = false;
let onApply = null;
let allowFlat = true;

/**
 * Create the modal DOM structure and append it to document.body.
 */
function createModalDOM() {
    modalEl = document.createElement('div');
    modalEl.className = 'ge-modal';
    modalEl.id = 'gradientEditorModal';
    modalEl.innerHTML = `
        <div class="ge-modal-backdrop" id="ge-modal-backdrop"></div>
        <div class="ge-modal-dialog">
            <div class="ge-modal-header">
                <span class="ge-modal-title">🎨 Gradient Editor</span>
                <button class="ge-modal-close" id="ge-modal-close">✕</button>
            </div>
            <div class="ge-modal-body" id="ge-modal-body">
                <div class="ge-editor-layout">
                    <div class="ge-left-panel" id="ge-left-panel">
                        <div id="ge-toolbar-container"></div>
                        <div id="ge-preview-container"></div>
                        <div id="ge-gradient-bar-container"></div>
                        <div id="ge-layer-manager-container"></div>
                        <div id="ge-orientation-container"></div>
                        <div id="ge-radial-container"></div>
                        <div id="ge-conic-container"></div>
                        <div id="ge-stop-editor-container"></div>
                        <div id="ge-opacity-container"></div>
                        <div id="ge-hsl-container"></div>
                        <div id="ge-presets-container"></div>
                    </div>
                    <div class="ge-right-panel" id="ge-right-panel">
                        <div id="ge-css-container"></div>
                    </div>
                </div>
            </div>
            <div class="ge-modal-footer">
                <button class="ge-btn ge-btn-secondary" id="ge-modal-cancel">Cancel</button>
                <button class="ge-btn ge-btn-primary" id="ge-modal-apply">Apply Gradient</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);
}

/**
 * Initialize the gradient editor UI inside the modal.
 * Called once when the modal is first opened.
 */
function initEditorUI() {
    if (initialized) return;
    initialized = true;

    initColorPicker();

    createToolbar(document.getElementById('ge-toolbar-container'));
    createPreview(document.getElementById('ge-preview-container'));
    createGradientBar(document.getElementById('ge-gradient-bar-container'));
    createLayerManager(document.getElementById('ge-layer-manager-container'));
    createOrientationEditor(document.getElementById('ge-orientation-container'));
    createRadialEditor(document.getElementById('ge-radial-container'));
    createConicEditor(document.getElementById('ge-conic-container'));
    createStopEditor(document.getElementById('ge-stop-editor-container'));
    createOpacityEditor(document.getElementById('ge-opacity-container'));
    createHSLAdjustments(document.getElementById('ge-hsl-container'));
    createPresets(document.getElementById('ge-presets-container'));
    createCSSEditor(document.getElementById('ge-css-container'));
}

/**
 * Open the gradient editor modal.
 * @param {Object} options
 *   currentGradient: string|null — existing gradient CSS to edit
 *   flatMode: 'transparent'|'solid'|null — flat background to preselect
 *   flatColor: string — solid color when flatMode is 'solid'
 *   allowFlat: boolean — offer Transparent/Solid in the Type dropdown
 *     (on for the canvas background, off for element-only gradients)
 *   apply: (css: string|null) => void
 */
export function openGradientModal(options = {}) {
    onApply = options.apply || null;
    allowFlat = options.allowFlat !== false;
    const store = getStore();

    // Flat mode first: the toolbar hides the solid picker unless we are in it.
    store.dispatch({ type: 'SET_FLAT_MODE', mode: allowFlat ? (options.flatMode || null) : null });
    if (allowFlat && options.flatColor) {
        store.dispatch({ type: 'SET_FLAT_COLOR', color: options.flatColor });
    }

    if (options.currentGradient) {
        // Import the existing gradient CSS into the active gradient
        const result = parseGradient(options.currentGradient);
        if (result.model) {
            const normalized = normalizeGradient(result.model);
            store.dispatch({ type: 'IMPORT_GRADIENT', model: normalized, replaceCurrent: true });
        }
    } else {
        // No gradient — dispatch a fresh default so the editor starts clean
        store.dispatch({ type: 'IMPORT_GRADIENT', model: createGradient(), replaceCurrent: true });
    }

    if (!modalEl) createModalDOM();
    initEditorUI();

    // Opened from the BG tool this edits the whole background (transparent /
    // solid / gradient); from the properties panel it is gradient-only, so
    // the flat options come out of the Type dropdown entirely.
    modalEl.querySelector('.ge-modal-title').textContent =
        allowFlat ? '🎨 Background Editor' : '🎨 Gradient Editor';
    modalEl.querySelector('#ge-modal-apply').textContent =
        allowFlat ? 'Apply Background' : 'Apply Gradient';
    const typeSelect = modalEl.querySelector('#ge-gradient-type-select');
    if (typeSelect) {
        typeSelect.querySelectorAll('option').forEach(opt => {
            const isFlat = opt.value === 'transparent' || opt.value === 'solid';
            opt.hidden = !allowFlat && isFlat;
            opt.disabled = !allowFlat && isFlat;
        });
        // Only force-hide the solid row for gradient-only use; otherwise the
        // toolbar decides visibility from the current flat mode.
        const solidPicker = modalEl.querySelector('#ge-flat-picker');
        if (!allowFlat && solidPicker) solidPicker.style.display = 'none';
    }

    // Wire up close/apply/cancel
    const backdrop = modalEl.querySelector('#ge-modal-backdrop');
    const closeBtn = modalEl.querySelector('#ge-modal-close');
    const cancelBtn = modalEl.querySelector('#ge-modal-cancel');
    const applyBtn = modalEl.querySelector('#ge-modal-apply');

    const closeModal = () => {
        modalEl.classList.remove('open');
        document.removeEventListener('keydown', escHandler);
    };

    const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
    };

    // Remove old listeners by replacing elements
    backdrop.replaceWith(backdrop.cloneNode(true));
    closeBtn.replaceWith(closeBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    applyBtn.replaceWith(applyBtn.cloneNode(true));

    // Re-query after replacing
    modalEl.querySelector('#ge-modal-backdrop').addEventListener('click', closeModal);
    modalEl.querySelector('#ge-modal-close').addEventListener('click', closeModal);
    modalEl.querySelector('#ge-modal-cancel').addEventListener('click', closeModal);
    modalEl.querySelector('#ge-modal-apply').addEventListener('click', () => {
        const state = store.getState();
        // Flat modes short-circuit: they carry no gradient CSS at all.
        if (allowFlat && state.flatMode === 'transparent') {
            if (onApply) onApply('transparent');
            closeModal();
            return;
        }
        if (allowFlat && state.flatMode === 'solid') {
            if (onApply) onApply(state.flatColor);
            closeModal();
            return;
        }
        const gradients = state.gradients.filter((g) => g.enabled);
        if (gradients.length === 0) {
            if (onApply) onApply(null);
        } else {
            const css = serializeMultipleGradients(gradients, state.colorFormat);
            const bgValue = css.replace(/^background:\s*/, '').replace(/;$/, '').trim();
            if (onApply) onApply(bgValue);
        }
        closeModal();
    });

    document.addEventListener('keydown', escHandler);
    modalEl.classList.add('open');
}

/**
 * Close the gradient editor modal (programmatic).
 */
export function closeGradientModal() {
    if (modalEl) modalEl.classList.remove('open');
}
