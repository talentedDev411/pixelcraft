// Single place that queries the DOM, so markup ids only need to stay in sync
// here. Modules import `dom` instead of calling getElementById themselves.

export const dom = {
    // Top bar
    aspectBtns: Array.from(document.querySelectorAll('.aspect-btn')),
    clearCanvasBtn: document.getElementById('clearCanvasBtn'),
    exportBtn: document.getElementById('exportBtn'),

    // Toolbox
    addTextTool: document.getElementById('addTextTool'),
    imageUploadInput: document.getElementById('imageUploadInput'),
    bgColorInput: document.getElementById('canvasBgColor'),
    undoTool: document.getElementById('undoTool'),
    redoTool: document.getElementById('redoTool'),

    // Canvas area
    canvasArea: document.getElementById('canvasArea'),
    canvasWrapper: document.getElementById('canvasWrapper'),
    designCanvas: document.getElementById('designCanvas'),

    // Page track (multi-canvas)
    pageTrack: document.getElementById('pageTrack'),
    pageThumbs: document.getElementById('pageThumbs'),
    addPageBtn: document.getElementById('addPageBtn'),
    clonePageBtn: document.getElementById('clonePageBtn'),
    deletePageBtn: document.getElementById('deletePageBtn'),

    // Properties panel
    noSelection: document.getElementById('noSelection'),
    multiSelectionNote: document.getElementById('multiSelectionNote'),
    positionProperties: document.getElementById('positionProperties'),
    positionXInput: document.getElementById('positionXInput'),
    positionYInput: document.getElementById('positionYInput'),
    sizeWidthInput: document.getElementById('sizeWidthInput'),
    sizeHeightInput: document.getElementById('sizeHeightInput'),
    rotationInput: document.getElementById('rotationInput'),
    skewXInput: document.getElementById('skewXInput'),
    skewYInput: document.getElementById('skewYInput'),
    textProperties: document.getElementById('textProperties'),
    imageProperties: document.getElementById('imageProperties'),
    textContentInput: document.getElementById('textContentInput'),
    fontSizeInput: document.getElementById('fontSizeInput'),
    fontWeightInput: document.getElementById('fontWeightInput'),
    fontFamilyInput: document.getElementById('fontFamilyInput'),
    customFontInput: document.getElementById('customFontInput'),
    customFontHint: document.getElementById('customFontHint'),
    textColorInput: document.getElementById('textColorInput'),
    textBgColorInput: document.getElementById('textBgColorInput'),
    removeTextBgBtn: document.getElementById('removeTextBgBtn'),
    paddingTopInput: document.getElementById('paddingTopInput'),
    paddingRightInput: document.getElementById('paddingRightInput'),
    paddingBottomInput: document.getElementById('paddingBottomInput'),
    paddingLeftInput: document.getElementById('paddingLeftInput'),
    shadowPresetInput: document.getElementById('shadowPresetInput'),
    shadowXInput: document.getElementById('shadowXInput'),
    shadowYInput: document.getElementById('shadowYInput'),
    shadowBlurInput: document.getElementById('shadowBlurInput'),
    shadowColorInput: document.getElementById('shadowColorInput'),
    shadowOpacityInput: document.getElementById('shadowOpacityInput'),
    shadowOpacityLabel: document.getElementById('shadowOpacityLabel'),
    textShadowInput: document.getElementById('textShadowInput'),
    removeShadowBtn: document.getElementById('removeShadowBtn'),
    brTLInput: document.getElementById('brTLInput'),
    brTRInput: document.getElementById('brTRInput'),
    brBLInput: document.getElementById('brBLInput'),
    brBRInput: document.getElementById('brBRInput'),
    deleteElementBtn: document.getElementById('deleteElementBtn'),
    deleteImageBtn: document.getElementById('deleteImageBtn'),
    swapImageInput: document.getElementById('swapImageInput'),

    // Context menu
    contextMenu: document.getElementById('contextMenu'),
    fitModeMenuItem: document.getElementById('fitModeMenuItem'),
};
