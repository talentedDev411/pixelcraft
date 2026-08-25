// html-importer.js — Parses HTML + inline CSS into canvas element models.
//
// Supports two entry points:
//   1. importHtml(htmlString, name)  — used by HTML Inject (paste) and Import HTML (file)
//   2. parseHtmlToElements(htmlString) — returns raw element models without adding to canvas
//
// The parser recognizes elements by these code-editor conventions:
//   - div.element.text-element   → text element
//   - div.element.svg-element    → SVG icon/shape element
//   - div.element.image-element  → raster image element
//   - data-* attributes carry element metadata (data-id, data-type, etc.)
//   - Inline styles carry position (left/top/width/height) and visual props
//   - Gradient backgrounds on parent containers are extracted as page bgGradient
//   - Nested SVGs inside .svg-element children are captured as element src

import { emit } from '@/core/bus.js';
import { getCanvasHeight, getCanvasWidth, getElements, getActivePage, setActivePageId, setElements, getPages } from '@/core/state.js';
import { record } from '@/history/history.js';
import { generateId, clamp } from '@/core/utils.js';
import { addPage, createPage } from '@/pages/pages.js';
import { parseFullHtmlWithLayout } from '@/import/html-full-parser.js';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Parse a CSS inline style string into a camelCase property map. */
function parseInlineStyles(styleStr) {
    if (!styleStr) return {};
    const props = {};
    styleStr.split(';').forEach(decl => {
        const colonIdx = decl.indexOf(':');
        if (colonIdx === -1) return;
        const prop = decl.substring(0, colonIdx).trim();
        const val = decl.substring(colonIdx + 1).trim();
        if (!prop || !val) return;
        // Convert kebab-case to camelCase
        const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        props[camel] = val;
    });
    return props;
}

/** Parse a numeric CSS value, stripping "px" and returning a number (or fallback). */
function px(val, fallback = 0) {
    if (val == null || val === '') return fallback;
    const n = parseFloat(String(val).replace(/px$/i, ''));
    return isNaN(n) ? fallback : n;
}

/** Detect if a CSS color string is transparent. */
function isTransparent(val) {
    return !val || val === 'transparent' || val === 'rgba(0, 0, 0, 0)' || val === 'rgba(0,0,0,0)';
}

/** Extract inline SVG markup from an element tree (e.g. <svg>...</svg> inside a div). */
function extractSvgFromNode(node) {
    // If the node itself is an SVG element
    if (node.tagName && node.tagName.toLowerCase() === 'svg') {
        return new XMLSerializer().serializeToString(node);
    }
    // Search children
    const svg = node.querySelector ? node.querySelector('svg') : null;
    if (svg) {
        return new XMLSerializer().serializeToString(svg);
    }
    return null;
}

/** Extract SVG data URL from an <img> child whose src contains svg+xml data. */
function extractSvgDataUrl(node) {
    const img = node.querySelector ? node.querySelector('img[src*="svg+xml"]') : null;
    if (img && img.src) return img.src;
    return null;
}

/** Try to extract SVG content from various sources in a DOM node. */
function resolveSvgSrc(domNode) {
    // 1. Direct SVG markup inside the node
    const svgMarkup = extractSvgFromNode(domNode);
    if (svgMarkup) {
        return 'data:image/svg+xml,' + encodeURIComponent(svgMarkup);
    }
    // 2. <img> child with SVG data URL
    const dataUrl = extractSvgDataUrl(domNode);
    if (dataUrl) return dataUrl;
    // 3. <img> child with any src
    const img = domNode.querySelector ? domNode.querySelector('img') : null;
    if (img && img.src) return img.src;
    // 4. data-src attribute on the node
    if (domNode.getAttribute && domNode.getAttribute('data-src')) {
        return domNode.getAttribute('data-src');
    }
    return null;
}

