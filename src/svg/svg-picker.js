// SVG Picker: modal that lets users browse SVG categories and add SVGs to the canvas.
// Supports multi-select — click to toggle, confirm places all selected.

import { emit } from '@/core/bus.js';
import { record } from '@/history/history.js';
import {
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    setElements,
} from '@/core/state.js';
import { generateId } from '@/core/utils.js';
import arrowsData from '@resources/svgs/arrows/arrow-svg.json';
import geometricData from '@resources/svgs/abstract_geometrics/abstract-geometric-svg.json';

// ── Derive categories from JSON keys ──
// Format: { "arrows": { "arrow-01": "<svg...>", ... } }
// Category label is the key, capitalized.
const allData = { ...arrowsData, ...geometricData };
const CATEGORIES = Object.entries(allData).map(([key, svgs]) => ({
    id: key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    svgs: Object.entries(svgs).map(([name, svgContent]) => ({
        name,
        dataUrl: 'data:image/svg+xml,' + encodeURIComponent(svgContent),
    })),
}));

// ── Picker state ──
let selectedSvgs = []; // array of { name, dataUrl } — multi-select
let modal = null;
let _selectElement = null; // injected after init

const SVG_DEFAULT_SIZE = 20; // px default width for each SVG placed on the canvas

// ── Build modal DOM ──
function buildModal() {
    if (modal) return modal;

    // Backdrop
    modal = document.createElement('div');
    modal.className = 'svg-picker-backdrop';
    modal.style.display = 'none';

    // Modal container
    const container = document.createElement('div');
    container.className = 'svg-picker-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'svg-picker-header';

    const title = document.createElement('h3');
    title.textContent = 'SVG Library';

    const countBadge = document.createElement('span');
    countBadge.className = 'svg-picker-count';
    countBadge.style.display = 'none';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'svg-picker-close';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', cancel);

    header.appendChild(title);
    header.appendChild(countBadge);
    header.appendChild(closeBtn);

    // Tab bar — filter by category
    const tabBar = document.createElement('div');
    tabBar.className = 'svg-picker-tabs';

    const allTab = document.createElement('button');
    allTab.className = 'svg-picker-tab active';
    allTab.textContent = 'All';
    allTab.dataset.category = 'all';
    tabBar.appendChild(allTab);

    CATEGORIES.forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'svg-picker-tab';
        tab.textContent = cat.label;
        tab.dataset.category = cat.id;
        tabBar.appendChild(tab);
    });

    tabBar.addEventListener('click', e => {
        const tab = e.target.closest('.svg-picker-tab');
        if (!tab) return;
        tabBar.querySelectorAll('.svg-picker-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        filterCategories(tab.dataset.category);
    });

    // Preview area — shows all selected SVGs as 40px thumbnails
    const preview = document.createElement('div');
    preview.className = 'svg-picker-preview';

    const previewLabel = document.createElement('div');
    previewLabel.className = 'svg-picker-preview-label';
    previewLabel.id = 'svg-picker-preview-label';
    previewLabel.textContent = 'Select one or more SVGs';

    preview.appendChild(previewLabel);

    // Content area (categories + grids)
    const content = document.createElement('div');
    content.className = 'svg-picker-content';

    CATEGORIES.forEach(cat => {
        const section = document.createElement('div');
        section.className = 'svg-picker-category';
        section.dataset.category = cat.id;

        const catTitle = document.createElement('div');
        catTitle.className = 'svg-picker-category-title';
        catTitle.textContent = cat.label;
        section.appendChild(catTitle);

        const grid = document.createElement('div');
        grid.className = 'svg-picker-grid';

        cat.svgs.forEach(svgEntry => {
            const cell = document.createElement('div');
            cell.className = 'svg-picker-cell';
            cell.title = svgEntry.name;
            cell.dataset.name = svgEntry.name;

            const img = document.createElement('img');
            img.src = svgEntry.dataUrl;
            img.alt = svgEntry.name;
            img.draggable = false;

            cell.appendChild(img);
            grid.appendChild(cell);

            cell.addEventListener('click', () => {
                toggleSvg(svgEntry, cell);
            });
        });

        section.appendChild(grid);
        content.appendChild(section);
    });

    // Footer buttons
    const footer = document.createElement('div');
    footer.className = 'svg-picker-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'svg-picker-btn svg-picker-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', cancel);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'svg-picker-btn svg-picker-btn-confirm';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', confirm);

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    // Assemble
    container.appendChild(header);
    container.appendChild(tabBar);
    container.appendChild(preview);
    container.appendChild(content);
    container.appendChild(footer);

    modal.appendChild(container);

    // Close on backdrop click
    modal.addEventListener('click', e => {
        if (e.target === modal) cancel();
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.style.display !== 'none') {
            cancel();
        }
    });

    document.body.appendChild(modal);
    return modal;
}

// ── Multi-select logic ──
function isSelected(svgEntry) {
    return selectedSvgs.some(s => s.name === svgEntry.name);
}

