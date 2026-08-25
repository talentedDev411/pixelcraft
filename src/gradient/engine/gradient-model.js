/**
 * gradient-model.js — Creates and manages the internal gradient model.
 */

import { parseColorString, interpolateColors, rgbToHex, adjustHSL } from './color-utils.js';

let _idCounter = 0;
function generateId(prefix = 'stop') {
    return `${prefix}-${Date.now()}-${++_idCounter}`;
}

export function createStop(color = '#000000', position = 0, alpha = 1) {
    return {
        id: generateId('stop'),
        color,
        alpha,
        position,
    };
}

export function createOpacityStop(position = 0, alpha = 1) {
    return {
        id: generateId('opstop'),
        alpha,
        position,
    };
}

export function createGradient(overrides = {}) {
    return {
        id: generateId('grad'),
        type: 'linear',
        repeating: false,
        orientation: {
            mode: 'angle',
            angle: 180,
        },
        stops: [
            createStop('#ffffff', 0, 1),
            createStop('#000000', 100, 1),
        ],
        opacityStops: [],
        interpolation: {
            colorSpace: 'srgb',
            hueMethod: null,
        },
        radial: {
            shape: 'ellipse',
            size: 'farthest-corner',
            center: { x: 50, y: 50 },
        },
        conic: {
            from: 0,
            center: { x: 50, y: 50 },
        },
        backgroundSize: { width: 100, height: 100, mode: 'auto' },
        backgroundPosition: { x: 50, y: 50 },
        enabled: true,
        ...overrides,
    };
}

export function cloneGradient(model) {
    return JSON.parse(JSON.stringify(model));
}

export function addStop(model, position) {
    const sorted = [...model.stops].sort((a, b) => a.position - b.position);

    let left = sorted[0];
    let right = sorted[sorted.length - 1];

    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].position <= position && sorted[i + 1].position >= position) {
            left = sorted[i];
            right = sorted[i + 1];
            break;
        }
    }

    const leftColor = parseColorString(left.color);
    const rightColor = parseColorString(right.color);

    let t = 0;
    if (right.position !== left.position) {
        t = (position - left.position) / (right.position - left.position);
    }

    const interp = interpolateColors(
        { ...leftColor, a: left.alpha },
        { ...rightColor, a: right.alpha },
        t
    );

    const newStop = createStop(rgbToHex(interp.r, interp.g, interp.b), position, interp.a);
    model.stops.push(newStop);
    model.stops.sort((a, b) => a.position - b.position);
    return newStop;
}

export function removeStop(model, stopId) {
    if (model.stops.length <= 2) return false;
    const idx = model.stops.findIndex((s) => s.id === stopId);
    if (idx === -1) return false;
    model.stops.splice(idx, 1);
    return true;
}

export function moveStop(model, stopId, position) {
    const stop = model.stops.find((s) => s.id === stopId);
    if (!stop) return;
    stop.position = Math.max(0, Math.min(100, position));
}

export function updateStopColor(model, stopId, color) {
    const stop = model.stops.find((s) => s.id === stopId);
    if (!stop) return;
    stop.color = color;
}

export function updateStopAlpha(model, stopId, alpha) {
    const stop = model.stops.find((s) => s.id === stopId);
    if (!stop) return;
    stop.alpha = Math.max(0, Math.min(1, alpha));
}

export function reverseGradient(model) {
    model.stops.forEach((stop) => {
        stop.position = 100 - stop.position;
    });
    model.stops.sort((a, b) => a.position - b.position);

    if (model.opacityStops.length) {
        model.opacityStops.forEach((s) => {
            s.position = 100 - s.position;
        });
        model.opacityStops.sort((a, b) => a.position - b.position);
    }

    if (model.type === 'linear' && model.orientation.mode === 'angle') {
        model.orientation.angle = (model.orientation.angle + 180) % 360;
    }
}

export function changeGradientType(model, newType) {
    const repeatingTypes = ['repeating-linear', 'repeating-radial', 'repeating-conic'];
    const baseType = newType.replace('repeating-', '');
    model.type = baseType;
    model.repeating = repeatingTypes.includes(newType);
}

export function setOrientation(model, orientation) {
    model.orientation = { ...model.orientation, ...orientation };
}

export function setRadialGeometry(model, geometry) {
    model.radial = { ...model.radial, ...geometry };
    if (geometry.center) {
        model.radial.center = { ...model.radial.center, ...geometry.center };
    }
}

export function setConicGeometry(model, geometry) {
    model.conic = { ...model.conic, ...geometry };
    if (geometry.center) {
        model.conic.center = { ...model.conic.center, ...geometry.center };
    }
}

export function setInterpolation(model, interpolation) {
    model.interpolation = { ...model.interpolation, ...interpolation };
}

export function adjustAllColors(model, hDelta, sDelta, lDelta) {
    model.stops.forEach((stop) => {
        const color = parseColorString(stop.color);
        const adjusted = adjustHSL(color, hDelta, sDelta, lDelta);
        stop.color = rgbToHex(adjusted.r, adjusted.g, adjusted.b);
    });
}
