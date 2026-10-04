// Composition root: initializes every module and wires up the top-level UI
// (aspect ratios, toolbox, clear). All other logic lives in its own module.

// Bundle the built-in brand-style font faces (woff2 files ride along).
import '@resources/fonts/fonts.css';

import { emit, on } from '@/core/bus.js';
import { dom } from '@/core/dom.js';
import { initCanvas, updateCanvasSize } from '@/canvas/canvas.js';
import { initInteractions } from '@/interactions/interactions.js';
import { initProperties } from '@/properties/properties.js';
import { initExport } from '@/export/export.js';
import { addImageElement, addSvgElement, addTextElement } from '@/elements/elements.js';
import { importHtml } from '@/import/html-importer.js';
import { loadUserFonts } from '@/fonts/fonts.js';
import { initPages, addPage, cloneActivePage } from '@/pages/pages.js';
import { initSelectMode } from '@/selection/selectmode.js';
import { initSvgPicker, openSvgPicker } from '@/svg/svg-picker.js';
import { initShortcuts } from '@/shortcuts/shortcuts.js';
import { selectElement } from '@/selection/selection.js';
import { canRedo, canUndo, record, redo, undo } from '@/history/history.js';
import { openGradientModal } from '@/gradient/modal.js';
import {
    getActivePage,
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getPages,
    setSelectedElementId,
    setAspectRatio,
} from '@/core/state.js';

// ── Boot modules (each subscribes to the events it cares about) ──
initCanvas();
initInteractions();
initProperties();
initExport();
initShortcuts();
initSelectMode();
initSvgPicker(selectElement);
initPages();

// ── Aspect ratio buttons ──
dom.aspectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        dom.aspectBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setAspectRatio(btn.dataset.ratio);
        updateCanvasSize();
        emit('render');
    });
});

// ── Toolbox ──
dom.addTextTool.addEventListener('click', addTextElement);
dom.svgPickerTool.addEventListener('click', openSvgPicker);
dom.imageUploadInput.addEventListener('change', e => {
    if (e.target.files[0]) {
        addImageElement(e.target.files[0]);
        dom.imageUploadInput.value = '';
    }
});

// ── BG tool → opens the background editor (gradient modal) ──
// The Type dropdown inside it offers Transparent | Solid | gradient shapes;
// the page keeps whichever one was applied last.
dom.bgColorTool.addEventListener('click', e => {
    e.stopPropagation();
    const page = getActivePage();
    // Preselect the page's current background in the modal.
    const isTransparent = !page || !page.bgColor || page.bgColor === 'transparent';
    const flatMode = page && page.bgGradient ? null : (isTransparent ? 'transparent' : 'solid');
    const flatColor = page && /^#[0-9a-fA-F]{6}$/.test(page.bgColor) ? page.bgColor : '#ffffff';
    try {
        openGradientModal({
            currentGradient: page ? page.bgGradient : null,
            flatMode,
            flatColor,
            apply: (css) => {
                const p = getActivePage();
                if (!p) return;
                record(); // undo point BEFORE painting the background
                if (css === 'transparent') {
                    p.bgColor = 'transparent';
                    p.bgGradient = null;
                } else if (css && !css.includes('gradient(')) {
                    // A plain color from the Solid picker.
                    p.bgColor = css;
                    p.bgGradient = null;
                } else if (css) {
                    p.bgGradient = css;
                } else {
                    p.bgGradient = null;
                }
                dom.designCanvas.style.background = p.bgGradient || p.bgColor;
                emit('render');
            },
        });
    } catch (err) {
        console.error('Failed to open background editor:', err);
    }
});

// ── Toolbox: Import SVG ──
// Toggle the dropdown on tool click
dom.importSvgTool.addEventListener('click', e => {
    e.stopPropagation();
    const dd = dom.importSvgDropdown;
    const isOpen = dd.style.display !== 'none';
    dd.style.display = isOpen ? 'none' : 'block';
});

// Close dropdown on outside click
document.addEventListener('click', e => {
    if (!dom.importSvgTool.contains(e.target)) {
        dom.importSvgDropdown.style.display = 'none';
    }
});

// Local SVG file import — opens file picker with multiple selection
dom.importSvgLocalOption.addEventListener('click', e => {
    e.stopPropagation();
    dom.importSvgDropdown.style.display = 'none';
    dom.importSvgFileInput.click();
});

dom.importSvgFileInput.addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            // Validate it's an SVG
            const text = ev.target.result;
            if (text.includes('<svg') || text.includes('<SVG')) {
                // If it's raw text, convert to data URL
                const dataUrl = 'data:image/svg+xml,' + encodeURIComponent(text);
                addSvgElement(dataUrl, file.name);
            }
        };
        reader.readAsText(file);
    });
    dom.importSvgFileInput.value = '';
});

// Paste SVG code — open the modal
dom.importSvgPasteOption.addEventListener('click', e => {
    e.stopPropagation();
    dom.importSvgDropdown.style.display = 'none';
    dom.importSvgPasteBackdrop.style.display = 'flex';
    dom.importSvgPasteInput.value = '';
    dom.importSvgPasteInput.focus();
});

// Close paste modal
dom.importSvgPasteClose.addEventListener('click', () => {
    dom.importSvgPasteBackdrop.style.display = 'none';
});
dom.importSvgPasteCancel.addEventListener('click', () => {
    dom.importSvgPasteBackdrop.style.display = 'none';
});
dom.importSvgPasteBackdrop.addEventListener('click', e => {
    if (e.target === dom.importSvgPasteBackdrop) {
        dom.importSvgPasteBackdrop.style.display = 'none';
    }
});

