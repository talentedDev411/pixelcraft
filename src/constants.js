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

/** Default property values used when creating new elements. */
export const ELEMENT_DEFAULTS = {
    text: {
        fontSize: 24,
        fontWeight: '400',
        color: '#000000',
        bgColor: 'transparent',
        textShadow: 'none',
    },
    image: {
        fitMode: 'fill', // 'fill' stretches; 'cover' crops like object-fit: cover
    },
};

/** Export scaling: output is (canvas size × this ratio) pixels. */
export const EXPORT_PIXEL_RATIO = 2;
