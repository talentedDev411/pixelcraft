/**
 * gradient-serializer.js — Converts internal gradient model to CSS string.
 */

import { parseColorString, formatColor, clamp } from './color-utils.js';

export function serializeGradient(model, colorFormat = 'hex', wrapDeclaration = false) {
    const { type, repeating, orientation, stops, opacityStops, interpolation, radial, conic } = model;

    const hasAlpha = stops.some((s) => s.alpha < 1) || (opacityStops && opacityStops.length > 0);
    let effectiveFormat = colorFormat;
    if (hasAlpha && colorFormat === 'hex') {
        effectiveFormat = 'rgba';
    }

    let funcName = '';
    if (repeating) {
        funcName = `repeating-${type}-gradient`;
    } else {
        funcName = `${type}-gradient`;
    }

    const args = [];

    if (type === 'linear') {
        args.push(formatOrientation(orientation));
    } else if (type === 'radial') {
        args.push(formatRadial(radial));
    } else if (type === 'conic') {
        args.push(formatConic(conic));
    }

    const sortedStops = [...stops].sort((a, b) => a.position - b.position);

    for (const stop of sortedStops) {
        const color = parseColorString(stop.color);
        const colorStr = formatStopColor(color, stop.alpha, effectiveFormat);
        const posStr = ` ${Math.round(stop.position * 100) / 100}%`;
        args.push(colorStr + posStr);
    }

    const gradientStr = `${funcName}(${args.join(', ')})`;

    if (wrapDeclaration) {
        return `background: ${gradientStr};`;
    }

    return gradientStr;
}

export function serializeMultipleGradients(models, colorFormat = 'hex') {
    const layers = models
        .filter((m) => m.enabled)
        .map((m) => serializeGradient(m, colorFormat, false));

    if (layers.length === 0) return '';
    if (layers.length === 1) return `background: ${layers[0]};`;

    return `background:\n    ${layers.join(',\n    ')};`;
}

function formatOrientation(orientation) {
    if (!orientation) return '180deg';
    if (orientation.mode === 'angle') {
        return `${orientation.angle}deg`;
    }
    return '180deg';
}

function formatRadial(radial) {
    if (!radial) return '';
    const parts = [];
    parts.push(radial.shape || 'ellipse');
    if (radial.size && radial.size !== 'farthest-corner') {
        parts.push(radial.size);
    }
    if (radial.center && (radial.center.x !== 50 || radial.center.y !== 50)) {
        parts.push(`at ${radial.center.x}% ${radial.center.y}%`);
    }
    return parts.join(' ');
}

function formatConic(conic) {
    if (!conic) return '';
    const parts = [];
    if (conic.from && conic.from !== 0) {
        parts.push(`from ${conic.from}deg`);
    }
    if (conic.center && (conic.center.x !== 50 || conic.center.y !== 50)) {
        parts.push(`at ${conic.center.x}% ${conic.center.y}%`);
    }
    return parts.join(' ');
}

function formatStopColor(color, alpha, format) {
    return formatColor(color, format, alpha < 1);
}
