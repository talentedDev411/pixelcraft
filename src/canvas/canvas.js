// Everything that reads/writes the canvas DOM: sizing, full re-render,
// selection chrome, and live model→DOM updates.

import { emit, on } from '@/core/bus.js';
import { dom } from '@/core/dom.js';
import { ASPECT_RATIOS, paddingCss, radiusCss, transformCss } from '@/core/constants.js';
import { inGesture, record } from '@/history/history.js';
import { isSelectMode } from '@/selection/selectmode.js';
import {
    getActivePage,
    getAspectRatio,
    getCanvasHeight,
    getCanvasWidth,
    getElements,
    getSelectedElementId,
    getSelectedIds,
    isSelected,
    setCanvasSize,
} from '@/core/state.js';
import { findElementById } from '@/core/utils.js';
import { groupSelected, ungroupSelected, toggleLockSelected, duplicateElement, deleteSelectedElements } from '@/elements/elements.js';
import { deselectAll } from '@/selection/selection.js';

/** Recompute canvas pixel size from the selected aspect ratio and viewport. */
export function updateCanvasSize() {
    const { canvasArea, canvasWrapper } = dom;
    const ratio = ASPECT_RATIOS[getAspectRatio()];
    const maxW = Math.min(canvasArea.clientWidth - 60, 600);
    // Reserve room for the page track below the canvas.
    const trackH = dom.pageTrack ? dom.pageTrack.offsetHeight : 0;
    const maxH = canvasArea.clientHeight - 60 - trackH;
    let w, h;
    if (ratio[0] / ratio[1] > maxW / maxH) {
        w = maxW;
        h = w * (ratio[1] / ratio[0]);
    } else {
        h = maxH;
        w = h * (ratio[0] / ratio[1]);
    }
    setCanvasSize(w, h);
    canvasWrapper.style.width = w + 'px';
    canvasWrapper.style.height = h + 'px';
}

/**
 * Build a DOM node for one element model. Shared by the canvas and the page
 * track thumbnails (scale < 1).
 *
 * For thumbnails the node is wrapped in a box whose left/top/width/height are
 * scaled to the thumb's pixel size, and the inner element is shrunk with a
 * CSS scale around its top-left corner — so an element lands exactly where it
 * sits on the real canvas instead of being clipped by the thumb's bounds.
 */
