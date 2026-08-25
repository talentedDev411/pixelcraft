/**
 * gradient-normalizer.js — Normalizes parsed gradient data into a clean model.
 */

import { parseColorString, rgbToHex, clamp } from './color-utils.js';

export function normalizeGradient(model) {
    const normalized = { ...model };

    if (!['linear', 'radial', 'conic'].includes(normalized.type)) {
        normalized.type = 'linear';
    }

    if (normalized.type === 'linear') {
        normalized.orientation = normalized.orientation || { mode: 'angle', angle: 180 };
        normalized.orientation.angle = clamp(normalized.orientation.angle || 0, -360, 360);
    }

    if (normalized.type === 'radial') {
        normalized.radial = normalized.radial || {};
        if (!['circle', 'ellipse'].includes(normalized.radial.shape)) {
            normalized.radial.shape = 'ellipse';
        }
        const validSizes = ['closest-side', 'farthest-side', 'closest-corner', 'farthest-corner'];
        if (!validSizes.includes(normalized.radial.size)) {
            normalized.radial.size = 'farthest-corner';
        }
        normalized.radial.center = normalized.radial.center || { x: 50, y: 50 };
        normalized.radial.center.x = clamp(normalized.radial.center.x, 0, 100);
        normalized.radial.center.y = clamp(normalized.radial.center.y, 0, 100);
    }

    if (normalized.type === 'conic') {
        normalized.conic = normalized.conic || { from: 0, center: { x: 50, y: 50 } };
        normalized.conic.from = clamp(normalized.conic.from || 0, -360, 360);
        normalized.conic.center = normalized.conic.center || { x: 50, y: 50 };
        normalized.conic.center.x = clamp(normalized.conic.center.x, 0, 100);
        normalized.conic.center.y = clamp(normalized.conic.center.y, 0, 100);
    }

    if (!Array.isArray(normalized.stops) || normalized.stops.length < 2) {
        normalized.stops = [
            { id: 'norm-stop-1', color: '#ffffff', alpha: 1, position: 0 },
            { id: 'norm-stop-2', color: '#000000', alpha: 1, position: 100 },
        ];
    }

    normalized.stops = normalized.stops.map((stop) => {
        const color = parseColorString(stop.color || '#000000');
        return {
            id: stop.id || `stop-${Math.random().toString(36).substr(2, 9)}`,
            color: rgbToHex(color.r, color.g, color.b),
            alpha: clamp(stop.alpha ?? 1, 0, 1),
            position: clamp(stop.position ?? 0, 0, 100),
        };
    });

    normalized.stops.sort((a, b) => a.position - b.position);

    normalized.interpolation = normalized.interpolation || { colorSpace: 'srgb', hueMethod: null };
    normalized.opacityStops = normalized.opacityStops || [];
    normalized.backgroundSize = normalized.backgroundSize || { width: 100, height: 100, mode: 'auto' };
    normalized.backgroundPosition = normalized.backgroundPosition || { x: 50, y: 50 };
    if (normalized.enabled === undefined) normalized.enabled = true;

    return normalized;
}
