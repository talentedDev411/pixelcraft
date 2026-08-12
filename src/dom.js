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

    // Canvas area
    canvasArea: document.getElementById('canvasArea'),
    canvasWrapper: document.getElementById('canvasWrapper'),
    designCanvas: document.getElementById('designCanvas'),

    // Properties panel
    noSelection: document.getElementById('noSelection'),
    positionProperties: document.getElementById('positionProperties'),
    positionXInput: document.getElementById('positionXInput'),
    positionYInput: document.getElementById('positionYInput'),
    sizeWidthInput: document.getElementById('sizeWidthInput'),
    sizeHeightInput: document.getElementById('sizeHeightInput'),
    textProperties: document.getElementById('textProperties'),
    imageProperties: document.getElementById('imageProperties'),
    textContentInput: document.getElementById('textContentInput'),
    fontSizeInput: document.getElementById('fontSizeInput'),
    fontWeightInput: document.getElementById('fontWeightInput'),
    textColorInput: document.getElementById('textColorInput'),
    textBgColorInput: document.getElementById('textBgColorInput'),
    textShadowInput: document.getElementById('textShadowInput'),
    deleteElementBtn: document.getElementById('deleteElementBtn'),
    deleteImageBtn: document.getElementById('deleteImageBtn'),
    swapImageInput: document.getElementById('swapImageInput'),

    // Context menu
    contextMenu: document.getElementById('contextMenu'),
    fitModeMenuItem: document.getElementById('fitModeMenuItem'),
};