export function buildElementDiv(el, { selected = false, scale = 1 } = {}) {
    const div = document.createElement('div');
    div.className = `element ${el.type}-element`;
    if (selected) div.classList.add('selected');
    div.style.left = el.x + 'px';
    div.style.top = el.y + 'px';
    div.style.width = el.width + 'px';
    div.style.height = el.height + 'px';
    div.dataset.id = el.id;

    if (el.type === 'text') {
        div.textContent = el.content;
        div.style.fontSize = el.fontSize + 'px';
        div.style.fontWeight = el.fontWeight || '400';
        div.style.fontFamily = `'${el.fontFamily}', sans-serif`;
        // Gradient text color: background-clip + text-fill
        if (el.textGradient) {
            div.style.backgroundImage = el.textGradient;
            div.style.backgroundClip = 'text';
            div.style.webkitBackgroundClip = 'text';
            div.style.webkitTextFillColor = 'transparent';
            div.style.color = 'transparent';
        } else {
            div.style.color = el.color;
        }
        // Element background: gradient or solid color (only when no text gradient)
        if (!el.textGradient && el.bgGradient) {
            div.style.backgroundImage = el.bgGradient;
            div.style.backgroundClip = 'border-box';
            div.style.webkitBackgroundClip = 'border-box';
            div.style.backgroundColor = '';
        } else if (!el.textGradient) {
            div.style.backgroundImage = 'none';
            div.style.backgroundColor = el.bgColor === 'transparent' ? 'transparent' : el.bgColor;
        }
        div.style.textShadow = el.textShadow;
        div.style.borderRadius = radiusCss(el);
        div.style.padding = paddingCss(el);
        div.style.transform = transformCss(el);
    } else if (el.type === 'image' || el.type === 'svg') {
        const img = document.createElement('img');
        img.src = el.type === 'svg' ? recolorSvg(el) : el.src;
        img.draggable = false;
        img.style.objectFit = el.fitMode || 'fill';
        div.appendChild(img);
        // Ghost layer for SVG elements
        if (el.type === 'svg' && (el.ghostOpacity || 0) > 0) {
            const ghost = document.createElement('div');
            ghost.className = 'svg-ghost-layer';
            ghost.style.opacity = el.ghostOpacity;
            ghost.style.transform = `translate(${el.ghostOffsetX || 0}px, ${el.ghostOffsetY || 0}px)`;
            const ghostImg = document.createElement('img');
            ghostImg.src = recolorSvg(el, { blurX: el.ghostBlurX, blurY: el.ghostBlurY });
            ghostImg.draggable = false;
            ghostImg.style.objectFit = el.fitMode || 'fill';
            ghost.appendChild(ghostImg);
            div.appendChild(ghost);
        }
        div.style.transform = transformCss(el);
    } else if (el.type === 'container') {
        // Imported HTML containers are visual canvas elements too. Keeping this
        // separate from their grouping metadata lets a div retain its CSS box.
        div.style.background = el.bgGradient || el.bgColor || 'transparent';
        div.style.border = el.border || 'none';
        div.style.borderRadius = radiusCss(el);
        div.style.boxShadow = el.boxShadow || 'none';
        div.style.opacity = el.opacity ?? '1';
        div.style.pointerEvents = 'auto';
        div.style.transform = transformCss(el);
    }
    if (scale !== 1) {
        // Thumbnail mode: a wrapper pinned to the scaled canvas position.
        const wrap = document.createElement('div');
        wrap.className = 'thumb-el';
        wrap.dataset.id = el.id;
        wrap.style.left = (el.x * scale) + 'px';
        wrap.style.top = (el.y * scale) + 'px';
        wrap.style.width = (el.width * scale) + 'px';
        wrap.style.height = (el.height * scale) + 'px';
        div.style.position = 'absolute';
        div.style.left = '0';
        div.style.top = '0';
        div.style.transformOrigin = '0 0';
        div.style.transform = `scale(${scale}) ${transformCss(el)}`;
        wrap.appendChild(div);
        return wrap;
    }
    return div;
}

/** Rebuild every element in the canvas DOM from the current model. */
export function fullRender() {
    const { designCanvas } = dom;
    designCanvas.innerHTML = '';
    // The canvas paints the active page's background, and the toolbox swatch
    // follows it (also after undo/redo restores a different background).
    const page = getActivePage();
    const bg = page ? page.bgColor : '#ffffff';
    const bgGrad = page ? page.bgGradient : null;
    designCanvas.style.background = bgGrad || bg;
    if (dom.bgColorInput) dom.bgColorInput.value = bg;

    getElements().forEach(el => {
        designCanvas.appendChild(buildElementDiv(el, { selected: isSelected(el.id) }));
    });
    if (getSelectedIds().length) applySelectionToDOM(getSelectedIds());
}

/**
 * Reflect the current selection in the DOM. Every selected element gets the
 * outline; only the primary (first) element gets the resize/rotate handles
 * and — for text — the contenteditable caret.
 */
