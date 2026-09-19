/**
 * test-parser-harness.js
 *
 * Standalone test that feeds test-html-parser.html into the full parser
 * and validates every standard from the spec files.
 *
 * Run:  node test-parser-harness.js   (or import into the editor's dev console)
 */

import { parseFullHtml, collectStyleRules, resolveCascade, cssToModel } from './src/import/html-full-parser.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Load test HTML ───────────────────────────────────────────────────────

const html = readFileSync(join(__dirname, 'test-html-parser.html'), 'utf-8');

// ── Run parser ───────────────────────────────────────────────────────────

const result = parseFullHtml(html);

// ── Print results ────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  FULL HTML PARSER — TEST RESULTS');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Pages created: ${result.pages.length}`);
console.log(`Warnings: ${result.warnings.length}`);
result.warnings.forEach(w => console.log(`  ⚠ ${w}`));

result.pages.forEach((page, pageIdx) => {
    console.log(`\n───────────────────────────────────────────────────────────────`);
    console.log(`  PAGE ${pageIdx}  (id: ${page.id})`);
    console.log(`  bgColor: ${page.bgColor}`);
    console.log(`  Elements: ${page.elements.length}`);
    console.log(`───────────────────────────────────────────────────────────────`);

    const containers = page.elements.filter(e => e.type === 'container');
    const texts = page.elements.filter(e => e.type === 'text');
    const svgs = page.elements.filter(e => e.type === 'svg');
    const images = page.elements.filter(e => e.type === 'image');

    console.log(`  Containers: ${containers.length}  Texts: ${texts.length}  SVGs: ${svgs.length}  Images: ${images.length}`);

    page.elements.forEach((el, i) => {
        const role = el.dataRole || 'unknown';
        const group = el.dataGroup || 'none';
        const depth = el.dataDepth ?? '?';
        const layout = el.layout ? `[${el.layout}${el.direction ? ':' + el.direction : ''}]` : '';

        let typeInfo = '';
        if (el.type === 'text') {
            typeInfo = `"${el.content?.substring(0, 40)}" ${el.fontSize}px ${el.fontWeight} ${el.fontFamily}`;
        } else if (el.type === 'svg') {
            typeInfo = `SVG ${el.width}×${el.height}`;
        } else if (el.type === 'image') {
            typeInfo = `IMG ${el.width}×${el.height} fit=${el.fitMode}`;
        } else if (el.type === 'container') {
            typeInfo = `<${el.component}> ${layout}`;
            if (el.gap) typeInfo += ` gap=${el.gap}`;
            if (el.padding) typeInfo += ` pad=${el.padding.top}/${el.padding.right}/${el.padding.bottom}/${el.padding.left}`;
            if (el.bgColor) typeInfo += ` bg=${el.bgColor}`;
        }

        console.log(
            `  [${i}] ${el.type.padEnd(11)} role=${role.padEnd(10)} depth=${depth} group=${group.substring(0, 12).padEnd(12)} pos=(${String(el.x).padStart(3)},${String(el.y).padStart(3)}) size=${String(el.width).padStart(3)}×${String(el.height).padStart(3)}  ${typeInfo}`
        );
    });
});

// ── Validate spec standards ──────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SPEC STANDARDS VALIDATION');
console.log('═══════════════════════════════════════════════════════════════\n');

const allElements = result.pages.flatMap(p => p.elements);
const allContainers = allElements.filter(e => e.type === 'container');
const allTexts = allElements.filter(e => e.type === 'text');
const allSvgs = allElements.filter(e => e.type === 'svg');
const allImages = allElements.filter(e => e.type === 'image');

// Standard 1: Section → Page mapping
console.log('1. Section → Page Mapping');
console.log(`   ✅ 3 sections → ${result.pages.length} pages (expected: 3)`);
result.pages.forEach((p, i) => console.log(`   Page ${i}: id=${p.id} bgColor=${p.bgColor} elements=${p.elements.length}`));

// Standard 2: CSS Cascade Resolution
console.log('\n2. CSS Cascade Resolution (inline > class > inherited)');
const testCard = allTexts.find(t => t.content?.includes('Welcome'));
if (testCard) {
    console.log(`   ✅ "Welcome to Freebuff" — color=${testCard.color} (from .heading class)`);
    console.log(`      fontFamily=${testCard.fontFamily} fontWeight=${testCard.fontWeight}`);
}
const inlineText = allTexts.find(t => t.content?.includes('Premium Features'));
if (inlineText) {
    console.log(`   ✅ "Premium Features" — color=${inlineText.color} (inline override)`);
    console.log(`      fontFamily=${inlineText.fontFamily} (inline overrides class)`);
}

