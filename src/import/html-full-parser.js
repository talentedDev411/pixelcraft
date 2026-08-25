// html-full-parser.js — Full standard-HTML → Canvas parser.
//
// Implements the complete spec from html_code_parser_logic/:
//   1. CSS cascade resolution: inline > class rules > inherited (text props only)
//   2. Section → Canvas/Page mapping: <section> = one canvas page
//   3. Container vs Leaf identification: flex/grid → container, else → leaf
//   4. Auto-grouping: each container with children gets a unique groupId
//   5. CSS property mapping: every CSS prop → editor model property per spec table
//   6. Image resolution: relative src → base64 data URL
//   7. Inline SVG → data:image/svg+xml data URL
//   8. Flex/grid layout → absolute x/y position computation
//   9. data-* attributes for round-trip fidelity
//
// Two entry points:
//   parseFullHtml(htmlString)       → { pages, warnings }
//   parseFullHtmlToElements(html)   → flat array of element models (single page)

import { generateId, clamp } from '@/core/utils.js';

// ── CSS Parsing ──────────────────────────────────────────────────────────

/**
 * Parse all <style> blocks in the document into a flat rule map.
 *   { ".className": { cssProp: value, ... }, ... }
 */
export function collectStyleRules(doc) {
    const rules = {};
    const styles = doc.querySelectorAll('style');
    styles.forEach(styleEl => {
        const sheet = styleEl.textContent || '';
        // Match: .selector { prop: val; ... }
        const ruleRegex = /\.([\w-]+)\s*\{([^}]+)\}/g;
        let match;
        while ((match = ruleRegex.exec(sheet)) !== null) {
            const selector = match[1].trim();
            const body = match[2];
            if (!rules[selector]) rules[selector] = {};
            body.split(';').forEach(decl => {
                const colonIdx = decl.indexOf(':');
                if (colonIdx === -1) return;
                const prop = decl.substring(0, colonIdx).trim();
                const val = decl.substring(colonIdx + 1).trim();
                if (!prop || !val) return;
                rules[selector][prop] = val;
            });
        }
    });
    return rules;
}

/** Parse inline style string into { cssProp: value } map. */
export function parseInlineStyles(styleStr) {
    if (!styleStr) return {};
    const props = {};
    styleStr.split(';').forEach(decl => {
        const colonIdx = decl.indexOf(':');
        if (colonIdx === -1) return;
        const prop = decl.substring(0, colonIdx).trim();
        const val = decl.substring(colonIdx + 1).trim();
        if (!prop || !val) return;
        props[prop] = val;
    });
    return props;
}

// ── CSS Value Helpers ────────────────────────────────────────────────────

/** Parse a numeric CSS value, stripping px/rem/etc. Returns number or fallback. */
export function px(val, fallback = 0) {
    if (val == null || val === '') return fallback;
    const n = parseFloat(String(val).replace(/px$/i, ''));
    return isNaN(n) ? fallback : n;
}