// Import pasted SVG code
dom.importSvgPasteConfirm.addEventListener('click', () => {
    const raw = dom.importSvgPasteInput.value.trim();
    if (!raw) return;
    // Split by blank lines to support multiple SVGs
    const chunks = raw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    chunks.forEach((svgText, i) => {
        if (svgText.includes('<svg') || svgText.includes('<SVG')) {
            const dataUrl = 'data:image/svg+xml,' + encodeURIComponent(svgText);
            addSvgElement(dataUrl, 'pasted-svg-' + (i + 1));
        }
    });
    dom.importSvgPasteBackdrop.style.display = 'none';
});

// ── Toolbox: Import HTML ──
dom.importHtmlOption.addEventListener('click', e => {
    e.stopPropagation();
    dom.importSvgDropdown.style.display = 'none';
    dom.importHtmlFileInput.click();
});

dom.importHtmlFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
        const html = ev.target.result;
        try {
            const result = await importHtml(html, file.name);
            console.log(`Imported: ${result.pagesAdded} pages, ${result.elementsAdded} elements`);
        } catch (err) {
            console.error('HTML import failed:', err);
            alert('Failed to import HTML: ' + err.message);
        }
    };
    reader.readAsText(file);
    dom.importHtmlFileInput.value = '';
});

// ── Toolbox: HTML Inject (paste code or upload file → render as canvas elements) ──
dom.htmlInjectTool.addEventListener('click', e => {
    e.stopPropagation();
    dom.htmlInjectBackdrop.style.display = 'flex';
    dom.htmlInjectInput.value = '';
    dom.htmlInjectInput.focus();
});

// Tab switching
dom.htmlInjectTabCode.addEventListener('click', () => {
    dom.htmlInjectCodePanel.style.display = '';
    dom.htmlInjectFilePanel.style.display = 'none';
    dom.htmlInjectTabCode.style.background = 'var(--primary)';
    dom.htmlInjectTabCode.style.color = '#fff';
    dom.htmlInjectTabFile.style.background = '';
    dom.htmlInjectTabFile.style.color = '';
});
dom.htmlInjectTabFile.addEventListener('click', () => {
    dom.htmlInjectCodePanel.style.display = 'none';
    dom.htmlInjectFilePanel.style.display = '';
    dom.htmlInjectTabFile.style.background = 'var(--primary)';
    dom.htmlInjectTabFile.style.color = '#fff';
    dom.htmlInjectTabCode.style.background = '';
    dom.htmlInjectTabCode.style.color = '';
});

// File drop zone
dom.htmlInjectDropZone.addEventListener('click', () => dom.htmlInjectFileInput.click());
dom.htmlInjectDropZone.addEventListener('dragover', e => { e.preventDefault(); dom.htmlInjectDropZone.style.borderColor = 'var(--primary)'; });
dom.htmlInjectDropZone.addEventListener('dragleave', () => { dom.htmlInjectDropZone.style.borderColor = ''; });
dom.htmlInjectDropZone.addEventListener('drop', e => {
    e.preventDefault();
    dom.htmlInjectDropZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) injectHtmlFile(file);
});
dom.htmlInjectFileInput.addEventListener('change', e => {
    if (e.target.files[0]) injectHtmlFile(e.target.files[0]);
    dom.htmlInjectFileInput.value = '';
});

function injectHtmlFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        dom.htmlInjectInput.value = ev.target.result;
        dom.htmlInjectTabCode.click(); // switch to code view so user can review
        dom.htmlInjectInput.focus();
    };
    reader.readAsText(file);
}

// Close / cancel
dom.htmlInjectClose.addEventListener('click', () => dom.htmlInjectBackdrop.style.display = 'none');
dom.htmlInjectCancel.addEventListener('click', () => dom.htmlInjectBackdrop.style.display = 'none');
dom.htmlInjectBackdrop.addEventListener('click', e => {
    if (e.target === dom.htmlInjectBackdrop) dom.htmlInjectBackdrop.style.display = 'none';
});

// Confirm → parse HTML and inject as editable canvas elements
dom.htmlInjectConfirm.addEventListener('click', async () => {
    const html = dom.htmlInjectInput.value.trim();
    if (!html) return;
    try {
        const result = await importHtml(html, 'html-inject');
        console.log(`HTML injected: ${result.pagesAdded} pages, ${result.elementsAdded} elements`);
        dom.htmlInjectBackdrop.style.display = 'none';
    } catch (err) {
        console.error('HTML inject failed:', err);
        alert('Failed to inject HTML: ' + err.message);
    }
});

// ── Toolbox: undo / redo buttons ──
function syncHistoryButtons() {
    dom.undoTool.classList.toggle('disabled', !canUndo());
    dom.redoTool.classList.toggle('disabled', !canRedo());
    dom.undoTool.setAttribute('aria-disabled', String(!canUndo()));
    dom.redoTool.setAttribute('aria-disabled', String(!canRedo()));
}
on('history', syncHistoryButtons);
dom.undoTool.addEventListener('click', () => { if (canUndo()) undo(); });
dom.redoTool.addEventListener('click', () => { if (canRedo()) redo(); });
syncHistoryButtons();

// ── Top bar ──
dom.clearCanvasBtn.addEventListener('click', () => {
    record(); // so Ctrl+Z can bring the cleared design back
    const page = getActivePage();
    if (page) {
        page.elements = [];
        page.bgColor = 'transparent'; // matches the BG tool's default Type
        page.bgGradient = null;
    }
    setSelectedElementId(null);
    dom.designCanvas.style.background = 'transparent';
    emit('render');
});

// ── Viewport changes ──
window.addEventListener('resize', () => {
    updateCanvasSize();
    emit('render');
});



// ── Initial layout ──
updateCanvasSize();
emit('render'); // paints the first page, its background and the page track

// Load custom fonts saved in resources/user/fonts/ (errors are printed).
loadUserFonts();
