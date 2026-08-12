// Export the design canvas as a high-resolution PNG download using
// `html-to-image` (SVG foreignObject rendering).

import { toBlob } from 'html-to-image';
import { dom } from './dom.js';
import { EXPORT_PIXEL_RATIO } from './constants.js';
import { getCanvasSize } from './state.js';

/** Wire the Export button. Call once on startup. */
export function initExport() {
    dom.exportBtn.addEventListener('click', async () => {
        const { width, height } = getCanvasSize();
        const { designCanvas, exportBtn } = dom;
        const originalLabel = exportBtn.textContent;
        exportBtn.disabled = true;
        exportBtn.textContent = '⏳ Exporting…';

        // Drop any in-canvas focus (caret / text selection) and add a class
        // that hides every piece of selection chrome — outline, side lines,
        // resize handles, ::selection colors — for all element types. The
        // class rides along on the cloned node html-to-image renders, and
        // transitions are suppressed so the 0.15s box-shadow animation can't
        // leak its mid-transition glow into the capture.
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
            downloadBlob(blob, `design-${Date.now()}.png`);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed: ' + err.message);
        } finally {
            designCanvas.classList.remove('exporting');
            exportBtn.disabled = false;
            exportBtn.textContent = originalLabel;
        }
    });
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