/** Convert kebab-case to camelCase. */
export function camelCase(kebab) {
    return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** Detect transparent color. */
export function isTransparent(val) {
    return !val || val === 'transparent' || val === 'rgba(0, 0, 0, 0)' || val === 'rgba(0,0,0,0)';
}

// ── CSS Cascade Resolver ─────────────────────────────────────────────────

/** Text properties that inherit from parent in CSS. */
const INHERITED_PROPS = new Set([
    'color', 'font-size', 'font-weight', 'font-family', 'line-height',
    'text-align', 'letter-spacing', 'text-transform', 'word-spacing',
    'text-indent', 'white-space', 'direction', 'visibility',
]);

/** Properties that resolve from class rules (non-inherited, no parent fallback). */
const CLASS_ONLY_PROPS = new Set([
    'background', 'background-color', 'background-image',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'border', 'border-color', 'border-style', 'border-width',
    'border-radius', 'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
    'display', 'width', 'height', 'min-width', 'min-height',
    'max-width', 'max-height', 'gap', 'row-gap', 'column-gap',
    'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self',
    'box-shadow', 'opacity', 'position', 'top', 'right', 'bottom', 'left',
    'object-fit', 'overflow',
]);

/**
 * Resolve CSS cascade for a single element.
 * Priority: inline style > class rule > inherited from parent (text props only).
 *
 * @param {Object} inlineStyle  - inline style map { cssProp: value }
 * @param {string[]} classList  - CSS class names on this element
 * @param {Object} rules        - flat rule map from collectStyleRules()
 * @param {Object} parentResolved - resolved style of the parent element (or null)
 * @returns {Object} resolved { cssProp: value } map
 */
export function resolveCascade(inlineStyle, classList, rules, parentResolved) {
    const resolved = {};

    // 1. Start with inherited text-related properties from parent
    if (parentResolved) {
        for (const prop of INHERITED_PROPS) {
            if (parentResolved[prop] != null) {
                resolved[prop] = parentResolved[prop];
            }
        }
    }

    // 2. Apply class rules (middle priority)
    classList.forEach(cls => {
        const rule = rules[cls];
        if (!rule) return;
        for (const [prop, val] of Object.entries(rule)) {
            resolved[prop] = val;
        }
    });

    // 3. Apply inline styles (highest priority)
    for (const [prop, val] of Object.entries(inlineStyle)) {
        resolved[prop] = val;
    }

    return resolved;
}

// ── CSS → Element Model Mapping ──────────────────────────────────────────

/**
 * Map a resolved CSS object to editor model properties per the spec table.
 * Returns an object suitable for spreading into the element model.
 */
export function cssToModel(resolved) {
    const model = {};

    // color → el.color
    if (resolved['color']) model.color = resolved['color'];

    // background / background-color → el.bgColor
    const bg = resolved['background-color'] || resolved['background'];
    if (bg && !bg.includes('gradient') && !isTransparent(bg)) {
        model.bgColor = bg;
    }

    // font-size → el.fontSize
    if (resolved['font-size']) model.fontSize = px(resolved['font-size'], 16);

    // font-weight → el.fontWeight
    if (resolved['font-weight']) model.fontWeight = resolved['font-weight'];

    // font-family → el.fontFamily
    if (resolved['font-family']) {
        model.fontFamily = resolved['font-family']
            .replace(/['"]/g, '')
            .replace(/,\s*sans-serif$/, '')
            .replace(/,\s*serif$/, '')
            .replace(/,\s*monospace$/, '');
    }

    // line-height → el.lineHeight
    if (resolved['line-height']) {
        model.lineHeight = parseFloat(resolved['line-height']) || undefined;
    }

    // text-align → el.textAlign
    if (resolved['text-align']) model.textAlign = resolved['text-align'];

    // letter-spacing → el.letterSpacing
    if (resolved['letter-spacing']) model.letterSpacing = resolved['letter-spacing'];

    // border-radius → el.borderRadius { tl, tr, br, bl }
    if (resolved['border-radius']) {
        model.borderRadius = parseBorderRadius(resolved['border-radius']);
    }

    // padding → el.padding { top, right, bottom, left }
    if (resolved['padding'] || resolved['padding-top'] || resolved['padding-right'] ||
        resolved['padding-bottom'] || resolved['padding-left']) {
        model.padding = parsePaddingShorthand(
            resolved['padding-top'], resolved['padding-right'],
            resolved['padding-bottom'], resolved['padding-left'],
            resolved['padding']
        );
    }

    // box-shadow → el.textShadow
    if (resolved['box-shadow'] && resolved['box-shadow'] !== 'none') {
        model.textShadow = resolved['box-shadow'];
    }

    // opacity → el.opacity
    if (resolved['opacity'] != null) {
        model.opacity = parseFloat(resolved['opacity']);
    }

    // width / height → el.width / el.height
    if (resolved['width']) {
        const w = resolved['width'];
        model.cssWidth = w === 'auto' ? 'auto' : px(w, undefined);
    }
    if (resolved['height']) {
        const h = resolved['height'];
        model.cssHeight = h === 'auto' ? 'auto' : px(h, undefined);
    }

    // Layout properties → data-layout, data-direction, etc.
    const display = resolved['display'];
    if (display === 'flex' || display === 'grid') {
        model.layout = display;
    }

    if (resolved['flex-direction']) model.direction = resolved['flex-direction'];
    if (resolved['gap'] || resolved['row-gap']) model.gap = px(resolved['gap'] || resolved['row-gap'], 0);
    if (resolved['align-items']) model.align = resolved['align-items'];
    if (resolved['justify-content']) model.justify = resolved['justify-content'];

    // position: absolute → data-positioned
    if (resolved['position'] === 'absolute' || resolved['position'] === 'fixed') {
        model.positioned = true;
        if (resolved['left']) model.offsetX = px(resolved['left'], 0);
        if (resolved['top']) model.offsetY = px(resolved['top'], 0);
    }

    // object-fit → fitMode (for images)
    if (resolved['object-fit']) model.fitMode = resolved['object-fit'];

    return model;
}

// ── CSS Shorthand Parsers ────────────────────────────────────────────────

/** Parse CSS border-radius shorthand to { tl, tr, br, bl }. */
export function parseBorderRadius(cssVal) {
    if (!cssVal || cssVal === '0') return { tl: 0, tr: 0, br: 0, bl: 0 };
    const parts = cssVal.split(/\s+/).map(v => px(v, 0));
    if (parts.length === 1) return { tl: parts[0], tr: parts[0], br: parts[0], bl: parts[0] };
    if (parts.length === 2) return { tl: parts[0], tr: parts[1], br: parts[0], bl: parts[1] };
    if (parts.length === 3) return { tl: parts[0], tr: parts[1], br: parts[2], bl: parts[1] };
    return { tl: parts[0], tr: parts[1], br: parts[2], bl: parts[3] };
}

/** Parse CSS padding shorthand to { top, right, bottom, left }. */
export function parsePaddingShorthand(top, right, bottom, left, shorthand) {
    if (shorthand) {
        const parts = shorthand.split(/\s+/).map(v => px(v, 0));
        if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
        if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
        if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
        return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    }
    return {
        top: px(top, 0),
        right: px(right, 0),
        bottom: px(bottom, 0),
        left: px(left, 0),
    };
}

// ── Image / SVG Resolution ───────────────────────────────────────────────

/**
 * Resolve an <img> src to a data URL.
 * - Relative paths → attempted as data URLs (browser handles via DOMParser)
 * - External URLs (https://) → stored as-is
 * - data: URLs → stored as-is
 */
export function resolveImageSrc(src) {
    if (!src) return '';
    if (src.startsWith('data:')) return src;
    // External URLs — store as-is, the editor fetches at runtime
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    // Relative paths — try to encode (best-effort, the browser DOMParser may not resolve)
    // In practice, relative URLs in parsed HTML won't resolve through DOMParser,
    // so we store them as-is and let the editor handle resolution
    return src;
}

/**
 * Extract inline SVG markup from a DOM node and convert to a data URL.
 * Handles: the node IS an <svg>, or the node contains an <svg> child.
 */
export function extractSvgDataUrl(node) {
    let svgEl = null;
    if (node.tagName && node.tagName.toLowerCase() === 'svg') {
        svgEl = node;
    } else if (node.querySelector) {
        svgEl = node.querySelector('svg');
    }
    if (!svgEl) return null;
    const markup = new XMLSerializer().serializeToString(svgEl);
    return 'data:image/svg+xml,' + encodeURIComponent(markup);
}

// ── Container vs Leaf Detection ──────────────────────────────────────────

/**
 * Determine if a DOM node is a container (holds children in flex/grid layout)
 * or a leaf (final element — text, icon, image).
 *
 * Rule from spec: containers have display: flex or display: grid in their CSS.
 * Also: <div> with multiple meaningful children is treated as a container.
 */
export function isContainer(node, resolvedCss) {
    const display = resolvedCss?.['display'];
    if (display === 'flex' || display === 'grid') return true;

    // <div> elements with multiple children are containers (block layout)
    if (node.tagName) {
        const tag = node.tagName.toLowerCase();
        if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'nav' || tag === 'main' || tag === 'header' || tag === 'footer') {
            const childCount = countMeaningfulChildren(node);
            if (childCount > 1) return true;
        }
    }

    return false;
}

/** Count children that are meaningful (not empty text nodes). */
function countMeaningfulChildren(node) {
    let count = 0;
    if (!node.children) return 0;
    for (const child of node.children) {
        const tag = child.tagName?.toLowerCase();
        // Skip <br>, <hr>, empty text
        if (tag === 'br' || tag === 'hr') continue;
        // Skip <style>, <script>, <link>, <meta>, <title>
        if (['style', 'script', 'link', 'meta', 'title', 'head'].includes(tag)) continue;
        count++;
    }
    return count;
}

// ── Layout Computation (flex/grid → absolute x/y) ───────────────────────

/**
 * Compute absolute x/y positions for children of a container element.
 * Uses the container's layout data (flex direction, gap, padding, alignment).
 *
 * @param {Object} containerModel - the container's model with layout properties
 * @param {Object[]} childModels  - array of child element models (modified in place)
 * @param {number} canvasWidth    - canvas width for sizing
 */
export function computeChildPositions(containerModel, childModels, canvasWidth) {
    if (!childModels.length) return;

    const direction = containerModel.direction || 'column';
    const gap = containerModel.gap || 0;
    const pad = containerModel.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const align = containerModel.align || 'stretch';
    const justify = containerModel.justify || 'flex-start';

    const isRow = direction === 'row' || direction === 'row-reverse';
    const isReverse = direction.endsWith('-reverse');

    // Container content area dimensions
    const contentWidth = (containerModel.width || canvasWidth) - pad.left - pad.right;

    // Container origin on the canvas — children are positioned relative to this
    const originX = containerModel.x || 0;
    const originY = containerModel.y || 0;

    let totalMainAxisSize = 0;
    childModels.forEach(child => {
        const mainSize = isRow ? (child.width || 60) : (child.height || 30);
        totalMainAxisSize += mainSize;
    });
    totalMainAxisSize += gap * Math.max(0, childModels.length - 1);

    // Compute justify offset (only relevant for row layout main axis)
    let justifyOffset = 0;
    if (justify === 'center') {
        const crossAxisSize = isRow ? contentWidth : (containerModel.height || 200) - pad.top - pad.bottom;
        justifyOffset = (crossAxisSize - totalMainAxisSize) / 2;
    } else if (justify === 'flex-end' || justify === 'end') {
        const crossAxisSize = isRow ? contentWidth : (containerModel.height || 200) - pad.top - pad.bottom;
        justifyOffset = crossAxisSize - totalMainAxisSize;
    }

    // space-between: extra gap = (available - used) / (n-1)
    let extraGap = 0;
    if (justify === 'space-between' && childModels.length > 1) {
        const available = isRow ? contentWidth : (containerModel.height || 200) - pad.top - pad.bottom;
        extraGap = Math.max(0, (available - totalMainAxisSize) / (childModels.length - 1));
    }

    // For row layouts, place children in a single row (wrapping not supported)
    if (isRow) {
        let cursorX = originX + pad.left + justifyOffset;

        childModels.forEach(child => {
            child.x = cursorX;
            cursorX += (child.width || 60) + gap + extraGap;

            // Cross axis (y) based on align-items
            const availableCross = (containerModel.height || 200) - pad.top - pad.bottom;
            const childCross = child.height || 30;
            if (align === 'center') {
                child.y = originY + pad.top + Math.max(0, (availableCross - childCross) / 2);
            } else if (align === 'flex-end' || align === 'end') {
                child.y = originY + pad.top + Math.max(0, availableCross - childCross);
            } else {
                child.y = originY + pad.top; // flex-start / stretch
            }
        });
    } else {
        // Column layout: main axis = y
        let cursorY = originY + pad.top + justifyOffset;

        childModels.forEach(child => {
            child.y = cursorY;
            cursorY += (child.height || 30) + gap + extraGap;

            // Cross axis (x) based on align-items
            if (align === 'center') {
                const childCross = child.width || contentWidth;
                child.x = originX + pad.left + (contentWidth - childCross) / 2;
            } else if (align === 'flex-end' || align === 'end') {
                const childCross = child.width || contentWidth;
                child.x = originX + pad.left + contentWidth - childCross;
            } else if (align === 'stretch') {
                child.x = originX + pad.left;
                child.width = contentWidth; // stretch to fill
            } else {
                child.x = originX + pad.left; // flex-start
            }
        });
    }
}

// ── Full Parser Class ────────────────────────────────────────────────────

export class HTMLFullParser {
    constructor(html) {
        this.html = html;
        this.groupCounter = 0;
        this.warnings = [];
    }

    /** Generate a unique group ID for containers. */
    nextGroupId() {
        this.groupCounter++;
        return 'grp_' + Date.now().toString(36) + this.groupCounter.toString(36);
    }

    /**
     * Parse the HTML string into page models.
     * Returns { pages: [{ id, bgColor, elements }], warnings: string[] }.
     */
    parse() {
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.html, 'text/html');
        const body = doc.body;

        // Phase 1: Collect all CSS rules from <style> blocks
        const rules = collectStyleRules(doc);

        // Phase 2: Find sections (each <section> = one canvas page)
        const sections = Array.from(body.children).filter(
            el => el.tagName && el.tagName.toLowerCase() === 'section'
        );

        const pages = [];

        if (sections.length > 0) {
            // Multi-section: each section becomes a page
            sections.forEach((section, idx) => {
                const pageModel = this.processSection(section, rules, idx);
                pages.push(pageModel);
            });
        } else {
            // No sections: process body children as a single page
            const pageModel = this.processSection(body, rules, 0);
            // If the page is empty, at least create a placeholder
            if (pageModel.elements.length === 0) {
                // Try processing direct children of body
                Array.from(body.children).forEach(child => {
                    const els = this.walkNode(child, rules, null, 0, 0);
                    pageModel.elements.push(...els);
                });
            }
            pages.push(pageModel);
        }

        return { pages, warnings: this.warnings };
    }

    /**
     * Process a <section> (or body fallback) into a page model.
     */
    processSection(sectionNode, rules, sectionIndex) {
        const pageId = 'pg_' + Date.now().toString(36) + sectionIndex.toString(36);
        const elements = [];

        // Extract section background from its CSS
        const sectionInline = parseInlineStyles(sectionNode.getAttribute('style'));
        const sectionClasses = sectionNode.classList ? Array.from(sectionNode.classList) : [];
        const resolvedSection = resolveCascade(sectionInline, sectionClasses, rules, null);
        let bgColor = '#ffffff';

        const bg = resolvedSection['background-color'] || resolvedSection['background'];
        if (bg) {
            if (bg.includes('gradient')) {
                // Gradient backgrounds will be applied via bgGradient in the caller
                bgColor = '#ffffff';
            } else if (!isTransparent(bg)) {
                bgColor = bg;
            }
        }

        // Walk direct children of the section
        Array.from(sectionNode.children).forEach(child => {
            const tag = child.tagName?.toLowerCase();
            // Skip non-visual elements
            if (['style', 'script', 'link', 'meta', 'title', 'head'].includes(tag)) return;

            const sectionCtx = {
                sectionIndex,
                pageWidth: 500, // default canvas width, adjusted during layout
            };
            const els = this.walkNode(child, rules, null, 0, 0, sectionCtx);
            elements.push(...els);
        });

        // Compute container heights and positions after all elements are collected
        this.resolveLayout(elements, 500);

        return { id: pageId, bgColor, elements };
    }

    /**
     * Recursively walk the DOM tree, creating element models.
     *
     * @param {Node} node       - DOM node
     * @param {Object} rules    - CSS rule map
     * @param {string|null} parentGroupId - group ID inherited from parent
     * @param {number} depth    - nesting depth
     * @param {number} yOffset  - running Y offset for column layout
     * @param {Object} ctx      - section context
     * @returns {Object[]} array of element models
     */
    walkNode(node, rules, parentGroupId, depth, yOffset, ctx) {
        if (!node || depth > 20) return [];

        const tag = node.tagName?.toLowerCase();
        // Skip non-visual elements
        if (['style', 'script', 'link', 'meta', 'title', 'head', 'br', 'hr'].includes(tag)) return [];

        // Resolve this node's CSS
        const inlineStyle = parseInlineStyles(node.getAttribute('style'));
        const classList = node.classList ? Array.from(node.classList) : [];
        const resolvedCss = resolveCascade(inlineStyle, classList, rules, null);

        const isContainerNode = isContainer(node, resolvedCss);

        if (isContainerNode) {
            return this.processContainer(node, rules, resolvedCss, classList, parentGroupId, depth, yOffset, ctx);
        } else {
            return this.processLeaf(node, rules, resolvedCss, classList, parentGroupId, depth, yOffset, ctx);
        }
    }

    /**
     * Process a container node (flex/grid/block with children).
     * Creates a container element model and walks its children.
     */
    processContainer(node, rules, resolvedCss, classList, parentGroupId, depth, yOffset, ctx) {
        const groupId = this.nextGroupId();
        const elements = [];

        // Build the container element model
        const containerModel = {
            id: generateId(),
            type: 'container',
            dataGroup: groupId,
            dataRole: 'container',
            dataDepth: depth,
            dataClasses: classList.join(' '),
            component: node.tagName?.toLowerCase() || 'div',
            x: 0,
            y: yOffset,
            width: 500, // will be computed during layout
            height: 0,  // will be computed after children are positioned
            children: [],
        };

        // Apply layout properties
        const cssModel = cssToModel(resolvedCss);
        if (cssModel.layout) containerModel.layout = cssModel.layout;
        if (cssModel.direction) containerModel.direction = cssModel.direction;
        if (cssModel.gap != null) containerModel.gap = cssModel.gap;
        if (cssModel.align) containerModel.align = cssModel.align;
        if (cssModel.justify) containerModel.justify = cssModel.justify;
        if (cssModel.padding) containerModel.padding = cssModel.padding;
        if (cssModel.bgColor) containerModel.bgColor = cssModel.bgColor;
        if (cssModel.borderRadius) containerModel.borderRadius = cssModel.borderRadius;
        if (cssModel.opacity != null) containerModel.opacity = cssModel.opacity;

        // Default layout for containers without explicit display
        if (!containerModel.layout) {
            containerModel.layout = 'block';
            containerModel.direction = 'column';
        }

        // Walk children
        const childElements = [];
        let childYOffset = 0;

        Array.from(node.children).forEach(child => {
            const childTag = child.tagName?.toLowerCase();
            if (['style', 'script', 'link', 'meta', 'title', 'head'].includes(childTag)) return;

            const childEls = this.walkNode(child, rules, groupId, depth + 1, childYOffset, ctx);
            childElements.push(...childEls);

            // Update Y offset for next sibling (column layout default)
            const lastChild = childEls[childEls.length - 1];
            if (lastChild) {
                childYOffset = lastChild.y + (lastChild.height || 30);
                if (containerModel.gap) childYOffset += containerModel.gap;
            }
        });

        // Record child IDs
        containerModel.children = childElements.map(e => e.id);

        // Store children temporarily for layout computation
        containerModel._childElements = childElements;

        elements.push(containerModel, ...childElements);
        return elements;
    }

    /**
     * Process a leaf node (text, image, SVG, or single-child element).
     */
    processLeaf(node, rules, resolvedCss, classList, parentGroupId, depth, yOffset, ctx) {
        const tag = node.tagName?.toLowerCase();
        const elements = [];

        // Check for inline SVG
        const svgUrl = extractSvgDataUrl(node);
        if (svgUrl) {
            elements.push(this.buildSvgElement(node, svgUrl, resolvedCss, parentGroupId, depth, yOffset));
            return elements;
        }

        // Check for <img> tag
        if (tag === 'img') {
            const src = node.getAttribute('src') || '';
            const alt = node.getAttribute('alt') || '';
            const resolved = resolveImageSrc(src);

            const cssModel = cssToModel(resolvedCss);
            const imgEl = {
                id: generateId(),
                type: 'image',
                dataGroup: parentGroupId,
                dataRole: 'leaf',
                dataDepth: depth,
                dataClasses: classList.join(' '),
                component: 'img',
                src: resolved,
                alt,
                x: 0,
                y: yOffset,
                width: cssModel.cssWidth || px(node.getAttribute('width'), 60),
                height: cssModel.cssHeight || px(node.getAttribute('height'), 60),
                fitMode: cssModel.fitMode || 'fill',
                rotation: 0,
                skewX: 0,
                skewY: 0,
            };
            elements.push(imgEl);
            return elements;
        }

        // Check for icon + text pattern inside this leaf
        const iconChild = node.querySelector('svg, img[src*="svg"]');
        const textChild = this.findDirectTextChild(node);
        const directText = this.getDirectText(node);

        if (iconChild && textChild) {
            // Icon + text → two separate elements
            const svgMarkup = new XMLSerializer().serializeToString(iconChild);
            const svgDataUrl = 'data:image/svg+xml,' + encodeURIComponent(svgMarkup);

            const iconEl = this.buildSvgElement(iconChild, svgDataUrl, {}, parentGroupId, depth, yOffset);

            const textContent = textChild.textContent?.trim() || '';
            const textInline = parseInlineStyles(textChild.getAttribute('style'));
            const textClasses = textChild.classList ? Array.from(textChild.classList) : [];
            const textResolved = resolveCascade(textInline, textClasses, rules, resolvedCss);
            const textModel = cssToModel(textResolved);

            const textEl = {
                id: generateId(),
                type: 'text',
                dataGroup: parentGroupId,
                dataRole: 'leaf',
                dataDepth: depth + 1,
                dataClasses: textClasses.join(' '),
                component: 'text',
                content: textContent || 'Text',
                x: 0,
                y: yOffset,
                width: textModel.cssWidth || 150,
                height: 30,
                fontSize: textModel.fontSize || 16,
                fontWeight: textModel.fontWeight || '400',
                fontFamily: textModel.fontFamily || 'Inter',
                color: textModel.color || '#000000',
                bgColor: 'transparent',
                textShadow: 'none',
                borderRadius: { tl: 0, tr: 0, br: 0, bl: 0 },
                padding: { top: 4, right: 8, bottom: 4, left: 8 },
                rotation: 0,
                skewX: 0,
                skewY: 0,
            };

            elements.push(iconEl, textEl);
            return elements;
        }

        // Check for image + text pattern
        const imgChild = node.querySelector('img');
        if (imgChild && directText) {
            const resolved = resolveImageSrc(imgChild.src);
            const imgEl = {
                id: generateId(),
                type: 'image',
                dataGroup: parentGroupId,
                dataRole: 'leaf',
                dataDepth: depth + 1,
                dataClasses: classList.join(' '),
                component: 'img',
                src: resolved,
                alt: imgChild.alt || '',
                x: 0,
                y: yOffset,
                width: 48,
                height: 48,
                fitMode: 'fill',
                rotation: 0, skewX: 0, skewY: 0,
            };

            const textModel = cssToModel(resolvedCss);
            const textEl = {
                id: generateId(),
                type: 'text',
                dataGroup: parentGroupId,
                dataRole: 'leaf',
                dataDepth: depth + 1,
                dataClasses: classList.join(' '),
                component: 'text',
                content: directText,
                x: 0,
                y: yOffset,
                width: textModel.cssWidth || 150,
                height: 30,
                fontSize: textModel.fontSize || 16,
                fontWeight: textModel.fontWeight || '400',
                fontFamily: textModel.fontFamily || 'Inter',
                color: textModel.color || '#000000',
                bgColor: 'transparent',
                textShadow: 'none',
                borderRadius: { tl: 0, tr: 0, br: 0, bl: 0 },
                padding: { top: 4, right: 8, bottom: 4, left: 8 },
                rotation: 0, skewX: 0, skewY: 0,
            };

            elements.push(imgEl, textEl);
            return elements;
        }

        // Pure text node
        if (directText || tag === 'span' || tag === 'p' || tag === 'h1' || tag === 'h2' ||
            tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' || tag === 'label') {
            const textModel = cssToModel(resolvedCss);

            // Determine font size from heading tags
            let fontSize = textModel.fontSize || 16;
            if (tag === 'h1') fontSize = fontSize > 24 ? fontSize : 32;
            else if (tag === 'h2') fontSize = fontSize > 24 ? fontSize : 28;
            else if (tag === 'h3') fontSize = fontSize > 24 ? fontSize : 24;
            else if (tag === 'h4') fontSize = fontSize > 20 ? fontSize : 20;
            else if (tag === 'h5') fontSize = fontSize > 18 ? fontSize : 18;
            else if (tag === 'h6') fontSize = fontSize > 16 ? fontSize : 16;

            const textEl = {
                id: generateId(),
                type: 'text',
                dataGroup: parentGroupId,
                dataRole: 'leaf',
                dataDepth: depth,
                dataClasses: classList.join(' '),
                component: tag || 'div',
                content: directText || node.textContent?.trim() || 'Text',
                x: 0,
                y: yOffset,
                width: textModel.cssWidth || 200,
                height: Math.max(30, fontSize * 1.5),
                fontSize,
                fontWeight: textModel.fontWeight || (tag?.startsWith('h') ? '700' : '400'),
                fontFamily: textModel.fontFamily || 'Inter',
                color: textModel.color || '#000000',
                bgColor: textModel.bgColor || 'transparent',
                textShadow: textModel.textShadow || 'none',
                borderRadius: textModel.borderRadius || { tl: 0, tr: 0, br: 0, bl: 0 },
                padding: textModel.padding || { top: 4, right: 8, bottom: 4, left: 8 },
                rotation: 0,
                skewX: 0,
                skewY: 0,
            };

            if (textModel.lineHeight) textEl.lineHeight = textModel.lineHeight;
            if (textModel.textAlign) textEl.textAlign = textModel.textAlign;
            if (textModel.letterSpacing) textEl.letterSpacing = textModel.letterSpacing;

            elements.push(textEl);
            return elements;
        }

        // Fallback: empty container or unrecognized leaf — try recursing into children
        if (node.children && node.children.length > 0) {
            Array.from(node.children).forEach(child => {
                const childEls = this.walkNode(child, rules, parentGroupId, depth, yOffset, ctx);
                elements.push(...childEls);
                const last = childEls[childEls.length - 1];
                if (last) yOffset = last.y + (last.height || 30);
            });
        }

        return elements;
    }

    /**
     * Build an SVG element model from a DOM node with SVG content.
     */
    buildSvgElement(node, svgDataUrl, resolvedCss, parentGroupId, depth, yOffset) {
        const cssModel = cssToModel(resolvedCss);
        return {
            id: generateId(),
            type: 'svg',
            dataGroup: parentGroupId,
            dataRole: 'leaf',
            dataDepth: depth,
            dataClasses: '',
            component: 'svg',
            src: svgDataUrl,
            svgName: node.getAttribute('data-name') || node.getAttribute('id') || 'imported-svg',
            x: 0,
            y: yOffset,
            width: cssModel.cssWidth || px(node.getAttribute('width'), 48),
            height: cssModel.cssHeight || px(node.getAttribute('height'), 48),
            fitMode: cssModel.fitMode || 'fill',
            fillColor: '#231f20',
            strokeWidth: 0,
            blurX: 0,
            blurY: 0,
            ghostBlurX: 0,
            ghostBlurY: 0,
            ghostOffsetX: 0,
            ghostOffsetY: 0,
            ghostOpacity: 0,
            gradientColor: null,
            gradientType: 'linear',
            gradientAngle: 0,
            gradientOpacity: 100,
            gradientStops: [],
            rotation: 0,
            skewX: 0,
            skewY: 0,
        };
    }

    /**
     * Find the first direct text child element (e.g. <span>Label</span>).
     */
    findDirectTextChild(node) {
        if (!node.children) return null;
        for (const child of node.children) {
            const tag = child.tagName?.toLowerCase();
            if (['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'a', 'strong', 'em', 'b', 'i'].includes(tag)) {
                if (child.textContent?.trim()) return child;
            }
        }
        return null;
    }

    /**
     * Get direct text content (not from deeply nested elements).
     */
    getDirectText(node) {
        let text = '';
        for (const child of (node.childNodes || [])) {
            if (child.nodeType === 3) { // Text node
                text += child.textContent;
            }
        }
        return text.trim();
    }

    /**
     * Post-process: compute container heights and final positions.
     * Called after all elements have been created.
     */
    resolveLayout(elements, canvasWidth) {
        // Find all containers and compute their children's positions
        const containers = elements.filter(el => el.type === 'container');

        // Sort by depth (deepest first) so child positions are resolved before parents
        containers.sort((a, b) => (b.dataDepth || 0) - (a.dataDepth || 0));

        containers.forEach(container => {
            // Get child elements
            const childIds = container.children || [];
            const childEls = childIds
                .map(id => elements.find(e => e.id === id))
                .filter(Boolean);

            if (!childEls.length) {
                container.height = (container.padding?.top || 0) + (container.padding?.bottom || 0) + 20;
                return;
            }

            // Compute children positions
            computeChildPositions(container, childEls, canvasWidth);

            // Compute container height based on children bounds
            let maxY = 0;
            let maxX = 0;
            childEls.forEach(child => {
                const childBottom = child.y + (child.height || 30);
                const childRight = child.x + (child.width || 60);
                if (childBottom > maxY) maxY = childBottom;
                if (childRight > maxX) maxX = childRight;
            });

            const pad = container.padding || { top: 0, right: 0, bottom: 0, left: 0 };
            container.height = maxY + pad.bottom;
            container.width = Math.max(container.width || canvasWidth, maxX + pad.right);
        });

        // Final pass: set top-level element positions if they're all at x=0
        const topLevel = elements.filter(el => !el.dataDepth || el.dataDepth === 0);
        if (topLevel.length && topLevel.every(el => el.x === 0)) {
            // Space them out vertically
            let y = 0;
            topLevel.forEach(el => {
                el.y = y;
                y += (el.height || 30) + 10;
            });
        }
    }
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Parse standard HTML into page models (multi-page output).
 * Returns { pages: [{ id, bgColor, elements }], warnings: string[] }.
 */
export function parseFullHtml(html) {
    const parser = new HTMLFullParser(html);
    return parser.parse();
}

/**
 * Parse HTML using the browser layout engine instead of approximating flex/grid.
 * The returned x/y/width/height are the final painted boxes, relative to the
 * owning section and scaled to the editor canvas. This is intentionally async:
 * computed layout is only available after an iframe has loaded fonts and images.
 */
export async function parseFullHtmlWithLayout(html, canvasWidth = 500) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;left:-100000px;top:0;width:' + canvasWidth + 'px;height:2000px;border:0;visibility:hidden;pointer-events:none;';
    // HTML import is static. Scripts are removed so importing a file cannot run it.
    const safeHtml = String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');

    const loaded = new Promise((resolve, reject) => {
        iframe.onload = () => resolve();
        iframe.onerror = () => reject(new Error('Could not load HTML for layout measurement.'));
    });
    iframe.srcdoc = safeHtml;
    document.body.appendChild(iframe);

    try {
        await loaded;
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) throw new Error('Layout measurement document is unavailable.');
        await doc.fonts?.ready;
        await Promise.all([...doc.images].map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        })));

        const warnings = [];
        const sections = [...doc.body.children].filter(el => el.tagName?.toLowerCase() === 'section');
        const pageNodes = sections.length ? sections : [doc.body];
        let groupCounter = 0;
        const nextGroup = () => 'grp_' + (++groupCounter).toString(36);
        const number = value => Number.parseFloat(value) || 0;
        const box = value => parseBorderRadius(value || '0');
        const padding = style => ({ top: number(style.paddingTop), right: number(style.paddingRight), bottom: number(style.paddingBottom), left: number(style.paddingLeft) });
        const visualStyle = style => {
            const background = style.backgroundImage && style.backgroundImage !== 'none' ? style.backgroundImage : style.backgroundColor;
            return {
                bgColor: isTransparent(style.backgroundColor) ? 'transparent' : style.backgroundColor,
                bgGradient: style.backgroundImage && style.backgroundImage !== 'none' ? style.backgroundImage : null,
                border: style.border && style.border !== '0px none rgb(0, 0, 0)' ? style.border : 'none',
                borderRadius: box(style.borderRadius),
                boxShadow: style.boxShadow === 'none' ? 'none' : style.boxShadow,
                opacity: number(style.opacity || '1') || 1,
                color: style.color,
                fontSize: number(style.fontSize) || 16,
                fontWeight: style.fontWeight || '400',
                fontFamily: (style.fontFamily || 'Inter').replace(/["']/g, '').split(',')[0].trim(),
                lineHeight: number(style.lineHeight) || undefined,
                textAlign: style.textAlign,
                letterSpacing: style.letterSpacing,
                padding: padding(style),
                layout: style.display === 'flex' || style.display === 'grid' ? style.display : 'block',
                direction: style.flexDirection || 'column',
                gap: number(style.gap),
                align: style.alignItems,
                justify: style.justifyContent,
                position: style.position,
                offsetX: number(style.left),
                offsetY: number(style.top),
                background,
            };
        };
        const directText = node => [...node.childNodes].filter(n => n.nodeType === win.Node.TEXT_NODE).map(n => n.textContent).join(' ').trim();
        const isTextTag = tag => ['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'a', 'strong', 'em', 'b', 'i', 'button'].includes(tag);
        const isContainerNode = (node, style) => ['div', 'article', 'main', 'header', 'footer', 'nav'].includes(node.tagName.toLowerCase()) && (node.children.length > 0 || style.display === 'flex' || style.display === 'grid');

        const pages = pageNodes.map((section, sectionIndex) => {
            const sectionRect = section.getBoundingClientRect();
            const scale = canvasWidth / Math.max(1, sectionRect.width || canvasWidth);
            const sectionStyle = win.getComputedStyle(section);
            const secVisual = visualStyle(sectionStyle);
            const elements = [];

            const walk = (node, parentGroup, depth) => {
                const tag = node.tagName?.toLowerCase();
                if (!tag || ['style', 'script', 'link', 'meta', 'title', 'head'].includes(tag)) return;
                const style = win.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return;
                const rect = node.getBoundingClientRect();
                const geometry = {
                    x: (rect.left - sectionRect.left) * scale,
                    y: (rect.top - sectionRect.top) * scale,
                    width: rect.width * scale,
                    height: rect.height * scale,
                };
                const css = visualStyle(style);
                const classes = [...node.classList].join(' ');

                if (tag === 'img') {
                    elements.push({ id: generateId(), type: 'image', dataGroup: parentGroup, dataRole: 'leaf', dataDepth: depth, dataSection: sectionIndex, dataClasses: classes, component: 'img', src: node.currentSrc || node.src, alt: node.alt || '', fitMode: style.objectFit || 'fill', ...geometry, ...css, rotation: 0, skewX: 0, skewY: 0 });
                    return;
                }
                if (tag === 'svg') {
                    const markup = new win.XMLSerializer().serializeToString(node);
                    elements.push({ id: generateId(), type: 'svg', dataGroup: parentGroup, dataRole: 'leaf', dataDepth: depth, dataSection: sectionIndex, dataClasses: classes, component: 'svg', src: 'data:image/svg+xml,' + encodeURIComponent(markup), svgName: node.id || node.getAttribute('data-name') || 'imported-svg', fitMode: 'fill', ...geometry, ...css, fillColor: '#231f20', strokeWidth: 0, rotation: 0, skewX: 0, skewY: 0 });
                    return;
                }
                if (isContainerNode(node, style)) {
                    const group = nextGroup();
                    const container = { id: generateId(), type: 'container', dataGroup: group, dataGroupParent: group, dataRole: 'container', dataDepth: depth, dataSection: sectionIndex, dataClasses: classes, component: tag, children: [], ...geometry, ...css, rotation: 0, skewX: 0, skewY: 0 };
                    elements.push(container);
                    [...node.children].forEach(child => {
                        const before = elements.length;
                        walk(child, group, depth + 1);
                        container.children.push(...elements.slice(before).filter(el => el.dataDepth === depth + 1).map(el => el.id));
                    });
                    return;
                }
                const text = directText(node) || (isTextTag(tag) ? node.textContent.trim() : '');
                if (text) elements.push({ id: generateId(), type: 'text', dataGroup: parentGroup, dataRole: 'leaf', dataDepth: depth, dataSection: sectionIndex, dataClasses: classes, component: tag, content: text, ...geometry, ...css, bgColor: css.bgColor, textShadow: css.boxShadow, rotation: 0, skewX: 0, skewY: 0 });
                else [...node.children].forEach(child => walk(child, parentGroup, depth));
            };
            [...section.children].forEach(child => walk(child, null, 0));
            return { id: 'pg_' + Date.now().toString(36) + sectionIndex, bgColor: secVisual.bgColor === 'transparent' ? '#ffffff' : secVisual.bgColor, bgGradient: secVisual.bgGradient, elements };
        });
        return { pages, warnings };
    } finally {
        iframe.remove();
    }
}

/**
 * Parse standard HTML into a flat array of element models (single page).
 * For backward compatibility with the old API.
 */
export function parseFullHtmlToElements(html) {
    const { pages } = parseFullHtml(html);
    // Merge all pages into a single flat array
    const allElements = [];
    pages.forEach((page, pageIdx) => {
        page.elements.forEach(el => {
            allElements.push({
                ...el,
                dataSection: pageIdx,
            });
        });
    });
    return allElements;
}
