// Global keyboard shortcuts for undo/redo and cut/copy/paste, wired so they
// behave like a text field:
//   - Highlighted text inside a canvas text box → native text cut/copy/paste.
//   - Real form fields (properties panel) keep native cut/copy/paste/delete;
//     undo/redo there is routed through the app history so panel edits and
//     canvas edits share one consistent undo stack.
//   - Everywhere else → the shortcut acts on the selected element.
//
//   Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y  undo / redo
//   Ctrl+X / Ctrl+C / Ctrl+V        cut / copy / paste the selected element
//   Delete / Backspace              delete the selected element

import { clearClipboard, copyElement, cutElement, deleteElement, pasteElement } from './elements.js';
import { redo, undo } from './history.js';
import { getSelectedElementId } from './state.js';

/** True when focus is in a plain form field (properties panel inputs). */
function isFormField(target) {
    const tag = target && target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** True when the event target is inside a canvas text element. */
function isInTextElement(target) {
    return !!(target && target.closest && target.closest('.text-element'));
}

/** True when the user has highlighted text inside a canvas text element. */
function hasTextSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.anchorNode) return false;
    const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    return !!(node && node.closest && node.closest('.text-element'));
}

/** Wire up the global keyboard shortcuts. Call once on startup. */
export function initShortcuts() {
    document.addEventListener('keydown', e => {
        const target = e.target;
        const mod = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        // When the user natively cuts/copies text (highlighted text inside a
        // text box), the element clipboard is stale — drop it so Ctrl+V
        // pastes the text instead of an old element.
        if (isFormField(target)) {
            // Form fields keep their native cut/copy/paste/delete… but undo
            // and redo go through the app history (panel edits record into it),
            // so both panels and canvas share a single undo stack.
            if (mod && (key === 'z' || key === 'y')) {
                e.preventDefault();
                if (key === 'y' || e.shiftKey) redo();
                else undo();
            }
            return;
        }

        // Delete / Backspace removes the selected element — unless the user is
        // typing inside a text element (then the key deletes characters).
        if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
            if (isInTextElement(target)) return;
            if (getSelectedElementId()) {
                e.preventDefault();
                deleteElement(getSelectedElementId());
            }
            return;
        }

        if (!mod) return;

        switch (key) {
            case 'z':
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
                break;
            case 'y':
                e.preventDefault();
                redo();
                break;
            case 'x':
                // Highlighted text inside a text box → native cut of that text.
                if (isInTextElement(target) && hasTextSelection()) return;
                e.preventDefault();
                cutElement();
                break;
            case 'c':
                if (isInTextElement(target) && hasTextSelection()) return;
                e.preventDefault();
                copyElement();
                break;
            case 'v':
                // Highlighted text → native paste of text into the box.
                if (isInTextElement(target) && hasTextSelection()) return;
                // Paste an element from the internal clipboard when there is
                // one; otherwise fall through to the native paste (text).
                if (pasteElement()) e.preventDefault();
                break;
        }
    });

    // Native cut/copy of highlighted text replaces the element clipboard.
    document.addEventListener('cut', clearClipboard);
    document.addEventListener('copy', clearClipboard);
}
