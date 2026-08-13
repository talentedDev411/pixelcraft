// Select mode (mobile-friendly multi-select + copy/paste).
//
// The toolbox Select tool has two states:
//   - off        normal editing (drag / resize / single-click select)
//   - active     darker background, right-side Copy/Paste menu appears
//
// While active, tapping canvas elements toggles their selection (see
// interactions.js). The menu follows a strict state machine:
//   - nothing selected        → Copy disabled, Paste disabled
//   - element(s) selected     → Copy enabled,  Paste disabled
//   - Copy clicked            → Copy disabled, Paste enabled (repeatable)
//
// Cancellable: turning the Select tool off (or pressing Escape) while Paste is
// still disabled drops the selected elements — a clean "cancel" of the
// selection. If something was already pasted, exiting simply leaves the result.

import { on } from './bus.js';
import { dom } from './dom.js';
import { clearClipboard, copyElement, pasteElement } from './elements.js';
import { deselectAll } from './selection.js';
import { getSelectedIds } from './state.js';

let mode = false;

/** Whether the app is currently in select mode. */
export function isSelectMode() {
    return mode;
}

function setCopyEnabled(on) {
    dom.selectCopyBtn.disabled = !on;
    dom.selectCopyBtn.classList.toggle('disabled', !on);
}

function setPasteEnabled(on) {
    dom.selectPasteBtn.disabled = !on;
    dom.selectPasteBtn.classList.toggle('disabled', !on);
}

/** Place the menu right next to the Select tool button, clamped to the
 * viewport (falls below the button when there is no room on the right). */
function positionMenu() {
    const btn = dom.selectTool.getBoundingClientRect();
    const menu = dom.selectMenu;
    const mw = menu.offsetWidth || 130;
    const mh = menu.offsetHeight || 120;
    let left = btn.right + 8;
    let top = btn.top + btn.height / 2 - mh / 2;
    if (left + mw > window.innerWidth - 8) {
        left = Math.max(8, Math.min(btn.left, window.innerWidth - mw - 8));
        top = btn.bottom + 8;
        if (top + mh > window.innerHeight - 8) top = Math.max(8, btn.top - mh - 8);
    }
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
}

/** Enter (true) or leave (false) select mode. */
export function setSelectMode(on) {
    if (on === mode) return;
    mode = on;
    dom.selectTool.classList.toggle('active-dark', on);
    if (on) {
        // Fresh session: the element clipboard is cleared so Paste starts off
        // and can only light up after a Copy inside the mode.
        clearClipboard();
        setCopyEnabled(false);
        setPasteEnabled(false);
        dom.selectMenu.style.display = 'flex';
        positionMenu();
    } else {
        dom.selectMenu.style.display = 'none';
    }
}

/**
 * Cancel flow: leave select mode, and when nothing was pasted yet, drop the
 * selected elements too ("click the selection button while paste is still off
 * → cancel the selected components").
 */
function cancelSelectMode() {
    if (dom.selectPasteBtn.disabled) deselectAll();
    setSelectMode(false);
}

/** Wire up the Select tool and the Copy/Paste menu. Call once on startup. */
export function initSelectMode() {
    dom.selectTool.addEventListener('click', () => {
        if (mode) cancelSelectMode();
        else setSelectMode(true);
    });

    // Selection changes drive Copy's enabled state while the mode is on.
    on('selection', () => {
        if (mode) setCopyEnabled(getSelectedIds().length > 0);
    });

    dom.selectCopyBtn.addEventListener('click', () => {
        if (!getSelectedIds().length) return;
        copyElement();
        setCopyEnabled(false);
        setPasteEnabled(true);
    });

    // Paste stays enabled so it can be repeated (each paste steps away).
    dom.selectPasteBtn.addEventListener('click', () => {
        if (pasteElement()) setPasteEnabled(true);
    });

    // Escape is a second way to cancel.
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && mode) cancelSelectMode();
    });

    // Keep the menu glued to the Select button across resizes/layout changes.
    window.addEventListener('resize', () => {
        if (mode) positionMenu();
    });
}
