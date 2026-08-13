// Selection operations. They update state and broadcast a 'selection' event;
// the canvas (selection chrome) and properties panel both react to it.
//
// Selection supports multiple elements: selectElement() picks exactly one,
// toggleSelectElement() flips membership (Ctrl+click), deselectAll() clears.

import { emit } from './bus.js';
import { getSelectedIds, setSelectedIds } from './state.js';

export function selectElement(id) {
    setSelectedIds([id]);
    emit('selection');
}

/** Ctrl+click: add/remove `id` from the current multi-selection. */
export function toggleSelectElement(id) {
    const ids = getSelectedIds();
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    setSelectedIds(next);
    emit('selection');
}

export function deselectAll() {
    if (!getSelectedIds().length) return;
    setSelectedIds([]);
    emit('selection');
}