/** Convert a kebab-case CSS string to canvas model borderRadius object. */
function parseBorderRadius(cssVal) {
    if (!cssVal || cssVal === '0') return { tl: 0, tr: 0, br: 0, bl: 0 };
    const parts = cssVal.split(/\s+/).map(v => px(v, 0));
    if (parts.length === 1) return { tl: parts[0], tr: parts[0], br: parts[0], bl: parts[0] };
    if (parts.length === 2) return { tl: parts[0], tr: parts[1], br: parts[0], bl: parts[1] };
    if (parts.length === 3) return { tl: parts[0], tr: parts[1], br: parts[2], bl: parts[1] };
    return { tl: parts[0], tr: parts[1], br: parts[2], bl: parts[3] };
}

/** Convert a CSS padding shorthand to a {top, right, bottom, left} object. */
function parsePadding(cssVal) {
    if (!cssVal) return { top: 8, right: 8, bottom: 8, left: 8 };
    const parts = cssVal.split(/\s+/).map(v => px(v, 8));
    if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
}

/** Parse a CSS transform string to extract rotation, skewX, skewY. */
function parseTransform(cssVal) {
    const result = { rotation: 0, skewX: 0, skewY: 0 };
    if (!cssVal) return result;
    const rotateMatch = cssVal.match(/rotate\(([^)]+)\)/);
    if (rotateMatch) result.rotation = px(rotateMatch[1], 0);
    const skewXMatch = cssVal.match(/skewX\(([^)]+)\)/);
    if (skewXMatch) result.skewX = px(skewXMatch[1], 0);
    const skewYMatch = cssVal.match(/skewY\(([^)]+)\)/);
    if (skewYMatch) result.skewY = px(skewYMatch[1], 0);
    return result;
}

// ── Core Parser ──────────────────────────────────────────────────────────

/**
 * Parse an HTML string into a flat array of canvas element models.
 *
 * Recognition rules (code editor conventions):
 *   1. Elements with class "element" AND a type class (text-element, svg-element, image-element)
 *      are extracted as canvas elements.
 *   2. Elements with data-type attribute ("text", "svg", "image") are also recognized.
 *   3. Elements that are plain divs with gradients (background: linear-gradient/radial-gradient)
 *      in their inline style are treated as "gradient container" wrappers — their children
 *      are searched for extractable elements.
 *   4. Inline SVGs found in any context are converted to svg-element canvas objects.
 *
 * Each recognized element gets:
 *   - Position from inline style left/top/width/height (or data attributes)
 *   - Type-specific properties extracted from inline styles and children
 *   - data-id preserved if present, otherwise auto-generated
 */
