/**
 * color-utils.js — Color conversion and manipulation utilities.
 * Supports HEX, RGB, RGBA, HSL, HSLA with full bidirectional conversion.
 */

// ── HEX helpers ──────────────────────────────────────────────

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 8) {
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16),
            a: parseInt(hex.substring(6, 8), 16) / 255,
        };
    }
    if (hex.length === 6) {
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16),
            a: 1,
        };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
}

function rgbToHex(r, g, b, a) {
    const toHex = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
    let hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    if (a !== undefined && a !== null && a < 1) {
        hex += toHex(Math.round(a * 255));
    }
    return hex;
}

// ── RGB ↔ HSL ───────────────────────────────────────────────

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) {
        const v = Math.round(l * 255);
        return { r: v, g: v, b: v };
    }
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
        r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        g: Math.round(hue2rgb(p, q, h) * 255),
        b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    };
}

// ── Public conversion API ────────────────────────────────────

export function parseColorString(str) {
    str = str.trim().toLowerCase();
    let alpha = 1;
    let r, g, b;

    if (str.startsWith('#')) {
        const rgb = hexToRgb(str);
        return { r: rgb.r, g: rgb.g, b: rgb.b, a: rgb.a };
    }

    const named = parseNamedColor(str);
    if (named) return named;

    const rgbaMatch = str.match(
        /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/\s]\s*([\d.]+%?)\s*)?\)$/
    );
    if (rgbaMatch) {
        r = parseFloat(rgbaMatch[1]);
        g = parseFloat(rgbaMatch[2]);
        b = parseFloat(rgbaMatch[3]);
        alpha = rgbaMatch[4] !== undefined ? parseAlpha(rgbaMatch[4]) : 1;
        return { r, g, b, a: alpha };
    }

    const hslaMatch = str.match(
        /^hsla?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:[,/\s]\s*([\d.]+%?)\s*)?\)$/
    );
    if (hslaMatch) {
        const h = parseFloat(hslaMatch[1]);
        const s = parseFloat(hslaMatch[2]);
        const l = parseFloat(hslaMatch[3]);
        alpha = hslaMatch[4] !== undefined ? parseAlpha(hslaMatch[4]) : 1;
        const rgb = hslToRgb(h, s, l);
        return { r: rgb.r, g: rgb.g, b: rgb.b, a: alpha };
    }

    return { r: 0, g: 0, b: 0, a: 1 };
}

function parseAlpha(v) {
    if (typeof v === 'string' && v.endsWith('%')) return parseFloat(v) / 100;
    return clamp(parseFloat(v), 0, 1);
}

function parseNamedColor(name) {
    const map = {
        transparent: { r: 0, g: 0, b: 0, a: 0 },
        white: { r: 255, g: 255, b: 255, a: 1 },
        black: { r: 0, g: 0, b: 0, a: 1 },
        red: { r: 255, g: 0, b: 0, a: 1 },
        green: { r: 0, g: 128, b: 0, a: 1 },
        blue: { r: 0, g: 0, b: 255, a: 1 },
        yellow: { r: 255, g: 255, b: 0, a: 1 },
        cyan: { r: 0, g: 255, b: 255, a: 1 },
        magenta: { r: 255, g: 0, b: 255, a: 1 },
        gray: { r: 128, g: 128, b: 128, a: 1 },
        grey: { r: 128, g: 128, b: 128, a: 1 },
        orange: { r: 255, g: 165, b: 0, a: 1 },
        purple: { r: 128, g: 0, b: 128, a: 1 },
        pink: { r: 255, g: 192, b: 203, a: 1 },
    };
    return map[name] || null;
}

export function rgbString(r, g, b, a) {
    if (a !== undefined && a !== null && a < 1) {
        return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${roundAlpha(a)})`;
    }
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function hslString(h, s, l, a) {
    if (a !== undefined && a !== null && a < 1) {
        return `hsla(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%,${roundAlpha(a)})`;
    }
    return `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
}

function roundAlpha(a) {
    return Math.round(a * 1000) / 1000;
}

export function formatColor(color, format, includeAlpha) {
    const { r, g, b, a } = color;
    const useAlpha = includeAlpha && a < 1;

    switch (format) {
        case 'hex': {
            if (useAlpha) return rgbToHex(r, g, b, a);
            return rgbToHex(r, g, b);
        }
        case 'rgb':
            return rgbString(r, g, b);
        case 'rgba':
            return rgbString(r, g, b, a);
        case 'hsl': {
            const hsl = rgbToHsl(r, g, b);
            return hslString(hsl.h, hsl.s, hsl.l);
        }
        case 'hsla': {
            const hsl = rgbToHsl(r, g, b);
            return hslString(hsl.h, hsl.s, hsl.l, a);
        }
        default:
            return useAlpha ? rgbString(r, g, b, a) : rgbToHex(r, g, b);
    }
}

export function interpolateColors(c1, c2, t) {
    return {
        r: Math.round(c1.r + (c2.r - c1.r) * t),
        g: Math.round(c1.g + (c2.g - c1.g) * t),
        b: Math.round(c1.b + (c2.b - c1.b) * t),
        a: c1.a + (c2.a - c1.a) * t,
    };
}

export function toHex(color, includeAlpha = false) {
    return rgbToHex(color.r, color.g, color.b, includeAlpha ? color.a : undefined);
}

export function adjustHSL(color, hDelta, sDelta, lDelta) {
    const hsl = rgbToHsl(color.r, color.g, color.b);
    hsl.h = ((hsl.h + hDelta) % 360 + 360) % 360;
    hsl.s = clamp(hsl.s + sDelta, 0, 100);
    hsl.l = clamp(hsl.l + lDelta, 0, 100);
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return { r: rgb.r, g: rgb.g, b: rgb.b, a: color.a };
}

export { clamp, hexToRgb, rgbToHex, rgbToHsl, hslToRgb, roundAlpha };
