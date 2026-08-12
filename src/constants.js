// Central place for all shared configuration values.

/** Preset canvas aspect ratios, keyed by the button's data-ratio value. */
export const ASPECT_RATIOS = {
    '1:1': [1, 1],
    '4:5': [4, 5],
    '9:16': [9, 16],
    '16:9': [16, 9],
    '2:3': [2, 3],
};

/** Ratio selected on first load. */
export const DEFAULT_ASPECT_RATIO = '1:1';

/** Maximum width/height (px) an uploaded image is scaled to when first added. */
export const MAX_IMAGE_DIM = 200;

/**
 * Built-in font families, picked for their MAANG / luxury-brand associations:
 *   Inter            – GitHub, Figma, Mozilla
 *   Roboto           – Google / Android
 *   Poppins          – tech-startup & big-tech marketing
 *   Montserrat       – luxury fashion web presence
 *   Playfair Display – luxury editorial (Didot / Vogue style)
 * The files live in resources/fonts/ (see scripts/download-fonts.mjs).
 */
export const FONT_FAMILIES = [
    { family: 'Inter', tag: 'Big Tech' },
    { family: 'Roboto', tag: 'Google / Android' },
    { family: 'Poppins', tag: 'Tech Marketing' },
    { family: 'Montserrat', tag: 'Luxury Fashion' },
    { family: 'Playfair Display', tag: 'Luxury Editorial' },
];

/** Value of the “Custom Font…” option in the font-family dropdown. */
export const CUSTOM_FONT_OPTION = '__custom__';

/**
 * Professional text-shadow presets (x4). Picking one in the panel pre-fills
 * the shadow property inputs (offset X/Y, blur, spread, color + opacity),
 * which together compose the CSS text-shadow string.
 */
export const TEXT_SHADOW_PRESETS = [
    { name: 'Soft Drop', props: { x: 0, y: 2, blur: 4, color: '#000000', opacity: 25 } },
    { name: 'Hard Drop', props: { x: 0, y: 4, blur: 0, color: '#000000', opacity: 30 } },
    { name: 'Neon Glow', props: { x: 0, y: 0, blur: 12, color: '#7c5cfc', opacity: 90 } },
    { name: 'Paper Cut', props: { x: 2, y: 2, blur: 0, color: '#000000', opacity: 35 } },
];

/** Build the CSS border-radius shorthand for a text element. */
export function radiusCss(el) {
    const r = el.borderRadius || {};
    return `${r.tl ?? 0}px ${r.tr ?? 0}px ${r.br ?? 0}px ${r.bl ?? 0}px`;
}

/** Build the CSS padding shorthand for a text element (4 independent sides). */
export function paddingCss(el) {
    const p = el.padding;
    if (p == null) return '8px';
    if (typeof p === 'number') return `${p}px`; // legacy single-value padding
    return `${p.top ?? 8}px ${p.right ?? 8}px ${p.bottom ?? 8}px ${p.left ?? 8}px`;
}

/** Build the combined CSS transform (rotate + skew) for any element. */
export function transformCss(el) {
    return `rotate(${el.rotation || 0}deg) skewX(${el.skewX || 0}deg) skewY(${el.skewY || 0}deg)`;
}

/** Default property values used when creating new elements. */
export const ELEMENT_DEFAULTS = {
    text: {
        fontSize: 24,
        fontWeight: '400',
        fontFamily: 'Inter',
        color: '#000000',
        bgColor: 'transparent',
        textShadow: 'none',
        borderRadius: { tl: 0, tr: 0, br: 0, bl: 0 },
        rotation: 0,
        skewX: 0,
        skewY: 0,
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
    },
    image: {
        fitMode: 'fill', // 'fill' stretches; 'cover' crops like object-fit: cover
        rotation: 0,
        skewX: 0,
        skewY: 0,
    },
};

/** Export scaling: output is (canvas size × this ratio) pixels. */
export const EXPORT_PIXEL_RATIO = 2;
