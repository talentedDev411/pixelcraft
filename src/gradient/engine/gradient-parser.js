/**
 * gradient-parser.js — Parses CSS gradient strings into the internal model.
 */

import { parseColorString } from './color-utils.js';
import { createGradient, createStop } from './gradient-model.js';

const GRADIENT_FUNCTIONS = [
    'repeating-linear-gradient',
    'repeating-radial-gradient',
    'repeating-conic-gradient',
    'linear-gradient',
    'radial-gradient',
    'conic-gradient',
];

function stripDeclaration(css) {
    css = css.trim();
    css = css.replace(/;$/, '').trim();
    const declMatch = css.match(/^(?:background(?:-image)?)\s*:\s*/i);
    if (declMatch) {
        css = css.substring(declMatch[0].length).trim();
    }
    return css;
}

function findGradientCall(css) {
    css = stripDeclaration(css);
    let funcType = null;
    for (const fn of GRADIENT_FUNCTIONS) {
        const idx = css.toLowerCase().indexOf(fn + '(');
        if (idx !== -1) {
            funcType = fn;
            css = css.substring(idx);
            break;
        }
    }
    if (!funcType) return null;
    const openIdx = css.indexOf('(');
    if (openIdx === -1) return null;
    let depth = 0;
    let closeIdx = -1;
    for (let i = openIdx; i < css.length; i++) {
        if (css[i] === '(') depth++;
        if (css[i] === ')') depth--;
        if (depth === 0) { closeIdx = i; break; }
    }
    if (closeIdx === -1) return null;
    const inner = css.substring(openIdx + 1, closeIdx).trim();
    return { funcType, inner };
}

function splitByComma(str) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '(') depth++;
        if (str[i] === ')') depth--;
        if (str[i] === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
        } else {
            current += str[i];
        }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
}

function parseStopString(str) {
    str = str.trim();
    let position = null;
    let colorStr = str;
    const posMatch = str.match(/\s+(\d+(?:\.\d+)?)%\s*$/);
    if (posMatch) {
        position = parseFloat(posMatch[1]);
        colorStr = str.substring(0, str.length - posMatch[0].length).trim();
    }
    const parsed = parseColorString(colorStr);
    const color = `#${parsed.r.toString(16).padStart(2, '0')}${parsed.g.toString(16).padStart(2, '0')}${parsed.b.toString(16).padStart(2, '0')}`;
    const alpha = parsed.a;
    return { color, alpha, position };
}

function parseStops(args) {
    const stops = [];
    let hint = null;
    let lastArg = args[args.length - 1];
    const hintMatch = lastArg.match(
        /^(?:in\s+(?:srgb|linear-rgb|srgb-linear|hsl|oklab|oklch))$/i
    );
    if (hintMatch) {
        hint = hintMatch[0];
        args = args.slice(0, -1);
    }
    for (const arg of args) {
        const result = parseStopString(arg);
        if (result) stops.push(result);
    }
    return { stops, hint };
}

function parseOrientation(firstArg) {
    if (!firstArg) return { mode: 'angle', angle: 180 };
    const arg = firstArg.trim().toLowerCase();
    const degMatch = arg.match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (degMatch) return { mode: 'angle', angle: parseFloat(degMatch[1]) };
    const dirMap = {
        'to top': 0, 'to top right': 45, 'to right': 90, 'to bottom right': 135,
        'to bottom': 180, 'to bottom left': 225, 'to left': 270, 'to top left': 315,
    };
    const toDirMatch = arg.match(/^to\s+(top|right|bottom|left)(?:\s+(top|right|bottom|left))?$/);
    if (toDirMatch) {
        const dir = toDirMatch[2] ? `to ${toDirMatch[1]} ${toDirMatch[2]}` : `to ${toDirMatch[1]}`;
        if (dirMap[dir] !== undefined) return { mode: 'angle', angle: dirMap[dir] };
    }
    const sideMap = { 'top': 0, 'right': 90, 'bottom': 180, 'left': 270 };
    if (sideMap[arg] !== undefined) return { mode: 'angle', angle: sideMap[arg] };
    return { mode: 'angle', angle: 180 };
}

export function parseGradient(css) {
    const result = findGradientCall(css);
    if (!result) return { model: null, error: 'No gradient function found.' };
    const { funcType, inner } = result;
    const args = splitByComma(inner);
    if (args.length < 2) return { model: null, error: 'Not enough arguments.' };
    const isLinear = funcType.includes('linear');
    const isRadial = funcType.includes('radial');
    const isConic = funcType.includes('conic');
    const isRepeating = funcType.startsWith('repeating-');
    let orientation, radialConfig, conicConfig;
    let colorArgs = args;
    if (isLinear) {
        const firstIsAngle = args[0].match(/^(-?\d+(?:\.\d+)?)deg$/) || args[0].match(/^to\s/);
        if (firstIsAngle) {
            orientation = parseOrientation(args[0]);
            colorArgs = args.slice(1);
        } else {
            orientation = { mode: 'angle', angle: 180 };
        }
    }
    if (isRadial) {
        radialConfig = { shape: 'ellipse', size: 'farthest-corner', center: { x: 50, y: 50 } };
        const firstIsShape = args[0].match(/^(circle|ellipse)/);
        if (firstIsShape) {
            radialConfig.shape = args[0].includes('circle') ? 'circle' : 'ellipse';
            colorArgs = args.slice(1);
        }
    }
    if (isConic) {
        conicConfig = { from: 0, center: { x: 50, y: 50 } };
        if (args[0].startsWith('from ')) {
            const fromMatch = args[0].match(/from\s+(-?\d+(?:\.\d+)?)deg/);
            if (fromMatch) conicConfig.from = parseFloat(fromMatch[1]);
            colorArgs = args.slice(1);
        }
    }
    const { stops } = parseStops(colorArgs);
    if (stops.length < 2) return { model: null, error: 'At least 2 color stops required.' };
    const type = isLinear ? 'linear' : isRadial ? 'radial' : 'conic';
    const model = createGradient({
        type,
        repeating: isRepeating,
        orientation: orientation || { mode: 'angle', angle: 180 },
        radial: radialConfig,
        conic: conicConfig,
        stops: stops.map((s) => createStop(s.color, s.position ?? 50, s.alpha ?? 1)),
    });
    return { model, error: null };
}

export function parseMultipleGradients(css) {
    const results = [];
    let remaining = css.trim();
    while (remaining.length > 0) {
        const result = parseGradient(remaining);
        if (result.model) {
            results.push(result);
            const call = findGradientCall(remaining);
            if (call) {
                const fullCall = remaining.substring(
                    remaining.toLowerCase().indexOf(call.funcType),
                    remaining.indexOf(')', remaining.toLowerCase().indexOf(call.funcType)) + 1
                );
                remaining = remaining.substring(remaining.indexOf(fullCall) + fullCall.length).replace(/^,?\s*/, '');
            } else break;
        } else {
            results.push(result);
            break;
        }
    }
    return results;
}
