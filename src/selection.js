// Selection operations. They update state and broadcast a 'selection' event;
// the canvas (selection chrome) and properties panel both react to it.

import { emit } from './bus.js';
import { getSelectedElementId, setSelectedElementId } from './state.js';

export function selectElement(id) {
    if (getSelectedElementId() === id) return;
    setSelectedElementId(id);
    emit('selection');
}

export function deselectAll() {
    if (!getSelectedElementId()) return;
    setSelectedElementId(null);
    emit('selection');
}
