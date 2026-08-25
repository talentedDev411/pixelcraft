/**
 * gradient-validation.js — Validates gradient model data.
 */

export function validateGradient(model) {
    const errors = [];
    if (!model) return { valid: false, errors: ['No gradient model provided.'] };
    if (!['linear', 'radial', 'conic'].includes(model.type)) {
        errors.push(`Invalid gradient type: "${model.type}"`);
    }
    if (!Array.isArray(model.stops) || model.stops.length < 2) {
        errors.push('At least 2 color stops are required.');
    }
    model.stops?.forEach((stop, i) => {
        if (!stop.color) errors.push(`Stop ${i} is missing a color.`);
        if (typeof stop.position !== 'number' || stop.position < 0 || stop.position > 100) {
            errors.push(`Stop ${i} has invalid position: ${stop.position}`);
        }
        if (typeof stop.alpha !== 'number' || stop.alpha < 0 || stop.alpha > 1) {
            errors.push(`Stop ${i} has invalid alpha: ${stop.alpha}`);
        }
    });
    return { valid: errors.length === 0, errors };
}

export function validateCSSInput(css) {
    if (!css || typeof css !== 'string') return { valid: false, error: 'Input is not a string.' };
    const trimmed = css.trim();
    if (trimmed.length === 0) return { valid: false, error: 'Input is empty.' };
    const hasGradient = /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.test(trimmed);
    if (!hasGradient) return { valid: false, error: 'No gradient function found in input.' };
    return { valid: true, error: null };
}
