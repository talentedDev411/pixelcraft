/** Generate a unique element id. */
export function generateId() {
    return 'el_' + Date.now() + Math.random().toString(36).slice(2, 8);
}

/** Clamp a value between min and max (inclusive). */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

/** Find an element by id in an array of elements. */
export function findElementById(elements, id) {
    return elements.find(el => el.id === id) || null;
}