function toggleSvg(svgEntry, cellEl) {
    if (isSelected(svgEntry)) {
        // Deselect
        selectedSvgs = selectedSvgs.filter(s => s.name !== svgEntry.name);
        cellEl.classList.remove('selected');
        // Move back down (append to end of grid)
        const grid = cellEl.closest('.svg-picker-grid');
        if (grid) grid.appendChild(cellEl);
    } else {
        // Select — add to list
        selectedSvgs.push(svgEntry);
        cellEl.classList.add('selected');
        // Move selected to top of its category grid
        const grid = cellEl.closest('.svg-picker-grid');
        if (grid && grid.firstChild !== cellEl) {
            grid.insertBefore(cellEl, grid.firstChild);
        }
    }

    // Update preview — show the last-selected SVG
    updatePreview();

    // Update count badge
    updateCountBadge();
}

function updatePreview() {
    const previewLabel = modal.querySelector('.svg-picker-preview-label');
    if (!previewLabel) return;
    previewLabel.innerHTML = '';
    if (selectedSvgs.length > 0) {
        selectedSvgs.forEach(svg => {
            const thumb = document.createElement('img');
            thumb.src = svg.dataUrl;
            thumb.alt = svg.name;
            thumb.className = 'svg-picker-preview-thumb';
            thumb.title = svg.name;
            thumb.draggable = false;
            previewLabel.appendChild(thumb);
        });
    } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'svg-picker-preview-placeholder';
        placeholder.textContent = 'Select one or more SVGs';
        previewLabel.appendChild(placeholder);
    }
}

function filterCategories(categoryId) {
    if (!modal) return;
    modal.querySelectorAll('.svg-picker-category').forEach(section => {
        section.style.display = (categoryId === 'all' || section.dataset.category === categoryId) ? '' : 'none';
    });
}

function updateCountBadge() {
    const badge = modal.querySelector('.svg-picker-count');
    if (!badge) return;
    if (selectedSvgs.length > 0) {
        badge.textContent = `${selectedSvgs.length} selected`;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// ── Actions ──
function cancel() {
    selectedSvgs = [];
    if (modal) modal.style.display = 'none';
}

function confirm() {
    if (!selectedSvgs.length) return;

    const canvasW = getCanvasWidth();
    const canvasH = getCanvasHeight();
    const newElements = [];        selectedSvgs.forEach((svgEntry, idx) => {
        const { dataUrl } = svgEntry;

        // Compute size from SVG viewBox aspect ratio
        const defaultW = SVG_DEFAULT_SIZE;
        let width = defaultW;
        let height = defaultW;

        try {
            const decoded = decodeURIComponent(dataUrl.split(',')[1]);
            const vbMatch = decoded.match(/viewBox=["']([^"']+)["']/);
            if (vbMatch) {
                const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
                if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
                    const aspect = parts[2] / parts[3];
                    if (aspect >= 1) {
                        height = Math.round(width / aspect);
                    } else {
                        width = Math.round(height * aspect);
                    }
                }
            }
        } catch (_) { /* square fallback */ }

        // Stack multiple SVGs with a slight offset so they don't fully overlap
        const offset = idx * 15;

        newElements.push({
            id: generateId(),
            type: 'svg',
            src: dataUrl,
            svgName: svgEntry.name,
            fillColor: '#231f20',
            // SVG shape controls
            strokeWidth: 0,
            blurX: 0,
            blurY: 0,
            ghostBlurX: 0,
            ghostBlurY: 0,
            ghostOffsetX: 0,
            ghostOffsetY: 0,
            ghostOpacity: 0,
            // Gradient
            gradientColor: null,
            gradientAngle: 0,
            gradientOpacity: 100,
            x: Math.max(0, Math.min(canvasW - width, (canvasW - width) / 2 + offset)),
            y: Math.max(0, Math.min(canvasH - height, (canvasH - height) / 2 + offset)),
            width,
            height,
            fitMode: 'fill',
            rotation: 0,
            skewX: 0,
            skewY: 0,
        });
    });

    record();
    setElements([...getElements(), ...newElements]);
    emit('render');

    // Select the last placed element
    if (_selectElement && newElements.length > 0) {
        _selectElement(newElements[newElements.length - 1].id);
    }

    // Reset and close
    selectedSvgs = [];
    if (modal) modal.style.display = 'none';
}

// ── Public API ──

/**
 * Initialize the SVG picker. Must be called with the selectElement function
 * to avoid circular imports with selection.js.
 */
export function initSvgPicker(selectElementFn) {
    _selectElement = selectElementFn;
    buildModal();
}

/** Open the SVG picker modal. */
export function openSvgPicker() {
    buildModal();
    // Reset previous selection state
    selectedSvgs = [];
    modal.querySelectorAll('.svg-picker-cell.selected').forEach(c =>
        c.classList.remove('selected')
    );
    // Move all cells back to original order (remove from top)
    modal.querySelectorAll('.svg-picker-grid').forEach(grid => {
        const cells = Array.from(grid.children);
        cells.sort((a, b) => {
            const na = a.dataset.name || '';
            const nb = b.dataset.name || '';
            return na.localeCompare(nb);
        });
        cells.forEach(c => grid.appendChild(c));
    });
    // Reset to All tab
    const tabs = modal.querySelectorAll('.svg-picker-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[0]?.classList.add('active');
    filterCategories('all');

    updatePreview();
    updateCountBadge();
    modal.style.display = 'flex';
}