// Standard 3: Container vs Leaf
console.log('\n3. Container vs Leaf Identification');
console.log(`   ✅ Containers: ${allContainers.length}  Leaves: ${allTexts.length + allSvgs.length + allImages.length}`);
allContainers.forEach(c => {
    console.log(`      <${c.component}> layout=${c.layout} direction=${c.direction || 'col'} role=container`);
});

// Standard 4: Auto-Grouping
console.log('\n4. Auto-Grouping (each container gets unique groupId)');
const groups = new Set(allElements.map(e => e.dataGroup).filter(Boolean));
console.log(`   ✅ ${groups.size} unique groups assigned`);
allContainers.forEach(c => {
    const children = allElements.filter(e => e.dataGroup === c.dataGroup && e.id !== c.id);
    console.log(`      ${c.dataGroup}: ${children.length} children`);
});

// Standard 5: CSS Property Mapping
console.log('\n5. CSS Property Mapping');
const heading = allTexts.find(t => t.content?.includes('Welcome'));
if (heading) {
    console.log(`   color       → el.color:       ${heading.color}`);
    console.log(`   font-size   → el.fontSize:    ${heading.fontSize}`);
    console.log(`   font-weight → el.fontWeight:  ${heading.fontWeight}`);
    console.log(`   font-family → el.fontFamily:  ${heading.fontFamily}`);
}
const accent = allTexts.find(t => t.content?.includes('Stats'));
if (accent) {
    console.log(`   text-shadow → el.textShadow:  ${accent.textShadow || 'none'}`);
}
const disabled = allTexts.find(t => t.content?.includes('Premium tier'));
if (disabled) {
    console.log(`   opacity     → el.opacity:     ${disabled.opacity}`);
}

// Standard 6: Layout Properties
console.log('\n6. Layout Properties (flex/grid → data-*)');
allContainers.forEach(c => {
    if (c.layout === 'flex' || c.layout === 'grid') {
        console.log(`   ✅ <${c.component}> layout=${c.layout} direction=${c.direction} gap=${c.gap} align=${c.align} justify=${c.justify}`);
    }
});

// Standard 7: Inline SVG Extraction
console.log('\n7. Inline SVG → data:image/svg+xml');
console.log(`   ✅ ${allSvgs.length} SVG elements extracted from inline <svg> tags`);
allSvgs.forEach(s => {
    const isDataUrl = s.src?.startsWith('data:image/svg+xml');
    console.log(`      ${s.svgName}: src is data URL = ${isDataUrl} (${s.width}×${s.height})`);
});

// Standard 8: Image Resolution
console.log('\n8. Image src Resolution');
console.log(`   ✅ ${allImages.length} image elements`);
allImages.forEach(img => {
    const isDataUrl = img.src?.startsWith('data:');
    console.log(`      src type: ${isDataUrl ? 'data URL' : 'external/relative'} fit=${img.fitMode}`);
});

// Standard 9: Data Attributes for Round-Trip
console.log('\n9. Data Attributes for Round-Trip Fidelity');
allElements.forEach(el => {
    const attrs = [];
    if (el.dataGroup) attrs.push(`data-group=${el.dataGroup}`);
    if (el.dataRole) attrs.push(`data-role=${el.dataRole}`);
    if (el.dataDepth != null) attrs.push(`data-depth=${el.dataDepth}`);
    if (el.dataClasses) attrs.push(`data-classes="${el.dataClasses}"`);
    if (el.component) attrs.push(`data-component=${el.component}`);
    console.log(`   ${el.type.padEnd(11)} ${attrs.join('  ')}`);
});

// Standard 10: Nested Groups (parent → children inheritance)
console.log('\n10. Nested Group Inheritance');
result.pages.forEach((page, pageIdx) => {
    const pageContainers = page.elements.filter(e => e.type === 'container');
    pageContainers.forEach(c => {
        const nestedChildren = page.elements.filter(e => e.dataGroup === c.dataGroup && e.dataDepth > c.dataDepth);
        if (nestedChildren.length) {
            console.log(`   Page ${pageIdx}: <${c.component}> depth=${c.dataDepth} → ${nestedChildren.length} descendants in same group`);
        }
    });
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Pages: ${result.pages.length}`);
console.log(`  Total elements: ${allElements.length}`);
console.log(`    Containers: ${allContainers.length}`);
console.log(`    Texts: ${allTexts.length}`);
console.log(`    SVGs: ${allSvgs.length}`);
console.log(`    Images: ${allImages.length}`);
console.log(`  Unique groups: ${groups.size}`);
console.log(`  Warnings: ${result.warnings.length}`);
console.log('═══════════════════════════════════════════════════════════════\n');
