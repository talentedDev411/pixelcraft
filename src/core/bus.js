// Minimal pub/sub bus. Modules emit domain events ('render', 'selection', …)
// and other modules subscribe, so nothing needs to know about its consumers.

const listeners = new Map();

/**
 * Subscribe to an event. Returns an unsubscribe function.
 * @param {string} event
 * @param {(...args: any[]) => void} fn
 */
export function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
}

/** Emit an event with optional payload. */
export function emit(event, ...args) {
    listeners.get(event)?.forEach(fn => fn(...args));
}
