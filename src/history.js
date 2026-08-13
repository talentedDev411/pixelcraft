// Undo/redo history for user actions. Every meaningful mutation records a
// snapshot of the whole document (all pages + their elements); Ctrl+Z /
// Ctrl+Y (or Ctrl+Shift+Z) step through the snapshots like a text field
// steps through its edits.
//
// Snapshots are JSON strings, so dedup (pushing the same state twice in a
// row) is a cheap string compare. Continuous gestures (drag / resize /
// rotate) record once at the start via beginGesture() and skip per-move
// recording, so one drag = one undo step.

import { emit } from './bus.js';
import {
    getElements,
    getPagesState,
    getSelectedIds,
    setPagesState,
    setSelectedIds,
} from './state.js';

/** Maximum number of undo steps kept in memory (each is a JSON snapshot). */
const MAX_HISTORY = 100;

const undoStack = [];
const redoStack = [];

let gesturing = false;

/** Serialize the whole document (pages + active page) for storage. */
function snapshot() {
    return JSON.stringify(getPagesState());
}

/** Restore a snapshot and re-render, keeping the selection valid. */
function restore(snap) {
    // Keep focus where it was (e.g. a properties-panel input) when that node
    // survives the re-render; canvas nodes are rebuilt, so their focus is
    // re-applied by applySelectionToDOM instead.
    const prevFocus = document.activeElement;
    const parsed = JSON.parse(snap);
    setPagesState(parsed.pages, parsed.activePageId);
    // Drop any selected ids that no longer exist after the restore.
    setSelectedIds(getSelectedIds().filter(id => getElements().some(el => el.id === id)));
    emit('render');
    if (prevFocus && prevFocus !== document.body && prevFocus.isConnected) prevFocus.focus();
}

/**
 * Record the current state as an undo point. Call BEFORE mutating.
 * No-ops when nothing changed since the last record, and clears redo.
 */
export function record() {
    const snap = snapshot();
    if (undoStack[undoStack.length - 1] === snap) return;
    undoStack.push(snap);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    emit('history');
}

/**
 * Mark the start of a continuous interaction (drag / resize / rotate).
 * Records the pre-interaction state once; the per-move updates that follow
 * are skipped by inGesture() so a whole gesture is a single undo step.
 */
export function beginGesture() {
    record();
    gesturing = true;
}

/** End a continuous interaction started with beginGesture(). */
export function endGesture() {
    gesturing = false;
}

/** True while a continuous gesture (drag / resize / rotate) is in progress. */
export function inGesture() {
    return gesturing;
}

/** Undo the most recent recorded state, if any. */
export function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    emit('history');
}

/** Redo the most recently undone state, if any. */
export function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    emit('history');
}

/** True when an undo step is available. */
export function canUndo() {
    return undoStack.length > 0;
}

/** True when a redo step is available. */
export function canRedo() {
    return redoStack.length > 0;
}
