// Right-hand properties panel: populating it from the selected element and
// wiring every input back into the element model.

import { on } from './bus.js';
import { dom } from './dom.js';
import { updateElementModelAndDOM } from './canvas.js';
import { deleteElement } from './elements.js';
import { CUSTOM_FONT_OPTION, FONT_FAMILIES, TEXT_SHADOW_PRESETS } from './constants.js';
import { getCustomFonts, importCustomFont } from './fonts.js';
import { composeShadow, parseShadow } from './shadow.js';
import {
    getCanvasHeight,
    getCanvasWidth,
    getSelectedElement,
    getSelectedElementId,
} from './state.js';
import { clamp } from './utils.js';

/** Rebuild the font-family dropdown: 5 built-ins + imported customs + custom import. */
function populateFontSelect(selected) {
    const sel = dom.fontFamilyInput;
    sel.innerHTML = '';
    FONT_FAMILIES.forEach(({ family, tag }) => {
        const opt = document.createElement('option');
        opt.value = family;
        opt.textContent = tag ? `${family} — ${tag}` : family;
        sel.appendChild(opt);
    });
    getCustomFonts().forEach(({ name }) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = `${name} (custom)`;
        sel.appendChild(opt);
    });
    const custom = document.createElement('option');
    custom.value = CUSTOM_FONT_OPTION;
    custom.textContent = '＋ Custom Font…';
    sel.appendChild(custom);

    const isKnown = f => FONT_FAMILIES.some(x => x.family === f) || getCustomFonts().some(x => x.name === f);
    sel.value = selected && isKnown(selected) ? selected : FONT_FAMILIES[0].family;
}

/** Read the shadow property inputs into a props object. */
function readShadowProps() {
    return {
        x: parseFloat(dom.shadowXInput.value) || 0,
        y: parseFloat(dom.shadowYInput.value) || 0,
        blur: Math.max(0, parseFloat(dom.shadowBlurInput.value) || 0),
        color: dom.shadowColorInput.value,
        opacity: Math.max(0, Math.min(100, parseInt(dom.shadowOpacityInput.value, 10) || 0)),
    };
}

/** Push a props object into the shadow property inputs (not the model). */
function fillShadowInputs(props) {
    dom.shadowXInput.value = props.x;
    dom.shadowYInput.value = props.y;
    dom.shadowBlurInput.value = props.blur;
    dom.shadowColorInput.value = props.color;
    dom.shadowOpacityInput.value = props.opacity;
    dom.shadowOpacityLabel.textContent = props.opacity + '%';
}

/** Apply shadow props (or null = remove) to the selected text element. */
function applyShadowProps(props) {
    const el = getSelectedElement();
    if (!el || el.type !== 'text') return;
    if (props) {
        fillShadowInputs(props);
        dom.shadowPresetInput.value = 'custom';
    } else {
        fillShadowInputs({ x: 0, y: 0, blur: 0, color: '#000000', opacity: 100 });
        dom.shadowPresetInput.value = 'none';
    }
    const css = composeShadow(props);
    dom.textShadowInput.value = css === 'none' ? '' : css;
    updateElementModelAndDOM(el.id, { textShadow: css });
}

/** Populate the shadow editor UI from an element's stored CSS shadow string. */
function syncShadowUI(el) {
    const props = parseShadow(el.textShadow);
    if (props) {
        fillShadowInputs(props);
        const preset = TEXT_SHADOW_PRESETS.find(p => composeShadow(p.props) === el.textShadow);
        dom.shadowPresetInput.value = preset ? preset.name : 'custom';
    } else {
        fillShadowInputs({ x: 0, y: 0, blur: 0, spread: 0, color: '#000000', opacity: 100 });
        dom.shadowPresetInput.value = (!el.textShadow || el.textShadow === 'none') ? 'none' : 'custom';
    }
    dom.textShadowInput.value = el.textShadow && el.textShadow !== 'none' ? el.textShadow : '';
}

/** Populate the four padding inputs from an element's padding object. */
function syncPaddingUI(el) {
    const p = typeof el.padding === 'object' ? el.padding : {};
    const base = typeof el.padding === 'number' ? el.padding : 8;
    dom.paddingTopInput.value = p.top ?? base;
    dom.paddingRightInput.value = p.right ?? base;
    dom.paddingBottomInput.value = p.bottom ?? base;
    dom.paddingLeftInput.value = p.left ?? base;
}

/** Reflect an element's position/size/transform into the numeric inputs. */
function syncTransformInputs(el) {
    dom.positionXInput.value = Math.round(el.x);
    dom.positionYInput.value = Math.round(el.y);
    dom.sizeWidthInput.value = Math.round(el.width);
    dom.sizeHeightInput.value = Math.round(el.height);
    dom.rotationInput.value = Math.round(el.rotation || 0);
    dom.skewXInput.value = Math.round(el.skewX || 0);
    dom.skewYInput.value = Math.round(el.skewY || 0);
}

