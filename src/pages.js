// Multi-canvas (pages) support. A page track under the canvas shows every
// page as a numbered thumbnail — click one to navigate, use the track buttons
// to add, clone (with contents) or delete a page. Dragging an element onto a
// thumbnail moves it to that page (see interactions.js).
//
// Pages live in state.pages; this module owns the track DOM and the page
// lifecycle operations (all undoable via history).

import { emit, on } from './bus.js';
import { buildElementDiv } from './canvas.js';
import { transformCss } from './constants.js';
import { dom } from './dom.js';
import { record } from './history.js';
import { deselectAll } from './selection.js';
import {
    getActivePage,
    getActivePageId,
    getCanvasHeight,
    getCanvasWidth,
    getPages,
    setActivePageId,
} from './state.js';
import { generateId } from './utils.js';

/** Fixed width of a page thumbnail; height follows the canvas aspect ratio. */
const THUMB_WIDTH = 120;

/** Live thumbnail nodes, re-collected on every track render. */
let thumbs = [];

function nextPageId() {
    return 'pg_' + Date.now() + Math.random().toString(36).slice(2, 7);
}

/** Create a fresh empty page model. */
export function createPage(bgColor = '#ffffff') {
    return { id: nextPageId(), elements: [], bgColor };
}

/** Insert a new empty page after the active one and switch to it. */
export function addPage() {
    record();
    const page = createPage();
    const pages = getPages();
    const idx = Math.max(0, pages.findIndex(p => p.id === getActivePageId()));
    pages.splice(idx + 1, 0, page);
    setActivePageId(page.id);
    deselectAll();
    emit('render');
}

/** Duplicate the active page (deep-copied elements) right after it. */
export function cloneActivePage() {
    const src = getActivePage();
    if (!src) return;
    record();
    const clone = {
        id: nextPageId(),
        elements: src.elements.map(el => ({ ...structuredClone(el), id: generateId() })),
        bgColor: src.bgColor,
    };
    const pages = getPages();
    const idx = pages.findIndex(p => p.id === src.id);
    pages.splice(idx + 1, 0, clone);
    setActivePageId(clone.id);
    deselectAll();
    emit('render');
}

/** Delete the active page (never the last one) and switch to a neighbour. */
export function deleteActivePage() {
    const pages = getPages();
    if (pages.length <= 1) return;
    record();
    const idx = pages.findIndex(p => p.id === getActivePageId());
    pages.splice(idx, 1);
    setActivePageId(pages[Math.min(idx, pages.length - 1)].id);
    deselectAll();
    emit('render');
}

/** Navigate to a specific page by id. */
export function switchPage(id) {
    if (id === getActivePageId()) return;
    setActivePageId(id);
    deselectAll();
    emit('render');
}

/** Rebuild the whole page track from state.pages. */
function renderTrack() {
    const canvasW = getCanvasWidth(), canvasH = getCanvasHeight();
    const scale = Math.min(1, THUMB_WIDTH / Math.max(1, canvasW));
    const w = canvasW * scale, h = canvasH * scale;
    thumbs = [];
    dom.pageThumbs.innerHTML = '';
    const pages = getPages();
    pages.forEach((page, idx) => {
        const thumb = document.createElement('div');
        thumb.className = 'page-thumb' + (page.id === getActivePageId() ? ' active' : '');
        thumb.dataset.pageId = page.id;
        thumb.title = `Page ${idx + 1}`;

        const canvas = document.createElement('div');
        canvas.className = 'page-thumb-canvas';
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.style.backgroundColor = page.bgColor;
        page.elements.forEach(el => {
            const d = buildElementDiv(el, { scale });
            d.classList.add('thumb-el');
            canvas.appendChild(d);
        });

        const num = document.createElement('span');
        num.className = 'page-thumb-num';
        num.textContent = idx + 1;

        // Content badge: which element types live on this page, and how many.
        const meta = document.createElement('div');
        meta.className = 'page-thumb-meta';
        let textCount = 0, imageCount = 0;
        page.elements.forEach(el => { if (el.type === 'text') textCount++; else imageCount++; });
        const parts = [];
        if (textCount) parts.push(`🔤${textCount > 1 ? '×' + textCount : ''}`);
        if (imageCount) parts.push(`🖼️${imageCount > 1 ? '×' + imageCount : ''}`);
        meta.textContent = parts.length ? parts.join('  ') : 'Empty';
        meta.title = textCount + imageCount
            ? `Contents: ${textCount} text, ${imageCount} image`
            : 'This page has no elements yet';

        thumb.appendChild(num);
        thumb.appendChild(canvas);
        thumb.appendChild(meta);
        thumb.addEventListener('click', () => switchPage(page.id));
        dom.pageThumbs.appendChild(thumb);
        thumbs.push({ id: page.id, node: thumb });
    });
    if (dom.deletePageBtn) dom.deletePageBtn.disabled = pages.length <= 1;
}

/**
 * Live-update the active page's thumbnail in place while its elements move,
 * resize, rotate or are typed into. No node churn here, so the drop-target
 * highlight (and hover state) survives mid-drag refreshes; structural
 * changes still go through the full renderTrack rebuild.
 */
function updateActiveThumbLive() {
    const page = getActivePage();
    if (!page) return;
    const canvasW = getCanvasWidth(), canvasH = getCanvasHeight();
    const scale = Math.min(1, THUMB_WIDTH / Math.max(1, canvasW));
    const thumb = dom.pageThumbs.querySelector(`.page-thumb[data-page-id="${page.id}"]`);
    if (!thumb) return;
    const canvas = thumb.querySelector('.page-thumb-canvas');
    if (!canvas) return;
    page.elements.forEach(el => {
        const wrap = canvas.querySelector(`.thumb-el[data-id="${el.id}"]`);
        if (!wrap) return;
        wrap.style.left = (el.x * scale) + 'px';
        wrap.style.top = (el.y * scale) + 'px';
        wrap.style.width = (el.width * scale) + 'px';
        wrap.style.height = (el.height * scale) + 'px';
        const inner = wrap.querySelector('.element');
        if (!inner) return;
        inner.style.transform = `scale(${scale}) ${transformCss(el)}`;
        if (el.type === 'text') inner.textContent = el.content;
    });
}

/** The id of the page thumbnail under a client (x, y) point, or null. */
export function getThumbPageIdAt(x, y) {
    for (const t of thumbs) {
        const r = t.node.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return t.id;
    }
    return null;
}

/** Highlight the thumbnail a dragged element would land on (null clears). */
export function setDropHighlight(id) {
    thumbs.forEach(t => t.node.classList.toggle('drop-target', t.id === id));
}

/** Wire the track UI. Call once on startup. */
export function initPages() {
    if (!getPages().length) {
        const page = createPage();
        getPages().push(page);
        setActivePageId(page.id);
    }
    on('render', renderTrack);
    // Live thumbnails: while an element is dragged/resized/rotated or text is
    // typed, the active page's contents change without a full 'render' — so
    // update the active thumbnail in place on those events.
    on('transform', updateActiveThumbLive);
    on('text-edited', updateActiveThumbLive);
    dom.addPageBtn.addEventListener('click', addPage);
    dom.clonePageBtn.addEventListener('click', cloneActivePage);
    dom.deletePageBtn.addEventListener('click', deleteActivePage);
    renderTrack();
}