export function applySelectionToDOM(ids) {
    const { designCanvas } = dom;
    const list = Array.isArray(ids) ? ids : (ids ? [ids] : []);
    const primary = list[0] || null;

    // Clear previous chrome: outline, edit mode, handles.
    designCanvas.querySelectorAll('.element.selected').forEach(elDiv => {
        elDiv.classList.remove('selected');
        if (elDiv.classList.contains('text-element')) {
            elDiv.setAttribute('contenteditable', 'false');
        }
        elDiv.querySelectorAll('.resize-handle, .rotate-handle').forEach(h => h.remove());
    });

    list.forEach(id => {
        const elDiv = designCanvas.querySelector(`[data-id="${id}"]`);
        if (!elDiv) return;
        elDiv.classList.add('selected');
        const el = findElementById(getElements(), id);
        if (!el || id !== primary) return;
        // Primary only: editable text + drag handles.
        if (el.type === 'text') {
            elDiv.setAttribute('contenteditable', 'true');
            addResizeHandles(elDiv);
            addRotateHandle(elDiv);
            // In select mode a tap must never summon the keyboard — the
            // mobile user is picking elements, not editing text.
            if (document.activeElement !== elDiv && !isSelectMode()) {
                elDiv.focus();
                const range = document.createRange();
                range.selectNodeContents(elDiv);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        } else if (el.type === 'image' || el.type === 'svg') {
            addResizeHandles(elDiv);
            addRotateHandle(elDiv);
        }
        // Lock icon overlay
        if (el.locked) {
            let lockBadge = elDiv.querySelector('.fab-locked-overlay');
            if (!lockBadge) {
                lockBadge = document.createElement('span');
                lockBadge.className = 'fab-locked-overlay';
                lockBadge.textContent = '🔒';
                elDiv.appendChild(lockBadge);
            }
        }
        // Group badge
        if (el.groupId) {
            let groupBadge = elDiv.querySelector('.fab-group-badge');
            if (!groupBadge) {
                groupBadge = document.createElement('span');
                groupBadge.className = 'fab-group-badge';
                groupBadge.textContent = 'GRP';
                elDiv.appendChild(groupBadge);
            }
        }
    });

    positionFab();
}

/**
 * Position the floating action button above the primary selected element.
 * Called from applySelectionToDOM and during drag/resize/rotate in interactions.
 */
export function positionFab() {
    const { designCanvas, elementFab, fabMenu } = dom;
    const ids = getSelectedIds();
    const primary = ids[0] || null;
    if (!primary) {
        elementFab.style.display = 'none';
        fabMenu.style.display = 'none';
        return;
    }
    const el = findElementById(getElements(), primary);
    const elDiv = designCanvas.querySelector(`[data-id="${primary}"]`);
    if (!el || !elDiv) {
        elementFab.style.display = 'none';
        fabMenu.style.display = 'none';
        return;
    }
    elementFab.style.left = (el.x + el.width / 2 - 14) + 'px';
    elementFab.style.top = (el.y - 36) + 'px';
    elementFab.style.display = 'block';
    // Update menu item enabled/disabled states
    const lockBtn = fabMenu.querySelector('[data-action="lock"]');
    const unlockBtn = fabMenu.querySelector('[data-action="unlock"]');
    if (el.locked) {
        lockBtn.classList.add('disabled');
        unlockBtn.classList.remove('disabled');
    } else {
        lockBtn.classList.remove('disabled');
        unlockBtn.classList.add('disabled');
    }
    const groupBtn = fabMenu.querySelector('[data-action="group"]');
    const ungroupBtn = fabMenu.querySelector('[data-action="ungroup"]');
    if (ids.length >= 2 && !el.groupId) {
        groupBtn.classList.remove('disabled');
    } else {
        groupBtn.classList.add('disabled');
    }
    if (el.groupId) {
        ungroupBtn.classList.remove('disabled');
    } else {
        ungroupBtn.classList.add('disabled');
    }
}

/** Live-editing: update the model and apply changes to the existing DOM node. */
export function updateElementModelAndDOM(id, updates, clampToCanvas = false) {
    const el = findElementById(getElements(), id);
    if (!el) return;
    // Record the pre-change state as an undo point (skipped while a drag /
    // resize / rotate gesture is running — that records once at start).
    if (!inGesture()) record();
    // Keep the model in sync — the DOM must never be ahead of the state,
    // or a later fullRender would silently revert live edits.
    if (updates.x !== undefined) el.x = updates.x;
    if (updates.y !== undefined) el.y = updates.y;
    if (updates.width !== undefined) el.width = updates.width;
    if (updates.height !== undefined) el.height = updates.height;
    if (updates.fitMode !== undefined) el.fitMode = updates.fitMode;
    if (updates.content !== undefined) el.content = updates.content;
    if (updates.fontSize !== undefined) el.fontSize = updates.fontSize;
    if (updates.fontWeight !== undefined) el.fontWeight = updates.fontWeight;
    if (updates.color !== undefined) el.color = updates.color;
    if (updates.bgColor !== undefined) el.bgColor = updates.bgColor;
    if (updates.textShadow !== undefined) el.textShadow = updates.textShadow;
    if (updates.textGradient !== undefined) el.textGradient = updates.textGradient;
    if (updates.bgGradient !== undefined) el.bgGradient = updates.bgGradient;
    if (updates.fontFamily !== undefined) el.fontFamily = updates.fontFamily;
    if (updates.rotation !== undefined) el.rotation = updates.rotation;
    if (updates.skewX !== undefined) el.skewX = updates.skewX;
    if (updates.skewY !== undefined) el.skewY = updates.skewY;
    if (updates.padding !== undefined) {
        // Padding can be a single number (legacy) or a partial {top,right,bottom,left}.
        el.padding = typeof updates.padding === 'object'
            ? { ...(typeof el.padding === 'object' ? el.padding : {}), ...updates.padding }
            : updates.padding;
    }
    if (updates.borderRadius !== undefined) el.borderRadius = { ...(el.borderRadius || {}), ...updates.borderRadius };
    if (updates.src !== undefined) el.src = updates.src;
    if (updates.fillColor !== undefined) el.fillColor = updates.fillColor;
    if (updates.strokeWidth !== undefined) el.strokeWidth = updates.strokeWidth;
    if (updates.blurX !== undefined) el.blurX = updates.blurX;
    if (updates.blurY !== undefined) el.blurY = updates.blurY;
    if (updates.ghostBlurX !== undefined) el.ghostBlurX = updates.ghostBlurX;
    if (updates.ghostBlurY !== undefined) el.ghostBlurY = updates.ghostBlurY;
    if (updates.ghostOffsetX !== undefined) el.ghostOffsetX = updates.ghostOffsetX;
    if (updates.ghostOffsetY !== undefined) el.ghostOffsetY = updates.ghostOffsetY;
    if (updates.ghostOpacity !== undefined) el.ghostOpacity = updates.ghostOpacity;
    if (updates.gradientStops !== undefined) el.gradientStops = updates.gradientStops;
    if (updates.gradientType !== undefined) el.gradientType = updates.gradientType;
    if (updates.gradientColor !== undefined) el.gradientColor = updates.gradientColor;
    if (updates.gradientAngle !== undefined) el.gradientAngle = updates.gradientAngle;
    if (updates.gradientOpacity !== undefined) el.gradientOpacity = updates.gradientOpacity;
    if (clampToCanvas) {
        if (el.x < 0) { el.width += el.x; el.x = 0; }
        if (el.y < 0) { el.height += el.y; el.y = 0; }
        if (el.x + el.width > getCanvasWidth()) el.width = getCanvasWidth() - el.x;
        if (el.y + el.height > getCanvasHeight()) el.height = getCanvasHeight() - el.y;
        el.width = Math.max(20, el.width);
        el.height = Math.max(20, el.height);
    }
    const domEl = dom.designCanvas.querySelector(`[data-id="${id}"]`);
    if (!domEl) return;
    domEl.style.left = el.x + 'px';
    domEl.style.top = el.y + 'px';
    domEl.style.width = el.width + 'px';
    domEl.style.height = el.height + 'px';
    if (el.type === 'text') {
        if (updates.content !== undefined) domEl.textContent = updates.content;
        if (updates.fontSize !== undefined) domEl.style.fontSize = updates.fontSize + 'px';
        if (updates.fontWeight !== undefined) domEl.style.fontWeight = updates.fontWeight;
        if (updates.color !== undefined) domEl.style.color = updates.color;
        if (updates.bgColor !== undefined) domEl.style.backgroundColor = updates.bgColor === 'transparent' ? 'transparent' : updates.bgColor;
        if (updates.textGradient !== undefined) {
            if (updates.textGradient) {
                domEl.style.backgroundImage = updates.textGradient;
                domEl.style.backgroundClip = 'text';
                domEl.style.webkitBackgroundClip = 'text';
                domEl.style.webkitTextFillColor = 'transparent';
            } else {
                domEl.style.backgroundImage = 'none';
                domEl.style.backgroundClip = '';
                domEl.style.webkitBackgroundClip = '';
                domEl.style.webkitTextFillColor = '';
                domEl.style.color = el.color;
            }
        }
        if (updates.bgGradient !== undefined) {
            if (updates.bgGradient) {
                domEl.style.backgroundImage = updates.bgGradient;
                domEl.style.backgroundColor = '';
            } else {
                domEl.style.backgroundImage = 'none';
                domEl.style.backgroundColor = el.bgColor === 'transparent' ? 'transparent' : el.bgColor;
            }
        }
        if (updates.textShadow !== undefined) domEl.style.textShadow = updates.textShadow;
        if (updates.fontFamily !== undefined) domEl.style.fontFamily = `'${updates.fontFamily}', sans-serif`;
        if (updates.padding !== undefined) domEl.style.padding = paddingCss(el);
        if (updates.borderRadius !== undefined) domEl.style.borderRadius = radiusCss(el);
    } else if (el.type === 'image' || el.type === 'svg') {
        const svgChanged = updates.src !== undefined || updates.fillColor !== undefined ||
            updates.strokeWidth !== undefined || updates.gradientStops !== undefined ||
            updates.gradientType !== undefined || updates.gradientColor !== undefined ||
            updates.gradientAngle !== undefined || updates.gradientOpacity !== undefined;
        const blurChanged = updates.blurX !== undefined || updates.blurY !== undefined;
        const ghostChanged = updates.ghostBlurX !== undefined || updates.ghostBlurY !== undefined ||
            updates.ghostOffsetX !== undefined || updates.ghostOffsetY !== undefined ||
            updates.ghostOpacity !== undefined;

        // Re-render main SVG image (fill, stroke, gradient, blur all baked into data URL)
        if (svgChanged || blurChanged) {
            const img = domEl.querySelector(':scope > img');
            if (img) img.src = recolorSvg(el);
        }
        // Ghost layer
        if (ghostChanged || svgChanged || blurChanged) {
            const ghostLayer = domEl.querySelector('.svg-ghost-layer');
            const opacity = el.ghostOpacity || 0;
            if (opacity > 0) {
                if (ghostLayer) {
                    ghostLayer.style.opacity = opacity;
                    ghostLayer.style.transform = `translate(${el.ghostOffsetX || 0}px, ${el.ghostOffsetY || 0}px)`;
                    const gi = ghostLayer.querySelector('img');
                    if (gi) gi.src = recolorSvg(el, { blurX: el.ghostBlurX, blurY: el.ghostBlurY });
                } else {
                    const ghost = document.createElement('div');
                    ghost.className = 'svg-ghost-layer';
                    ghost.style.opacity = opacity;
                    ghost.style.transform = `translate(${el.ghostOffsetX || 0}px, ${el.ghostOffsetY || 0}px)`;
                    const ghostImg = document.createElement('img');
                    ghostImg.src = recolorSvg(el, { blurX: el.ghostBlurX, blurY: el.ghostBlurY });
                    ghostImg.draggable = false;
                    ghostImg.style.objectFit = el.fitMode || 'fill';
                    ghost.appendChild(ghostImg);
                    domEl.appendChild(ghost);
                }
            } else if (ghostLayer) {
                ghostLayer.remove();
            }
        }
        if (updates.fitMode !== undefined) {
            const img = domEl.querySelector(':scope > img');
            if (img) img.style.objectFit = updates.fitMode;
            const gi = domEl.querySelector('.svg-ghost-layer img');
            if (gi) gi.style.objectFit = updates.fitMode;
        }
    }
    if (updates.rotation !== undefined || updates.skewX !== undefined || updates.skewY !== undefined) {
        domEl.style.transform = transformCss(el);
    }
}

/**
 * Resolve gradient stops from the element model.
 * Supports both the new gradientStops array and legacy 2-color gradientColor.
 * Returns an array of { color, position, opacity } objects, or [] if no gradient.
 */
function resolveGradientStops(el) {
    // New multi-stop model
    if (el.gradientStops && el.gradientStops.length > 0) {
        return el.gradientStops.map(s => ({
            color: s.color,
            position: s.position,
            opacity: s.opacity ?? 1,
        }));
    }
    // Legacy 2-color model
    if (el.gradientColor) {
        const opacity = (el.gradientOpacity ?? 100) / 100;
        return [
            { color: el.fillColor || '#231f20', position: 0, opacity: 1 },
            { color: el.gradientColor, position: 100, opacity },
        ];
    }
    return [];
}

/**
 * Take an SVG element model and return a transformed data URL.
 * Handles: fill color replacement (all formats), gradient injection,
 * stroke-width + stroke color, and SVG-based blur filters (separate X/Y).
 * For the ghost layer, pass { blurX, blurY } to override the element's blur.
 */
function recolorSvg(el, ghostBlur) {
    if (!el.src) return el.src;

    const fillColor = el.fillColor || '#231f20';
    const bx = ghostBlur ? (ghostBlur.blurX || 0) : (el.blurX || 0);
    const by = ghostBlur ? (ghostBlur.blurY || 0) : (el.blurY || 0);
    const hasFill = fillColor !== '#231f20';
    const hasStroke = (el.strokeWidth || 0) > 0;
    // Resolve gradient stops: use gradientStops array if available,
    // else fall back to legacy 2-color gradientColor model
    const stops = resolveGradientStops(el);
    const hasGradient = stops.length > 0;
    const hasBlur = bx > 0 || by > 0;

    if (!hasFill && !hasStroke && !hasGradient && !hasBlur) return el.src;

    try {
        let svg = decodeURIComponent(el.src.split(',')[1]);

        // Strip XML declarations
        svg = svg.replace(/<\?xml[^?]*\?>\s*/g, '');

        // ── Fill replacement (all formats) ──
        if (hasFill || hasGradient) {
            // Style blocks: fill:#hex  or  fill: #hex
            svg = svg.replace(/fill:\s*#[0-9a-fA-F]{3,8}/g, 'fill:' + fillColor);
            // Inline fill attributes: fill="#hex" or fill="color(...)" or fill="rgb(...)"
            svg = svg.replace(/fill="([^"]*)"/g, (m, val) => {
                if (val === 'none' || val.startsWith('url(')) return m;
                return 'fill="' + fillColor + '"';
            });
        }

        // ── Gradient injection (N stops) ──
        if (hasGradient) {
            const gType = el.gradientType || 'linear';
            const angle = el.gradientAngle || 0;
            let gradDef = '';

            if (gType === 'radial') {
                gradDef = '<radialGradient id="ebGrad" cx="50%" cy="50%" r="50%">' +
                    stops.map(s => '<stop offset="' + s.position + '%" stop-color="' + s.color + '" stop-opacity="' + s.opacity.toFixed(2) + '"/>').join('') +
                    '</radialGradient>';
            } else {
                // linear (conic falls back to linear since SVG has no conicGradient)
                // linear: convert angle to x1,y1,x2,y2
                const rad = (angle - 90) * Math.PI / 180;
                const x1 = (0.5 + 0.5 * Math.cos(rad + Math.PI)).toFixed(3);
                const y1 = (0.5 + 0.5 * Math.sin(rad + Math.PI)).toFixed(3);
                const x2 = (0.5 + 0.5 * Math.cos(rad)).toFixed(3);
                const y2 = (0.5 + 0.5 * Math.sin(rad)).toFixed(3);
                gradDef = '<linearGradient id="ebGrad" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' +
                    stops.map(s => '<stop offset="' + s.position + '%" stop-color="' + s.color + '" stop-opacity="' + s.opacity.toFixed(2) + '"/>').join('') +
                    '</linearGradient>';
            }

            // Inject into existing <defs> or create one
            if (/<defs[\s>]/.test(svg)) {
                svg = svg.replace(/<defs[\s>]/, '<defs>' + gradDef);
            } else {
                svg = svg.replace(/(<svg[^>]*>)/, '$1<defs>' + gradDef + '</defs>');
            }

            // Replace fills on shape elements with gradient reference
            svg = svg.replace(/(<(?:path|circle|rect|line|polygon|polyline|text|use)[^>]*?)fill="[^"]*"/g, '$1fill="url(#ebGrad)"');
        }

        // ── Stroke injection (stroke-width + stroke color) ──
        if (hasStroke) {
            svg = svg.replace(/(<(?:path|circle|rect|line|polygon|polyline)[^>]*?)(\/??>)/g, (m, pre, close) => {
                let r = pre;
                if (!/stroke-width/.test(r)) r += ' stroke-width="' + el.strokeWidth + '"';
                if (!/stroke="/.test(r)) r += ' stroke="' + fillColor + '"';
                return r + close;
            });
        }

        // ── Blur filter injection (SVG feGaussianBlur for separate X/Y) ──
        if (hasBlur) {
            const filterDef = '<filter id="ebBlur"><feGaussianBlur stdDeviation="' + bx + ' ' + by + '"/></filter>';

            if (/<defs[\s>]/.test(svg)) {
                svg = svg.replace(/<defs[\s>]/, '<defs>' + filterDef);
            } else {
                svg = svg.replace(/(<svg[^>]*>)/, '$1<defs>' + filterDef + '</defs>');
            }

            // Apply filter to all shape elements
            svg = svg.replace(/(<(?:path|circle|rect|line|polygon|polyline|text|use)[^>]*?)(\/??>)/g, (m, pre, close) => {
                if (/filter=/.test(pre)) return m;
                return pre + ' filter="url(#ebBlur)"' + close;
            });
        }

        return 'data:image/svg+xml,' + encodeURIComponent(svg);
    } catch (_) {
        return el.src;
    }
}

/** Bootstrap: subscribe to domain events and wire the canvas event delegation. */
export function initCanvas() {
    on('render', fullRender);
    on('selection', () => applySelectionToDOM(getSelectedIds()));

    // Live text editing happens directly in the canvas (contenteditable).
    // Delegated listener keeps the model in sync without a full re-render,
    // which would steal focus and break the cursor position.
    dom.designCanvas.addEventListener('input', e => {
        const div = e.target.closest('.text-element');
        if (!div) return;
        const el = findElementById(getElements(), div.dataset.id);
        if (!el) return;
        record();
        el.content = div.textContent;
        emit('text-edited', el.content);
    });

    // ── FAB: floating action button above selected element ──
    dom.fabMenuBtn.addEventListener('click', e => {
        e.stopPropagation();
        const menu = dom.fabMenu;
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });

    // Close FAB menu on outside click
    document.addEventListener('click', e => {
        if (!dom.elementFab.contains(e.target)) {
            dom.fabMenu.style.display = 'none';
        }
    });

    dom.fabMenu.addEventListener('click', e => {
        const item = e.target.closest('.fab-menu-item');
        if (!item) return;
        const action = item.dataset.action;
        switch (action) {
            case 'group': groupSelected(); break;
            case 'ungroup': ungroupSelected(); break;
            case 'lock': toggleLockSelected(); break;
            case 'unlock': toggleLockSelected(); break;
            case 'duplicate': {
                const id = getSelectedElementId();
                if (id) duplicateElement(id);
                break;
            }
            case 'delete':
                deleteSelectedElements();
                break;
        }
        dom.fabMenu.style.display = 'none';
    });
}

/** Attach the 8 resize handles to a selected element's DOM node. */
function addResizeHandles(parentDiv) {
    ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        handle.dataset.handle = pos;
        handle.contentEditable = 'false';
        parentDiv.appendChild(handle);
    });
}

/** Attach the rotate handle to a selected element (text or image). */
function addRotateHandle(parentDiv) {
    const handle = document.createElement('div');
    handle.className = 'rotate-handle';
    handle.contentEditable = 'false';
    parentDiv.appendChild(handle);
}
