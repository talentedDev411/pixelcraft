// Custom font management.
//
// The 5 built-in brand-style families come from resources/fonts/ (bundled).
// Custom fonts are imported through the dev-server API (vite plugin), which
// validates and stores them in resources/user/fonts/ behind a manifest.
// This module loads every registered font at boot — if one fails to load,
// the error message is printed — and keeps an in-memory registry so the
// properties panel can offer imported families in the dropdown.

const FONT_API = '/api/fonts';

const ALLOWED_EXT = ['.ttf', '.otf', '.woff', '.woff2'];
const SIGNATURES = ['00010000', '4f54544f', '74727565', '74797031', '774f4646', '774f4632'];

/** Custom fonts loaded this session: [{ id, name, file, weight, addedAt }]. */
const customFonts = [];

export function getCustomFonts() {
    return customFonts;
}

/** Fetch the manifest of fonts saved in resources/user/fonts/. */
export async function fetchUserFonts() {
    const res = await fetch(FONT_API);
    if (!res.ok) throw new Error(`Font API error: ${res.status} ${res.statusText}`);
    return res.json();
}

/**
 * Load every manifest-registered font into the document at startup.
 * Errors are printed (console + alert) but never crash the app.
 */
export async function loadUserFonts() {
    let manifest;
    try {
        manifest = await fetchUserFonts();
    } catch (err) {
        console.error('[fonts] Could not reach the font API:', err.message);
        return;
    }
    for (const entry of manifest.fonts || []) {
        try {
            await addFontFace(entry);
            customFonts.push(entry);
        } catch (err) {
            const msg = `Failed to load custom font "${entry.name}": ${err.message}`;
            console.error(msg);
            alert(msg);
        }
    }
}

/** Validate extension + 4-byte font signature before anything hits the server. */
async function validateFontFile(file) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
        throw new Error(`Unsupported file type. Use ${ALLOWED_EXT.join(', ')}.`);
    }
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const hex = Array.from(head).map(b => b.toString(16).padStart(2, '0')).join('');
    if (!SIGNATURES.includes(hex)) {
        throw new Error(`"${file.name}" is not a valid font file (magic-byte check failed).`);
    }
}

/**
 * Import a custom font: validate, POST to the dev-server API (which saves it
 * into resources/user/fonts/ and registers it in the manifest), then load the
 * new face so it's usable immediately. Returns the manifest entry.
 */
export async function importCustomFont(file) {
    await validateFontFile(file);
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const base = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[-_]+/g, ' ').trim();
    const res = await fetch(FONT_API, {
        method: 'POST',
        headers: {
            'X-Font-Name': encodeURIComponent(base || 'Custom Font'),
            'X-Font-Ext': ext,
            'X-Font-Weight': '400',
        },
        body: file,
    });
    if (!res.ok) {
        let detail = res.statusText;
        try { detail = await res.text(); } catch { /* keep statusText */ }
        throw new Error(detail.trim() || `Import failed (HTTP ${res.status}).`);
    }
    const entry = await res.json();
    await addFontFace(entry); // may throw -> caller shows the message
    customFonts.push(entry);
    return entry;
}

/** Register a FontFace for one manifest entry and load it. */
async function addFontFace(entry) {
    const url = `${FONT_API}/file/${encodeURIComponent(entry.file)}`;
    const face = new FontFace(entry.name, `url("${url}")`, { weight: entry.weight || '400' });
    await face.load();
    document.fonts.add(face);
}