export function parseHtmlToElements(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    const elements = [];

    // Strategy: walk every child of body (top-level sections), then recurse
    // into their children looking for extractable elements.

    function processNode(node, depth = 0) {
        if (!node || depth > 20) return; // guard against infinite nesting

        // Check if THIS node is a code-editor element
        const classList = node.classList ? Array.from(node.classList) : [];
        const isEditorElement = classList.includes('element') && (
            classList.includes('text-element') ||
            classList.includes('svg-element') ||
            classList.includes('image-element')
        );
        const dataElType = node.getAttribute ? node.getAttribute('data-element-type') : null;
        const hasDataId = node.getAttribute ? node.getAttribute('data-id') : null;

        if (isEditorElement || dataElType) {
            const el = extractEditorElement(node, dataElType);
            if (el) elements.push(el);
            return; // don't recurse into children of recognized elements
        }

        // Special case: plain <img> with SVG src (not wrapped in .element)
        if (node.tagName && node.tagName.toLowerCase() === 'img' && node.src && node.src.includes('svg+xml')) {
            const el = buildSvgElementFromImg(node);
            if (el) elements.push(el);
            return;
        }

        // Special case: raw <svg> tags (not inside .element wrappers)
        if (node.tagName && node.tagName.toLowerCase() === 'svg') {
            const el = buildSvgElementFromSvgNode(node);
            if (el) elements.push(el);
            return;
        }

        // Recurse into children
        if (node.children) {
            Array.from(node.children).forEach(child => processNode(child, depth + 1));
        }
    }

    /**
     * Extract a canvas element model from a recognized code-editor element node.
     */
    function extractEditorElement(node, forceType) {
        const style = parseInlineStyles(node.getAttribute('style'));
        const classList = node.classList ? Array.from(node.classList) : [];

        // Determine type
        let type = forceType;
        if (!type) {
            if (classList.includes('text-element')) type = 'text';
            else if (classList.includes('svg-element')) type = 'svg';
            else if (classList.includes('image-element')) type = 'image';
        }
        if (!type) return null;

        const id = node.getAttribute('data-id') || node.getAttribute('data-editor-id') || generateId();
        const transform = parseTransform(style.transform);

        const base = {
            id,
            type,
            x: clamp(px(style.left), 0, getCanvasWidth()),
            y: clamp(px(style.top), 0, getCanvasHeight()),
            width: clamp(px(style.width, 100), 20, getCanvasWidth()),
            height: clamp(px(style.height, 50), 20, getCanvasHeight()),
            rotation: transform.rotation,
            skewX: transform.skewX,
            skewY: transform.skewY,
        };

        if (type === 'text') {
            return buildTextElement(node, style, base);
        } else if (type === 'svg') {
            return buildSvgElement(node, style, base);
        } else if (type === 'image') {
            return buildImageElement(node, style, base);
        }
        return null;
    }

    function buildTextElement(node, style, base) {
        // Content: textContent of the node, or data-content attribute
        const content = node.getAttribute('data-content') ||
            (node.textContent || '').trim() || 'Text';

        return {
            ...base,
            content,
            fontSize: px(style.fontSize, 24),
            fontWeight: style.fontWeight || '400',
            fontFamily: (style.fontFamily || 'Inter').replace(/['"]/g, '').replace(/,\s*sans-serif$/, ''),
            color: style.color || '#000000',
            bgColor: isTransparent(style.backgroundColor) ? 'transparent' : (style.backgroundColor || 'transparent'),
            textShadow: style.textShadow || 'none',
            borderRadius: parseBorderRadius(style.borderRadius),
            padding: parsePadding(style.padding),
        };
    }

    function buildSvgElement(node, style, base) {
        // Try to get SVG source from various locations
        let src = resolveSvgSrc(node);
        const svgName = node.getAttribute('data-svg-name') || node.getAttribute('data-name') || 'imported-svg';

        // If no inline SVG found, create a placeholder
        if (!src) {
            src = createPlaceholderSvg(base.width, base.height);
        }

        // Extract gradient properties from data attributes or inline styles
        const fillColor = node.getAttribute('data-fill-color') || '#231f20';

        return {
            ...base,
            src,
            svgName,
            fillColor,
            fitMode: node.getAttribute('data-fit-mode') || style.objectFit || 'fill',
            strokeWidth: px(node.getAttribute('data-stroke-width'), 0),
            blurX: px(node.getAttribute('data-blur-x'), 0),
            blurY: px(node.getAttribute('data-blur-y'), 0),
            ghostBlurX: px(node.getAttribute('data-ghost-blur-x'), 0),
            ghostBlurY: px(node.getAttribute('data-ghost-blur-y'), 0),
            ghostOffsetX: px(node.getAttribute('data-ghost-offset-x'), 0),
            ghostOffsetY: px(node.getAttribute('data-ghost-offset-y'), 0),
            ghostOpacity: px(node.getAttribute('data-ghost-opacity'), 0),
            gradientColor: node.getAttribute('data-gradient-color') || null,
            gradientType: node.getAttribute('data-gradient-type') || 'linear',
            gradientAngle: px(node.getAttribute('data-gradient-angle'), 0),
            gradientOpacity: px(node.getAttribute('data-gradient-opacity'), 100),
            gradientStops: parseGradientStopsAttr(node),
        };
    }

    function buildImageElement(node, style, base) {
        const img = node.querySelector('img');
        const src = img ? img.src : (node.getAttribute('data-src') || '');
        return {
            ...base,
            src,
            fitMode: node.getAttribute('data-fit-mode') || (img ? img.style.objectFit : null) || style.objectFit || 'fill',
        };
    }

    function buildSvgElementFromImg(imgNode) {
        const parent = imgNode.closest('[style]');
        const style = parent ? parseInlineStyles(parent.getAttribute('style')) : {};
        return {
            id: generateId(),
            type: 'svg',
            src: imgNode.src,
            svgName: imgNode.alt || imgNode.getAttribute('data-name') || 'imported-svg',
            x: clamp(px(style.left || imgNode.parentElement?.style?.left), 0, getCanvasWidth()),
            y: clamp(px(style.top || imgNode.parentElement?.style?.top), 0, getCanvasHeight()),
            width: clamp(px(style.width || imgNode.width, 60), 20, getCanvasWidth()),
            height: clamp(px(style.height || imgNode.height, 60), 20, getCanvasHeight()),
            fillColor: '#231f20',
            fitMode: 'fill',
            strokeWidth: 0, blurX: 0, blurY: 0,
            ghostBlurX: 0, ghostBlurY: 0, ghostOffsetX: 0, ghostOffsetY: 0, ghostOpacity: 0,
            gradientColor: null, gradientType: 'linear', gradientAngle: 0, gradientOpacity: 100,
            gradientStops: [],
            rotation: 0, skewX: 0, skewY: 0,
        };
    }

    function buildSvgElementFromSvgNode(svgNode) {
        const svgMarkup = new XMLSerializer().serializeToString(svgNode);
        const dataUrl = 'data:image/svg+xml,' + encodeURIComponent(svgMarkup);
        const parentStyle = svgNode.parentElement ? parseInlineStyles(svgNode.parentElement.getAttribute('style')) : {};
        return {
            id: generateId(),
            type: 'svg',
            src: dataUrl,
            svgName: svgNode.getAttribute('data-name') || svgNode.getAttribute('id') || 'imported-svg',
            x: clamp(px(parentStyle.left), 0, getCanvasWidth()),
            y: clamp(px(parentStyle.top), 0, getCanvasHeight()),
            width: clamp(px(parentStyle.width || svgNode.getAttribute('width'), 60), 20, getCanvasWidth()),
            height: clamp(px(parentStyle.height || svgNode.getAttribute('height'), 60), 20, getCanvasHeight()),
            fillColor: '#231f20',
            fitMode: 'fill',
            strokeWidth: 0, blurX: 0, blurY: 0,
            ghostBlurX: 0, ghostBlurY: 0, ghostOffsetX: 0, ghostOffsetY: 0, ghostOpacity: 0,
            gradientColor: null, gradientType: 'linear', gradientAngle: 0, gradientOpacity: 100,
            gradientStops: [],
            rotation: 0, skewX: 0, skewY: 0,
        };
    }

    // ── Gradient container detection ──
    // Sections with gradient backgrounds get their gradient applied as page bgGradient
    const sections = body.querySelectorAll('[data-section]');
    if (sections.length > 0) {
        sections.forEach(section => {
            const style = parseInlineStyles(section.getAttribute('style'));
            if (style.background && (style.background.includes('gradient') || style.backgroundImage?.includes('gradient'))) {
                // This section's gradient could be used as a page background
                // We store it as metadata but don't set page bg here — the caller can
            }
            // Process children within sections
            Array.from(section.children).forEach(child => processNode(child));
        });
    } else {
        // No sections — process all top-level children of body
        Array.from(body.children).forEach(child => processNode(child));
    }

    return elements;
}

/** Parse data-gradient-stops attribute (JSON array) or return empty. */
function parseGradientStopsAttr(node) {
    const attr = node.getAttribute('data-gradient-stops');
    if (!attr) return [];
    try {
        return JSON.parse(attr);
    } catch {
        return [];
    }
}

/** Create a minimal placeholder SVG for elements without a source. */
function createPlaceholderSvg(w, h) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#e0e0e0" rx="4"/><text x="${w/2}" y="${h/2}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#999">?</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Parse an HTML string and inject the resulting elements onto the active canvas.
 * Returns { pagesAdded, elementsAdded } summary.
 */
export async function importHtml(html, name = 'html-import') {
    // ── Strategy 1: Try the full standard-HTML parser first ──
    // This handles real-world HTML: <section> → pages, CSS cascade,
    // flex/grid containers, auto-grouping, image resolution, etc.
    // The measurement parser asks the browser for the final painted box of each
    // node. That preserves backgrounds and real CSS layout (relative offsets,
    // flex, grid, rem/%, wrapping) instead of reimplementing CSS in JavaScript.
    const fullResult = await parseFullHtmlWithLayout(html, getCanvasWidth());
    if (fullResult.pages.some(p => p.elements.length > 0)) {
        return applyFullParseResult(fullResult);
    }

    // ── Strategy 2: Fall back to code-editor serializer parser ──
    // Handles HTML exported from this editor (class="element text-element" etc.)
    const elements = parseHtmlToElements(html);

    if (elements.length === 0) {
        throw new Error('No extractable elements found in the HTML. Use <section> tags for pages, flex/grid containers for grouping, or class="element text-element" / "svg-element" / "image-element" for code-editor format.');
    }

    // Ensure there's an active page
    const page = getActivePage();
    if (!page) {
        addPage();
    }

    // Position new elements: if they all land at 0,0, offset them slightly
    // so they don't stack on top of existing elements.
    const existingCount = getElements().length;
    const offsetX = existingCount > 0 ? 20 : 0;
    const offsetY = existingCount > 0 ? 20 : 0;

    const positioned = elements.map((el, i) => ({
        ...el,
        x: clamp(el.x + offsetX + i * 10, 0, Math.max(0, getCanvasWidth() - el.width)),
        y: clamp(el.y + offsetY + i * 10, 0, Math.max(0, getCanvasHeight() - el.height)),
    }));

    // Check if the HTML has a top-level section with a gradient background
    // and apply it as the page background
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const firstSection = doc.body.querySelector('[data-section]');
    if (firstSection) {
        const secStyle = parseInlineStyles(firstSection.getAttribute('style'));
        const bgVal = secStyle.background || secStyle.backgroundImage || '';
        if (bgVal.includes('gradient')) {
            // Try to extract just the gradient function
            const gradMatch = bgVal.match(/(linear-gradient|radial-gradient|conic-gradient)\(.+\)/);
            if (gradMatch) {
                const p = getActivePage();
                if (p) p.bgGradient = gradMatch[0];
            }
        }
    }

    record();
    setElements([...getElements(), ...positioned]);
    emit('render');

    return {
        pagesAdded: 0,
        elementsAdded: positioned.length,
        elements: positioned,
    };
}

/**
 * Apply results from the full HTML parser: creates new pages and populates
 * them with the parsed element models.
 */
function applyFullParseResult(fullResult) {
    const { pages: parsedPages } = fullResult;
    let pagesAdded = 0;
    let totalElements = 0;
    const allPositioned = [];

    // Ensure there's an active page to start from
    const activePage = getActivePage();
    if (!activePage) addPage();

    parsedPages.forEach((parsedPage, pageIdx) => {
        if (!parsedPage.elements.length) return;

        let targetPage;
        if (pageIdx === 0 && activePage && activePage.elements.length === 0) {
            // Reuse the first empty page
            targetPage = activePage;
        } else {
            // Create a new page for each section
            targetPage = createPage(parsedPage.bgColor || '#ffffff');
            getPages().push(targetPage);
            pagesAdded++;
        }

        // Set page background gradient if present in section styles
        if (parsedPage.bgGradient) {
            targetPage.bgGradient = parsedPage.bgGradient;
        }

        // Position elements within the page
        const existingCount = targetPage.elements.length;
        const offsetX = existingCount > 0 ? 20 : 0;
        const offsetY = existingCount > 0 ? 20 : 0;

        const positioned = parsedPage.elements.map((el, i) => ({
            ...el,
            x: clamp(el.x + offsetX, 0, Math.max(0, getCanvasWidth() - (el.width || 60))),
            y: clamp(el.y + offsetY, 0, Math.max(0, getCanvasHeight() - (el.height || 30))),
        }));

        targetPage.elements.push(...positioned);
        allPositioned.push(...positioned);
        totalElements += positioned.length;
    });

    // Switch to the last page created
    if (pagesAdded > 0) {
        const lastPage = getPages()[getPages().length - 1];
        if (lastPage) setActivePageId(lastPage.id);
    }

    record();
    emit('render');

    return {
        pagesAdded,
        elementsAdded: totalElements,
        elements: allPositioned,
    };
}
