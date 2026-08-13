// Central application state. UI modules read/write through these accessors
// so the shape of the state can evolve without touching every file.
//
// The design is multi-page: `pages` holds every canvas as { id, elements,
// bgColor }, and all the element accessors below operate on the *active*
// page. Modules that only care about "the current elements" keep working
// unchanged while pages.js owns navigation and page-level operations.

const state = {
    pages: [],            // [{ id, elements: [], bgColor }]
    activePageId: null,
    selectedElementIds: [],
    currentAspectRatio: '1:1',
    canvasWidth: 500,
    canvasHeight: 500,
};

// ── Pages ──

export function getPages() {
    return state.pages;
}

export function getActivePageId() {
    return state.activePageId;
}

export function setActivePageId(id) {
    state.activePageId = id;
}

/** The active page model ({ id, elements, bgColor }) or null. */
export function getActivePage() {
    return state.pages.find(p => p.id === state.activePageId) || null;
}

export function getPageById(id) {
    return state.pages.find(p => p.id === id) || null;
}

/** Full pages snapshot used by the undo/redo history. */
export function getPagesState() {
    return { pages: state.pages, activePageId: state.activePageId };
}

export function setPagesState(pages, activePageId) {
    state.pages = pages;
    state.activePageId = activePageId;
}

// ── Elements (scoped to the active page) ──

export function getElements() {
    const page = getActivePage();
    return page ? page.elements : [];
}

export function setElements(elements) {
    const page = getActivePage();
    if (page) page.elements = elements;
}

// Selection supports multiple elements (Ctrl+click): the primary selection is
// the first id in `selectedElementIds` and drives the properties panel, the
// resize/rotate handles and drag anchoring; the rest share the outline.

export function getSelectedElementId() {
    return state.selectedElementIds[0] || null;
}

export function setSelectedElementId(id) {
    state.selectedElementIds = id ? [id] : [];
}

/** All currently selected element ids (primary first). */
export function getSelectedIds() {
    return state.selectedElementIds;
}

export function setSelectedIds(ids) {
    state.selectedElementIds = ids;
}

export function isSelected(id) {
    return state.selectedElementIds.includes(id);
}

/** The currently selected element model (primary), or null. */
export function getSelectedElement() {
    return getElements().find(el => el.id === getSelectedElementId()) || null;
}

// ── Canvas size / aspect ──

export function getAspectRatio() {
    return state.currentAspectRatio;
}

export function setAspectRatio(ratio) {
    state.currentAspectRatio = ratio;
}

export function getCanvasSize() {
    return { width: state.canvasWidth, height: state.canvasHeight };
}

export function getCanvasWidth() {
    return state.canvasWidth;
}

export function getCanvasHeight() {
    return state.canvasHeight;
}

export function setCanvasSize(width, height) {
    state.canvasWidth = width;
    state.canvasHeight = height;
}
