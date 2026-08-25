/**
 * color-picker.js — Visual color picker with saturation/lightness area, hue slider, alpha slider.
 */

import { getStore } from '../store.js';
import { parseColorString, rgbToHsl, hslToRgb, rgbToHex, clamp } from '../engine/color-utils.js';

let pickerEl = null;
let currentStopId = null;
let currentHSL = { h: 0, s: 100, l: 50 };
let currentAlpha = 1;

export function initColorPicker() {
    pickerEl = document.createElement('div');
    pickerEl.className = 'ge-color-picker-modal';
    pickerEl.id = 'ge-color-picker-modal';
    pickerEl.innerHTML = `
        <div class="ge-cp-backdrop" id="ge-cp-backdrop"></div>
        <div class="ge-cp-dialog">
            <div class="ge-cp-header">
                <span class="ge-cp-title">Color Picker</span>
                <button class="ge-cp-close" id="ge-cp-close">✕</button>
            </div>
            <div class="ge-cp-body">
                <div class="ge-cp-sl-area" id="ge-cp-sl-area">
                    <canvas id="ge-cp-sl-canvas" width="256" height="256"></canvas>
                    <div class="ge-cp-sl-cursor" id="ge-cp-sl-cursor"></div>
                </div>
                <div class="ge-cp-sliders">
                    <div class="ge-cp-slider-row">
                        <label class="ge-cp-slider-label">H</label>
                        <div class="ge-cp-hue-wrap">
                            <input type="range" id="ge-cp-hue" min="0" max="360" value="0" class="ge-cp-hue-slider" />
                        </div>
                    </div>
                    <div class="ge-cp-slider-row">
                        <label class="ge-cp-slider-label">A</label>
                        <div class="ge-cp-alpha-wrap" id="ge-cp-alpha-wrap">
                            <input type="range" id="ge-cp-alpha" min="0" max="100" value="100" class="ge-cp-alpha-slider" />
                        </div>
                    </div>
                </div>
                <div class="ge-cp-inputs">
                    <div class="ge-cp-input-row">
                        <label>HEX</label>
                        <input type="text" id="ge-cp-hex" class="ge-input-text ge-cp-input" maxlength="9" />
                    </div>
                    <div class="ge-cp-input-row ge-cp-rgb-row">
                        <div class="ge-cp-rgb-field"><label>R</label><input type="number" id="ge-cp-r" min="0" max="255" class="ge-input-number ge-cp-input" /></div>
                        <div class="ge-cp-rgb-field"><label>G</label><input type="number" id="ge-cp-g" min="0" max="255" class="ge-input-number ge-cp-input" /></div>
                        <div class="ge-cp-rgb-field"><label>B</label><input type="number" id="ge-cp-b" min="0" max="255" class="ge-input-number ge-cp-input" /></div>
                    </div>
                    <div class="ge-cp-input-row">
                        <label>A</label>
                        <input type="number" id="ge-cp-alpha-num" min="0" max="100" class="ge-input-number ge-cp-input" />
                        <span class="ge-unit">%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(pickerEl);

    pickerEl.querySelector('#ge-cp-backdrop').addEventListener('click', closePicker);
    pickerEl.querySelector('#ge-cp-close').addEventListener('click', closePicker);

    // SL area interaction
    const slArea = pickerEl.querySelector('#ge-cp-sl-area');
    const slCursor = pickerEl.querySelector('#ge-cp-sl-cursor');
    let slDragging = false;

    function updateSLFromEvent(e) {
        const rect = slArea.getBoundingClientRect();
        const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        currentHSL.s = Math.round(x * 100);
        currentHSL.l = Math.round((1 - y) * 100);
        applyColorFromHSL();
    }

    slArea.addEventListener('mousedown', (e) => { slDragging = true; updateSLFromEvent(e); });
    document.addEventListener('mousemove', (e) => { if (slDragging) updateSLFromEvent(e); });
    document.addEventListener('mouseup', () => { slDragging = false; });

    // Hue slider
    pickerEl.querySelector('#ge-cp-hue').addEventListener('input', (e) => {
        currentHSL.h = parseInt(e.target.value);
        applyColorFromHSL();
    });

    // Alpha slider
    pickerEl.querySelector('#ge-cp-alpha').addEventListener('input', (e) => {
        currentAlpha = parseInt(e.target.value) / 100;
        pickerEl.querySelector('#ge-cp-alpha-num').value = e.target.value;
        applyColorToStore();
    });

    // Alpha numeric
    pickerEl.querySelector('#ge-cp-alpha-num').addEventListener('change', (e) => {
        currentAlpha = clamp(parseInt(e.target.value) || 0, 0, 100) / 100;
        pickerEl.querySelector('#ge-cp-alpha').value = Math.round(currentAlpha * 100);
        applyColorToStore();
    });

    // HEX input
    pickerEl.querySelector('#ge-cp-hex').addEventListener('change', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        const c = parseColorString(val);
        currentHSL = rgbToHsl(c.r, c.g, c.b);
        currentAlpha = c.a;
        syncAllInputs();
        applyColorFromHSL();
    });

    // RGB inputs
    ['ge-cp-r', 'ge-cp-g', 'ge-cp-b'].forEach((id) => {
        pickerEl.querySelector('#' + id).addEventListener('change', () => {
            const r = clamp(parseInt(pickerEl.querySelector('#ge-cp-r').value) || 0, 0, 255);
            const g = clamp(parseInt(pickerEl.querySelector('#ge-cp-g').value) || 0, 0, 255);
            const b = clamp(parseInt(pickerEl.querySelector('#ge-cp-b').value) || 0, 0, 255);
            currentHSL = rgbToHsl(r, g, b);
            syncHSLInputs();
            drawSLArea();
            applyColorToStore();
        });
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && pickerEl.classList.contains('open')) closePicker();
    });

    // Listen for open event
    document.addEventListener('open-color-picker', (e) => {
        openPicker(e.detail.stopId);
    });
}

function openPicker(stopId) {
    currentStopId = stopId;
    const store = getStore();
    const state = store.getState();
    const grad = state.gradients.find((g) => g.id === state.activeGradientId);
    const stop = grad?.stops.find((s) => s.id === stopId);
    if (!stop) return;
    const color = parseColorString(stop.color);
    currentHSL = rgbToHsl(color.r, color.g, color.b);
    currentAlpha = stop.alpha;
    syncAllInputs();
    drawSLArea();
    updateSLCursor();
    pickerEl.classList.add('open');
}

function closePicker() {
    pickerEl.classList.remove('open');
    currentStopId = null;
}

function syncAllInputs() {
    syncRGBInputs();
    syncHSLInputs();
    const hexInput = pickerEl.querySelector('#ge-cp-hex');
    hexInput.value = rgbToHex(
        ...Object.values(hslToRgb(currentHSL.h, currentHSL.s, currentHSL.l))
    );
    const alphaSlider = pickerEl.querySelector('#ge-cp-alpha');
    const alphaNum = pickerEl.querySelector('#ge-cp-alpha-num');
    alphaSlider.value = Math.round(currentAlpha * 100);
    alphaNum.value = Math.round(currentAlpha * 100);
    const hueSlider = pickerEl.querySelector('#ge-cp-hue');
    hueSlider.value = currentHSL.h;
    updateAlphaSliderBg();
}

function syncRGBInputs() {
    const rgb = hslToRgb(currentHSL.h, currentHSL.s, currentHSL.l);
    pickerEl.querySelector('#ge-cp-r').value = rgb.r;
    pickerEl.querySelector('#ge-cp-g').value = rgb.g;
    pickerEl.querySelector('#ge-cp-b').value = rgb.b;
}

function syncHSLInputs() {
    pickerEl.querySelector('#ge-cp-hsl-h')?.setAttribute('value', currentHSL.h);
    pickerEl.querySelector('#ge-cp-hsl-s')?.setAttribute('value', currentHSL.s);
    pickerEl.querySelector('#ge-cp-hsl-l')?.setAttribute('value', currentHSL.l);
}

function drawSLArea() {
    const canvas = pickerEl.querySelector('#ge-cp-sl-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Draw hue as base
    const hueRgb = hslToRgb(currentHSL.h, 100, 50);
    ctx.fillStyle = `rgb(${hueRgb.r},${hueRgb.g},${hueRgb.b})`;
    ctx.fillRect(0, 0, w, h);

    // White gradient (left to right)
    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, h);

    // Black gradient (top to bottom)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, h);
}

function updateSLCursor() {
    const cursor = pickerEl.querySelector('#ge-cp-sl-cursor');
    const area = pickerEl.querySelector('#ge-cp-sl-area');
    const x = (currentHSL.s / 100) * area.offsetWidth;
    const y = (1 - currentHSL.l / 100) * area.offsetHeight;
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
}

function updateAlphaSliderBg() {
    const wrap = pickerEl.querySelector('#ge-cp-alpha-wrap');
    const rgb = hslToRgb(currentHSL.h, currentHSL.s, currentHSL.l);
    wrap.style.background = `linear-gradient(to right, transparent, rgb(${rgb.r},${rgb.g},${rgb.b}))`;
}

function applyColorFromHSL() {
    const rgb = hslToRgb(currentHSL.h, currentHSL.s, currentHSL.l);
    syncRGBInputs();
    syncHSLInputs();
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    pickerEl.querySelector('#ge-cp-hex').value = hex;
    drawSLArea();
    updateSLCursor();
    updateAlphaSliderBg();
    applyColorToStore();
}

function applyColorToStore() {
    if (!currentStopId) return;
    const rgb = hslToRgb(currentHSL.h, currentHSL.s, currentHSL.l);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    const store = getStore();
    store.dispatch({ type: 'UPDATE_STOP_COLOR', stopId: currentStopId, color: hex });
    store.dispatch({ type: 'UPDATE_STOP_ALPHA', stopId: currentStopId, alpha: currentAlpha });
}
