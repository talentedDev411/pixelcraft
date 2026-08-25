/**
 * store.js — Central state management with dispatch pattern for gradient editor.
 */

import { createGradient, cloneGradient, createStop, createOpacityStop, addStop } from './engine/gradient-model.js';
import { parseColorString, adjustHSL, rgbToHex, clamp } from './engine/color-utils.js';

const initialState = () => ({
    gradients: [],
    activeGradientId: null,
    selectedStopId: null,
    selectedOpacityStopId: null,
    colorFormat: 'hex',
    history: [],
    historyIndex: -1,
    theme: 'dark',
});

class Store {
    constructor() {
        this.state = initialState();
        this.listeners = new Set();
        this._initialize();
    }

    _initialize() {
        const defaultGrad = createGradient();
        this.state.gradients.push(defaultGrad);
        this.state.activeGradientId = defaultGrad.id;
        this._pushHistory();
        this._notify();
    }

    getState() {
        return this.state;
    }

    getActiveGradient() {
        return this.state.gradients.find((g) => g.id === this.state.activeGradientId) || null;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    _notify() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    _pushHistory() {
        const snapshot = JSON.parse(JSON.stringify(this.state.gradients));
        this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        this.state.history.push(snapshot);
        this.state.historyIndex = this.state.history.length - 1;
        if (this.state.history.length > 100) {
            this.state.history.shift();
            this.state.historyIndex--;
        }
    }

    dispatch(action) {
        const grad = this.getActiveGradient();
        let shouldHistory = true;

        switch (action.type) {
            case 'UPDATE_STOP_COLOR': {
                const stop = grad?.stops.find((s) => s.id === action.stopId);
                if (stop) stop.color = action.color;
                break;
            }
            case 'UPDATE_STOP_ALPHA': {
                const stop = grad?.stops.find((s) => s.id === action.stopId);
                if (stop) stop.alpha = clamp(action.alpha, 0, 1);
                break;
            }
            case 'UPDATE_STOP_POSITION': {
                const stop = grad?.stops.find((s) => s.id === action.stopId);
                if (stop) stop.position = clamp(action.position, 0, 100);
                break;
            }
            case 'ADD_STOP': {
                if (!grad) break;
                const newStop = addStop(grad, action.position);
                this.state.selectedStopId = newStop.id;
                break;
            }
            case 'REMOVE_STOP': {
                if (!grad) break;
                if (grad.stops.length <= 2) break;
                const idx = grad.stops.findIndex((s) => s.id === action.stopId);
                if (idx !== -1) {
                    grad.stops.splice(idx, 1);
                    if (this.state.selectedStopId === action.stopId) {
                        this.state.selectedStopId = grad.stops[0]?.id || null;
                    }
                }
                break;
            }
            case 'SELECT_STOP': {
                this.state.selectedStopId = action.stopId;
                this.state.selectedOpacityStopId = null;
                shouldHistory = false;
                break;
            }
            case 'SELECT_OPACITY_STOP': {
                this.state.selectedOpacityStopId = action.stopId;
                this.state.selectedStopId = null;
                shouldHistory = false;
                break;
            }
            case 'ADD_OPACITY_STOP': {
                if (!grad) break;
                const newStop = createOpacityStop(action.position, action.alpha ?? 1);
                grad.opacityStops.push(newStop);
                grad.opacityStops.sort((a, b) => a.position - b.position);
                this.state.selectedOpacityStopId = newStop.id;
                break;
            }
            case 'UPDATE_OPACITY_STOP': {
                if (!grad) break;
                const stop = grad.opacityStops.find((s) => s.id === action.stopId);
                if (stop) {
                    if (action.alpha !== undefined) stop.alpha = clamp(action.alpha, 0, 1);
                    if (action.position !== undefined) stop.position = clamp(action.position, 0, 100);
                }
                break;
            }
            case 'REMOVE_OPACITY_STOP': {
                if (!grad) break;
                const idx = grad.opacityStops.findIndex((s) => s.id === action.stopId);
                if (idx !== -1) {
                    grad.opacityStops.splice(idx, 1);
                    if (this.state.selectedOpacityStopId === action.stopId) {
                        this.state.selectedOpacityStopId = null;
                    }
                }
                break;
            }
            case 'SET_COLOR_FORMAT': {
                this.state.colorFormat = action.format;
                shouldHistory = false;
                break;
            }
            case 'SET_GRADIENT_TYPE': {
                if (!grad) break;
                const repeatingTypes = ['repeating-linear', 'repeating-radial', 'repeating-conic'];
                const baseType = action.gradientType.replace('repeating-', '');
                grad.type = baseType;
                grad.repeating = repeatingTypes.includes(action.gradientType);
                break;
            }
            case 'SET_ORIENTATION': {
                if (!grad) break;
                grad.orientation = { ...grad.orientation, ...action.orientation };
                break;
            }
            case 'SET_RADIAL_GEOMETRY': {
                if (!grad) break;
                if (action.geometry.center) {
                    grad.radial.center = { ...grad.radial.center, ...action.geometry.center };
                    delete action.geometry.center;
                }
                grad.radial = { ...grad.radial, ...action.geometry };
                break;
            }
            case 'SET_CONIC_GEOMETRY': {
                if (!grad) break;
                if (action.geometry.center) {
                    grad.conic.center = { ...grad.conic.center, ...action.geometry.center };
                    delete action.geometry.center;
                }
                grad.conic = { ...grad.conic, ...action.geometry };
                break;
            }
            case 'SET_INTERPOLATION': {
                if (!grad) break;
                grad.interpolation = { ...grad.interpolation, ...action.interpolation };
                break;
            }
            case 'REVERSE_GRADIENT': {
                if (!grad) break;
                grad.stops.forEach((s) => (s.position = 100 - s.position));
                grad.stops.sort((a, b) => a.position - b.position);
                grad.opacityStops.forEach((s) => (s.position = 100 - s.position));
                grad.opacityStops.sort((a, b) => a.position - b.position);
                if (grad.type === 'linear' && grad.orientation.mode === 'angle') {
                    grad.orientation.angle = (grad.orientation.angle + 180) % 360;
                }
                break;
            }
            case 'IMPORT_GRADIENT': {
                if (action.replaceCurrent && grad) {
                    const keepId = grad.id;
                    Object.assign(grad, action.model);
                    grad.id = keepId;
                } else {
                    const newGrad = { ...action.model, id: `grad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
                    this.state.gradients.push(newGrad);
                    this.state.activeGradientId = newGrad.id;
                    this.state.selectedStopId = newGrad.stops[newGrad.stops.length - 1]?.id || null;
                }
                break;
            }
            case 'SET_ACTIVE_GRADIENT': {
                this.state.activeGradientId = action.gradientId;
                this.state.selectedStopId = null;
                this.state.selectedOpacityStopId = null;
                shouldHistory = false;
                break;
            }
            case 'ADD_GRADIENT_LAYER': {
                const newGrad = createGradient(action.overrides);
                this.state.gradients.push(newGrad);
                this.state.activeGradientId = newGrad.id;
                break;
            }
            case 'DELETE_GRADIENT_LAYER': {
                if (this.state.gradients.length <= 1) break;
                const idx = this.state.gradients.findIndex((g) => g.id === (action.gradientId || this.state.activeGradientId));
                if (idx !== -1) {
                    this.state.gradients.splice(idx, 1);
                    this.state.activeGradientId = this.state.gradients[Math.min(idx, this.state.gradients.length - 1)]?.id;
                    this.state.selectedStopId = null;
                }
                break;
            }
            case 'TOGGLE_GRADIENT_LAYER': {
                const g = this.state.gradients.find((g) => g.id === (action.gradientId || this.state.activeGradientId));
                if (g) g.enabled = !g.enabled;
                break;
            }
            case 'ADJUST_ALL_COLORS': {
                if (!grad) break;
                grad.stops.forEach((stop) => {
                    const color = parseColorString(stop.color);
                    const adjusted = adjustHSL(color, action.hDelta, action.sDelta, action.lDelta);
                    stop.color = rgbToHex(adjusted.r, adjusted.g, adjusted.b);
                });
                break;
            }
            case 'UNDO': {
                if (this.state.historyIndex > 0) {
                    this.state.historyIndex--;
                    this.state.gradients = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
                    if (!this.state.gradients.find((g) => g.id === this.state.activeGradientId)) {
                        this.state.activeGradientId = this.state.gradients[0]?.id || null;
                    }
                    this.state.selectedStopId = null;
                }
                shouldHistory = false;
                break;
            }
            case 'REDO': {
                if (this.state.historyIndex < this.state.history.length - 1) {
                    this.state.historyIndex++;
                    this.state.gradients = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
                    if (!this.state.gradients.find((g) => g.id === this.state.activeGradientId)) {
                        this.state.activeGradientId = this.state.gradients[0]?.id || null;
                    }
                    this.state.selectedStopId = null;
                }
                shouldHistory = false;
                break;
            }
            case 'SET_THEME': {
                this.state.theme = action.theme;
                shouldHistory = false;
                break;
            }
            default:
                return;
        }

        if (shouldHistory) {
            this._pushHistory();
        }
        this._notify();
    }
}

let storeInstance = null;

export function getStore() {
    if (!storeInstance) {
        storeInstance = new Store();
    }
    return storeInstance;
}

export function resetStore() {
    storeInstance = null;
}
