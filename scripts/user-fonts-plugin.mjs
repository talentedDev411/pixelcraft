// Vite plugin: user font import API.
//
// The app is pure client-side, so it can't write to disk by itself. This
// plugin gives the dev server two endpoints:
//
//   GET  /api/fonts           -> list fonts saved in resources/user/fonts/
//   GET  /api/fonts/file/:n   -> serve one saved font file
//   POST /api/fonts           -> save a font (raw body + X-Font-* headers)
//
// On-disk format is strict so random files can't sneak in:
//   - extensions whitelisted to .ttf / .otf / .woff / .woff2
//   - the first 4 bytes must be a known font signature (magic-byte check)
//   - every saved file is registered in manifest.json (versioned schema);
//     only manifest-registered files are ever served or loaded by the app
//   - filenames are server-generated (no traversal, no collisions)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const FONTS_DIR = path.resolve(process.cwd(), 'resources', 'user', 'fonts');
const MANIFEST_PATH = path.join(FONTS_DIR, 'manifest.json');
const ALLOWED_EXT = ['.ttf', '.otf', '.woff', '.woff2'];
const MAX_SIZE = 25 * 1024 * 1024;

const MIME = {
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

// path.extname('.ttf') is '' (dotfiles have no extension), so handle a bare
// '.ext' value directly — the client sends X-Font-Ext exactly like that.
const extOf = name => {
    const n = String(name || '').toLowerCase();
    return n.startsWith('.') ? n : path.extname(n);
};

/** Validate the 4-byte signature: TTF/OTF ('\0\1\0\0', 'OTTO', 'true', 'typ1'), WOFF ('wOFF'), WOFF2 ('wOF2'). */
function hasValidSignature(buf) {
    if (buf.length < 4) return false;
    const sig = buf.subarray(0, 4).toString('hex');
    return ['00010000', '4f54544f', '74727565', '74797031', '774f4646', '774f4632'].includes(sig);
}

function validManifest(raw) {
    return raw && typeof raw === 'object' && Array.isArray(raw.fonts)
        && raw.fonts.every(f => f && typeof f.id === 'string' && typeof f.name === 'string'
            && typeof f.file === 'string' && ALLOWED_EXT.includes(extOf(f.file)));
}

async function readManifest() {
    try {
        const raw = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
        return validManifest(raw) ? raw : { version: 1, fonts: [] };
    } catch {
        return { version: 1, fonts: [] };
    }
}

const cleanName = name => String(name || 'Custom Font').replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'Custom Font';
const cleanWeight = w => /^\d{3}$/.test(String(w)) ? String(w) : '400';

// Mounted via server.middlewares.use('/api/fonts', handle), so connect strips
// the '/api/fonts' prefix and req.url is the part after it ('/', '/file/x').
function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    return (async () => {
        if (req.method === 'GET' && url.pathname.startsWith('/file/')) {
            const fname = decodeURIComponent(url.pathname.slice('/file/'.length));
            const full = path.join(FONTS_DIR, fname);
            if (!ALLOWED_EXT.includes(extOf(fname)) || !full.startsWith(FONTS_DIR + path.sep)) {
                res.statusCode = 400;
                res.end('Invalid font file name.');
                return;
            }
            // Only serve files that the manifest actually registered.
            const manifest = await readManifest();
            if (!manifest.fonts.some(f => f.file === fname)) {
                res.statusCode = 404;
                res.end('Font not registered in manifest.');
                return;
            }
            let data;
            try {
                data = await readFile(full);
            } catch {
                res.statusCode = 404;
                res.end('Font file missing on disk.');
                return;
            }
            res.setHeader('Content-Type', MIME[extOf(fname)] || 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-store');
            res.end(data);
            return;
        }

        if (req.method === 'GET' && url.pathname === '/') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(await readManifest()));
            return;
        }

        if (req.method === 'POST' && url.pathname === '/') {
            const ext = extOf(req.headers['x-font-ext']);
            if (!ALLOWED_EXT.includes(ext)) {
                res.statusCode = 400;
                res.end('Unsupported font extension. Use .ttf, .otf, .woff, or .woff2.');
                return;
            }
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > MAX_SIZE) {
                    res.statusCode = 413;
                    res.end('Font file too large (max 25 MB).');
                    return;
                }
                chunks.push(chunk);
            }
            const buf = Buffer.concat(chunks);
            if (!hasValidSignature(buf)) {
                res.statusCode = 400;
                res.end('Not a valid font file — magic-byte check failed. Only real .ttf/.otf/.woff/.woff2 files are accepted.');
                return;
            }
            await mkdir(FONTS_DIR, { recursive: true });

            const id = crypto.randomUUID().slice(0, 8);
            const fname = `${id}${ext}`;
            const entry = {
                id,
                name: cleanName(decodeURIComponent(req.headers['x-font-name'] || '')),
                file: fname,
                weight: cleanWeight(req.headers['x-font-weight']),
                addedAt: new Date().toISOString(),
            };

            const manifest = await readManifest();
            // Re-importing the same font name replaces the old copy.
            manifest.fonts = manifest.fonts.filter(f => f.name !== entry.name);
            manifest.fonts.push(entry);
            await writeFile(path.join(FONTS_DIR, fname), buf);
            await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(entry));
            return;
        }

        res.statusCode = 405;
        res.end('Method not allowed.');
    })().catch(err => {
        console.error('[user-fonts]', err);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Server error: ' + err.message);
        }
    });
}

export default function userFontsPlugin() {
    return {
        name: 'user-fonts',
        configureServer(server) {
            server.middlewares.use('/api/fonts', handle);
        },
        configurePreviewServer(server) {
            server.middlewares.use('/api/fonts', handle);
        },
    };
}
