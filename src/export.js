// Export options, offered as a dropdown menu on the top-bar Export button:
//   1. Current Canvas — this page as a high-res PNG (live capture)
//   2. All Pages     — every page rendered as its own PNG, downloaded in turn
//   3. ZIP           — all page PNGs wrapped in a single .zip (jszip)
//   4. PDF           — all pages in one document (jsPDF), sized to the canvas
//
// Pages other than the active one are rendered from their model into an
// offscreen node (same buildElementDiv used by the canvas and thumbnails) so
// exporting never disturbs the live canvas or the current selection.

import { toBlob } from 'html-to-image';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { buildElementDiv } from './canvas.js';
import { dom } from './dom.js';
import { EXPORT_PIXEL_RATIO } from './constants.js';
import { getCanvasSize, getPages } from './state.js';

const BASE_LABEL = '📤 Export ▾';

let busy = false;

/** Open/close the dropdown menu. */
function setMenuOpen(open) {
    dom.exportMenu.style.display = open ? 'flex' : 'none';
}

function setBusy(label) {
    busy = true;
    dom.exportBtn.disabled = true;
    dom.exportBtn.textContent = label;
}

/** Capture the live on-screen canvas (active page) as a PNG blob. */
async function captureLiveCanvas() {
    const { width, height } = getCanvasSize();
    const { designCanvas } = dom;
    // Drop focus / hide selection chrome so nothing leaks into the capture.
    const focused = document.activeElement;
    if (focused && designCanvas.contains(focused)) focused.blur();
    designCanvas.classList.add('exporting');
    try {
        const blob = await toBlob(designCanvas, {
            pixelRatio: EXPORT_PIXEL_RATIO,
            width,
            height,
            cacheBust: true,
        });
        if (!blob) throw new Error('Rendering produced no image.');
        return blob;
    } finally {
        designCanvas.classList.remove('exporting');
    }
}

/**
 * Build an offscreen DOM node replicating a page model at full size.
 *
 * html-to-image renders the cloned node at its own left/top, so parking the
 * node at a huge negative offset (the usual "hide it" trick) captures a
 * blank image — the clone lands off-canvas. Instead the capture node sits at
 * absolute 0,0 *inside* a wrapper host that is itself pushed offscreen: the
 * clone is then positioned at the container origin where the renderer can
 * see it, while nothing flickers on screen.
 */
function buildPageNode(page) {
    const { width, height } = getCanvasSize();
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed; left:-99999px; top:0; width:0; height:0;';
    const node = document.createElement('div');
    node.className = 'canvas';
    node.style.cssText =
        `position:absolute; left:0; top:0; width:${width}px; height:${height}px; background:${page.bgColor};`;
    page.elements.forEach(el => node.appendChild(buildElementDiv(el, { scale: 1 })));
    host.appendChild(node);
    return { host, node };
}

/** Render any page (not necessarily the active one) to a PNG blob. */
async function capturePage(page) {
    const { width, height } = getCanvasSize();
    const { host, node } = buildPageNode(page);
    document.body.appendChild(host);
    try {
        const blob = await toBlob(node, {
            pixelRatio: EXPORT_PIXEL_RATIO,
            width,
            height,
            cacheBust: true,
        });
        if (!blob) throw new Error('Rendering produced no image.');
        return blob;
    } finally {
        document.body.removeChild(host);
    }
}

/** Trigger a browser download for the given blob. */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/** Pause between downloads so browsers don't throttle a burst of files. */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function exportCurrent() {
    const blob = await captureLiveCanvas();
    downloadBlob(blob, `design-${Date.now()}.png`);
}

async function exportAllImages() {
    const pages = getPages();
    for (let i = 0; i < pages.length; i++) {
        setBusy(`⏳ Page ${i + 1}/${pages.length}…`);
        const blob = await capturePage(pages[i]);
        downloadBlob(blob, `page-${i + 1}.png`);
        if (i < pages.length - 1) await sleep(350);
    }
}

async function exportZip() {
    const pages = getPages();
    const zip = new JSZip();
    const folder = zip.folder('pages');
    for (let i = 0; i < pages.length; i++) {
        setBusy(`⏳ Zipping page ${i + 1}/${pages.length}…`);
        const blob = await capturePage(pages[i]);
        folder.file(`page-${i + 1}.png`, blob);
    }
    setBusy('⏳ Building zip…');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `design-pages-${Date.now()}.zip`);
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
    });
}

async function exportPdf() {
    const { width, height } = getCanvasSize();
    const pages = getPages();
    const orientation = width >= height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'pt', format: [width, height] });
    for (let i = 0; i < pages.length; i++) {
        setBusy(`⏳ Building PDF page ${i + 1}/${pages.length}…`);
        const dataUrl = await blobToDataUrl(await capturePage(pages[i]));
        if (i > 0) pdf.addPage([width, height], orientation);
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    }
    pdf.save(`design-${Date.now()}.pdf`);
}

async function runExport(action) {
    if (busy) return;
    setMenuOpen(false);
    setBusy('⏳ Exporting…');
    try {
        switch (action) {
            case 'current': await exportCurrent(); break;
            case 'all': await exportAllImages(); break;
            case 'zip': await exportZip(); break;
            case 'pdf': await exportPdf(); break;
        }
    } catch (err) {
        console.error('Export failed:', err);
        alert('Export failed: ' + err.message);
    } finally {
        busy = false;
        dom.exportBtn.disabled = false;
        dom.exportBtn.textContent = BASE_LABEL;
    }
}

/** Wire the Export dropdown. Call once on startup. */
export function initExport() {
    dom.exportBtn.addEventListener('click', e => {
        e.stopPropagation();
        setMenuOpen(dom.exportMenu.style.display !== 'flex');
    });
    dom.exportMenuItems.forEach(item => {
        item.addEventListener('click', () => runExport(item.dataset.action));
    });
    // Click anywhere outside the dropdown closes it.
    document.addEventListener('click', e => {
        if (!dom.exportDropdown.contains(e.target)) setMenuOpen(false);
    });
    // Escape also closes it.
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && dom.exportMenu.style.display === 'flex') setMenuOpen(false);
    });
}
