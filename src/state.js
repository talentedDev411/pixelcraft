// Central application state. UI modules read/write through these accessors
// so the shape of the state can evolve without touching every file.

const state = {
    elements: [],
    selectedElementId: null,
    currentAspectRatio: '1:1',
    canvasWidth: 500,
    canvasHeight: 500,
};

export function getElements() {
    return state.elements;
}

export function setElements(elements) {
    state.elements = elements;
}

export function getSelectedElementId() {
    return state.selectedElementId;
}

export function setSelectedElementId(id) {
    state.selectedElementId = id;
}

/** The currently selected element model, or null. */
export function getSelectedElement() {
    return state.elements.find(el => el.id === state.selectedElementId) || null;
}

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