export function updatePropertiesPanel() {
    const el = getSelectedElement();
    if (!el) {
        dom.noSelection.style.display = 'block';
        dom.positionProperties.style.display = 'none';
        dom.textProperties.style.display = 'none';
        dom.imageProperties.style.display = 'none';
        return;
    }
    dom.noSelection.style.display = 'none';
    dom.positionProperties.style.display = 'block';
    syncTransformInputs(el);
    if (el.type === 'text') {
        dom.textProperties.style.display = 'block';
        dom.imageProperties.style.display = 'none';
        dom.textContentInput.value = el.content;
        dom.fontSizeInput.value = el.fontSize;
        dom.fontWeightInput.value = el.fontWeight || '400';
        populateFontSelect(el.fontFamily);
        dom.textColorInput.value = el.color;
        dom.textBgColorInput.value = el.bgColor === 'transparent' ? '#ffffff00' : el.bgColor;
        syncPaddingUI(el);
        syncShadowUI(el);
        const r = el.borderRadius || {};
        dom.brTLInput.value = r.tl ?? 0;
        dom.brTRInput.value = r.tr ?? 0;
        dom.brBLInput.value = r.bl ?? 0;
        dom.brBRInput.value = r.br ?? 0;
    } else {
        dom.imageProperties.style.display = 'block';
        dom.textProperties.style.display = 'none';
    }
}

