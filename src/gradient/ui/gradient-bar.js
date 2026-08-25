/**
 * gradient-bar.js — Interactive gradient stop bar.
 */

import { getStore } from '../store.js';
import { parseColorString, formatColor } from '../engine/color-utils.js';

export function createGradientBar(container) {
    const store = getStore();

    container.innerHTML = `
        <div class="ge-gradient-bar-wrapper">
            <div class="ge-gradient-bar" id="ge-gradient-bar">
                <div class="ge-gradient-bar-track" id="ge-gradient-bar-track"></div>
            </div>
        </div>
    `;

    const track = container.querySelector('#ge-gradient-bar-track');
    const bar = container.querySelector('#ge-gradient-bar');

    function render() {
        const state = store.getState();
        const grad = state.gradients.find((g) => g.id === state.activeGradientId);
        if (!grad) return;

        renderBarBackground(track, grad, state.colorFormat);
        renderStops(track, grad, state.selectedStopId);
    }

    function renderBarBackground(trackEl, grad, colorFormat) {
        const css = `linear-gradient(to right, ${grad.stops
            .map((s) => {
                const color = parseColorString(s.color);
                return `${formatColor(color, colorFormat, s.alpha < 1)} ${s.position}%`;
            })
            .join(', ')})`;
        trackEl.style.background = css;
    }

    function renderStops(trackEl, grad, selectedId) {
        trackEl.querySelectorAll('.ge-stop-handle').forEach((el) => el.remove());

        grad.stops.forEach((stop) => {
            const handle = document.createElement('div');
            handle.className = 'ge-stop-handle' + (stop.id === selectedId ? ' selected' : '');
            handle.dataset.stopId = stop.id;
            handle.style.left = stop.position + '%';
            handle.style.backgroundColor = stop.color;
            if (stop.alpha < 1) handle.style.opacity = stop.alpha;

            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                store.dispatch({ type: 'SELECT_STOP', stopId: stop.id });
                const startX = e.clientX;
                const startPos = stop.position;
                const barRect = trackEl.getBoundingClientRect();
                const onMove = (ev) => {
                    const dx = ev.clientX - startX;
                    const dp = (dx / barRect.width) * 100;
                    const newPos = Math.max(0, Math.min(100, startPos + dp));
                    store.dispatch({ type: 'UPDATE_STOP_POSITION', stopId: stop.id, position: Math.round(newPos * 10) / 10 });
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });

            handle.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                document.dispatchEvent(new CustomEvent('open-color-picker', { detail: { stopId: stop.id } }));
            });

            trackEl.appendChild(handle);
        });
    }

    bar.addEventListener('click', (e) => {
        if (e.target.closest('.ge-stop-handle')) return;
        const rect = bar.getBoundingClientRect();
        const position = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
        store.dispatch({ type: 'ADD_STOP', position: Math.max(0, Math.min(100, position)) });
    });

    store.subscribe(render);
    render();
}
