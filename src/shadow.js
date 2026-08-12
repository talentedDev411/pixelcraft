// Compose and parse CSS text-shadow strings from discrete properties, so the
// panel can offer a visual shadow editor (offsets, blur, spread, color,
// opacity) on top of the raw CSS value.

/** #rrggbb (or #rgb) -> { r, g, b }. */
export function hexToRgb(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

/** { r, g, b } -> #rrggbb. */
export function rgbToHex(r, g, b) {
    const to = v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Compose { x, y, blur, color, opacity } into a CSS text-shadow string.
 * Returns 'none' when there is effectively no shadow (opacity 0).
 *
 * Note: text-shadow supports only offset X, offset Y and blur — no spread
 * (spread is a box-shadow feature and would make the declaration invalid).
 */
export function composeShadow(props) {
    if (!props) return 'none';
    const { x = 0, y = 0, blur = 0, color = '#000000', opacity = 100 } = props;
    if (opacity <= 0) return 'none';
    const { r, g, b } = hexToRgb(color);
    const a = Math.max(0, Math.min(100, opacity)) / 100;
    return `${x}px ${y}px ${blur}px rgba(${r},${g},${b},${a})`;
}

/**
 * Parse a single CSS text-shadow into { x, y, blur, spread, color, opacity }.
 * Returns null for 'none', multi-shadow strings, or anything not decomposable
 * (those stay editable as a raw CSS string instead).
 */
export function parseShadow(css) {
    if (!css || css === 'none') return null;
    // Tolerate an optional 4th length (spread) even though text-shadow does
    // not support it — browsers reject it, so it is simply dropped here.
    const m = String(css).match(/^\s*(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?(?:\s+(-?[\d.]+)px)?\s+(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*$/);
    if (!m) return null;

    let r = 0, g = 0, b = 0, a = 1;
    const color = m[5];
    if (color.startsWith('#')) {
        let h = color.slice(1);
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        if (h.length === 6) {
            r = parseInt(h.slice(0, 2), 16);
            g = parseInt(h.slice(2, 4), 16);
            b = parseInt(h.slice(4, 6), 16);
        } else if (h.length === 8) {
            r = parseInt(h.slice(0, 2), 16);
            g = parseInt(h.slice(2, 4), 16);
            b = parseInt(h.slice(4, 6), 16);
            a = parseInt(h.slice(6, 8), 16) / 255;
        }
    } else {
        const parts = color.match(/[\d.]+/g).map(Number);
        if (parts.length >= 3) { r = parts[0]; g = parts[1]; b = parts[2]; }
        if (parts.length >= 4) a = parts[3];
    }
    return {
        x: parseFloat(m[1]),
        y: parseFloat(m[2]),
        blur: parseFloat(m[3] || '0'),
        color: rgbToHex(r, g, b),
        opacity: Math.round(a * 100),
    };
}