/** Wire up all properties-panel controls. Call once on startup. */
export function initProperties() {
    on('selection', updatePropertiesPanel);
    on('render', updatePropertiesPanel);
    on('text-edited', content => { dom.textContentInput.value = content; });
    // Live sync while dragging/resizing, so the panel tracks position and size.
    on('transform', id => {
        const el = getSelectedElement();
        if (el && el.id === id) syncTransformInputs(el);
    });

    dom.textContentInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') updateElementModelAndDOM(el.id, { content: dom.textContentInput.value });
    });
    dom.fontSizeInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') updateElementModelAndDOM(el.id, { fontSize: parseInt(dom.fontSizeInput.value) || 24 });
    });
    dom.fontWeightInput.addEventListener('change', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') updateElementModelAndDOM(el.id, { fontWeight: dom.fontWeightInput.value });
    });
    dom.textColorInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') updateElementModelAndDOM(el.id, { color: dom.textColorInput.value });
    });
    dom.textBgColorInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (el && el.type === 'text') {
            const val = dom.textBgColorInput.value === '#ffffff00' ? 'transparent' : dom.textBgColorInput.value;
            updateElementModelAndDOM(el.id, { bgColor: val });
        }
    });
    // Remove the text box background entirely (transparent) — next to the
    // background color picker.
    dom.removeTextBgBtn.addEventListener('click', () => {
        const el = getSelectedElement();
        if (!el || el.type !== 'text') return;
        updateElementModelAndDOM(el.id, { bgColor: 'transparent' });
        dom.textBgColorInput.value = '#ffffff00';
    });
    // ── Text shadow editor: preset dropdown → fills property inputs → CSS ──
    // Build the preset options (x4) on top of None / Custom.
    TEXT_SHADOW_PRESETS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        dom.shadowPresetInput.appendChild(opt);
    });

    dom.shadowPresetInput.addEventListener('change', () => {
        const el = getSelectedElement();
        if (!el || el.type !== 'text') return;
        const name = dom.shadowPresetInput.value;
        if (name === 'none') {
            applyShadowProps(null);
            return;
        }
        const preset = TEXT_SHADOW_PRESETS.find(p => p.name === name);
        if (preset) {
            applyShadowProps(preset.props);
            dom.shadowPresetInput.value = name; // keep the preset visible until edited
        }
    });

    ['shadowXInput', 'shadowYInput', 'shadowBlurInput'].forEach(inputId => {
        dom[inputId].addEventListener('input', () => {
            const el = getSelectedElement();
            if (!el || el.type !== 'text') return;
            applyShadowProps(readShadowProps());
        });
    });
    dom.shadowColorInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el || el.type !== 'text') return;
        applyShadowProps(readShadowProps());
    });
    dom.shadowOpacityInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el || el.type !== 'text') return;
        dom.shadowOpacityLabel.textContent = dom.shadowOpacityInput.value + '%';
        applyShadowProps(readShadowProps());
    });

    // Advanced raw CSS string; empty = shadow deleted.
    dom.textShadowInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el || el.type !== 'text') return;
        const val = dom.textShadowInput.value.trim();
        updateElementModelAndDOM(el.id, { textShadow: val === '' ? 'none' : val });
        dom.shadowPresetInput.value = val === '' ? 'none' : 'custom';
        const props = val === '' ? null : parseShadow(val);
        if (props) fillShadowInputs(props);
    });

    dom.removeShadowBtn.addEventListener('click', () => {
        const el = getSelectedElement();
        if (!el || el.type !== 'text') return;
        applyShadowProps(null);
    });

    // ── Font family: built-ins + custom import through the dev-server API ──
    dom.fontFamilyInput.addEventListener('change', () => {
        const el = getSelectedElement();
        if (!el || el.type !== 'text') return;
        const val = dom.fontFamilyInput.value;
        if (val === CUSTOM_FONT_OPTION) {
            dom.customFontHint.style.display = 'block';
            dom.customFontInput.click();
            return;
        }
        dom.customFontHint.style.display = 'none';
        updateElementModelAndDOM(el.id, { fontFamily: val });
    });
    dom.customFontInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            const entry = await importCustomFont(file);
            dom.customFontHint.style.display = 'none';
            const el = getSelectedElement();
            if (el && el.type === 'text') updateElementModelAndDOM(el.id, { fontFamily: entry.name });
            populateFontSelect(el && el.type === 'text' ? el.fontFamily : undefined);
        } catch (err) {
            console.error(err);
            alert('Could not import font: ' + err.message);
        }
    });
    dom.customFontInput.addEventListener('cancel', () => {
        // File dialog dismissed without a pick: put the select back on the
        // element's actual family instead of leaving it on “Custom Font…”.
        const el = getSelectedElement();
        if (el && el.type === 'text') populateFontSelect(el.fontFamily);
    });

    // ── Corner radius: four independent corners ──
    [
        ['brTLInput', 'tl'], ['brTRInput', 'tr'], ['brBLInput', 'bl'], ['brBRInput', 'br'],
    ].forEach(([inputId, key]) => {
        dom[inputId].addEventListener('input', () => {
            const el = getSelectedElement();
            if (!el || el.type !== 'text') return;
            const v = parseInt(dom[inputId].value, 10);
            if (Number.isNaN(v)) return;
            const clamped = clamp(v, 0, 200);
            updateElementModelAndDOM(el.id, { borderRadius: { [key]: clamped } });
            dom[inputId].value = clamped;
        });
    });

    // ── Transform: rotate + skew, for both text and image elements ──
    [
        ['rotationInput', 'rotation', -180, 180],
        ['skewXInput', 'skewX', -90, 90],
        ['skewYInput', 'skewY', -90, 90],
    ].forEach(([inputId, prop, min, max]) => {
        dom[inputId].addEventListener('input', () => {
            const el = getSelectedElement();
            if (!el) return;
            const v = parseInt(dom[inputId].value, 10);
            if (Number.isNaN(v)) return;
            const clamped = clamp(v, min, max);
            updateElementModelAndDOM(el.id, { [prop]: clamped });
            dom[inputId].value = clamped;
        });
    });

    // ── Text padding: four independent sides ──
    [
        ['paddingTopInput', 'top'], ['paddingRightInput', 'right'],
        ['paddingBottomInput', 'bottom'], ['paddingLeftInput', 'left'],
    ].forEach(([inputId, side]) => {
        dom[inputId].addEventListener('input', () => {
            const el = getSelectedElement();
            if (!el || el.type !== 'text') return;
            const v = parseInt(dom[inputId].value, 10);
            if (Number.isNaN(v)) return;
            const clamped = clamp(v, 0, 120);
            updateElementModelAndDOM(el.id, { padding: { [side]: clamped } });
            dom[inputId].value = clamped;
        });
    });

    // Position: keep the element inside the canvas so it never gets lost.
    dom.positionXInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el) return;
        const v = parseInt(dom.positionXInput.value, 10);
        if (Number.isNaN(v)) return;
        const x = clamp(v, 0, Math.max(0, getCanvasWidth() - el.width));
        updateElementModelAndDOM(el.id, { x });
        dom.positionXInput.value = x;
    });
    dom.positionYInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el) return;
        const v = parseInt(dom.positionYInput.value, 10);
        if (Number.isNaN(v)) return;
        const y = clamp(v, 0, Math.max(0, getCanvasHeight() - el.height));
        updateElementModelAndDOM(el.id, { y });
        dom.positionYInput.value = y;
    });

    // Size: keep elements at least 20px and inside the canvas.
    dom.sizeWidthInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el) return;
        const v = parseInt(dom.sizeWidthInput.value, 10);
        if (Number.isNaN(v)) return;
        const w = clamp(v, 20, Math.max(20, getCanvasWidth() - el.x));
        updateElementModelAndDOM(el.id, { width: w });
        dom.sizeWidthInput.value = w;
    });
    dom.sizeHeightInput.addEventListener('input', () => {
        const el = getSelectedElement();
        if (!el) return;
        const v = parseInt(dom.sizeHeightInput.value, 10);
        if (Number.isNaN(v)) return;
        const h = clamp(v, 20, Math.max(20, getCanvasHeight() - el.y));
        updateElementModelAndDOM(el.id, { height: h });
        dom.sizeHeightInput.value = h;
    });

    dom.deleteElementBtn.addEventListener('click', () => {
        if (getSelectedElementId()) deleteElement(getSelectedElementId());
    });
    dom.deleteImageBtn.addEventListener('click', () => {
        if (getSelectedElementId()) deleteElement(getSelectedElementId());
    });
    dom.swapImageInput.addEventListener('change', e => {
        const el = getSelectedElement();
        if (!el || el.type !== 'image') return;
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => updateElementModelAndDOM(el.id, { src: ev.target.result });
        reader.readAsDataURL(file);
    });
}
