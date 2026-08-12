// Downloads the built-in brand-style font families from Google Fonts into
// resources/fonts/ and writes a fonts.css with @font-face rules.
//
// Families were chosen for their MAANG / luxury-brand associations:
//   Inter            – GitHub, Figma, Mozilla
//   Roboto           – Google / Android
//   Poppins          – tech-startup & big-tech marketing
//   Montserrat       – luxury fashion web presence
//   Playfair Display – luxury editorial (Didot / Vogue style)
//
// Google serves some families (Inter, Roboto, Montserrat, Playfair Display)
// as variable fonts: every weight points at the same file. Those get one
// @font-face with `font-weight: 100 900`. Static families (Poppins) get one
// face per weight.
//
// Usage: node scripts/download-fonts.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const OUT = path.resolve('resources/fonts');

const FONTS = {
    'Inter': [400, 500, 600, 700, 800],
    'Roboto': [400, 500, 700],
    'Poppins': [400, 500, 600, 700],
    'Montserrat': [400, 500, 600, 700],
    'Playfair Display': [400, 500, 600, 700],
};

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

await mkdir(OUT, { recursive: true });

// Latin unicode range: U+0000-00FF
const isLatin = range => range && /U\+0000-00FF/.test(range);

const familyCss = [];
let fileCount = 0;

for (const [family, weights] of Object.entries(FONTS)) {
    const api = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weights.join(';')}&display=swap`;
    const res = await fetch(api, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Fonts API failed for ${family}: ${res.status} ${res.statusText}`);
    const text = await res.text();

    // Collect (weight, latin url) pairs from the @font-face blocks.
    const faces = [];
    for (const block of text.split('@font-face').slice(1)) {
        const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
        const range = block.match(/unicode-range:\s*([^;]+)/)?.[1];
        const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
        if (weight && url && isLatin(range)) faces.push({ weight, url });
    }
    if (!faces.length) throw new Error(`No latin @font-face blocks parsed for ${family}`);

    const isVariable = new Set(faces.map(f => f.url)).size === 1;

    if (isVariable) {
        const fname = `${slug(family)}-latin.woff2`;
        const fr = await fetch(faces[0].url, { headers: { 'User-Agent': UA } });
        if (!fr.ok) throw new Error(`Download failed for ${family}: ${fr.status}`);
        await writeFile(path.join(OUT, fname), Buffer.from(await fr.arrayBuffer()));
        fileCount++;
        console.log(`downloaded ${fname} (variable, weights ${weights.join(', ')})`);
        familyCss.push(`@font-face {\n    font-family: '${family}';\n    font-style: normal;\n    font-weight: 100 900;\n    font-display: swap;\n    src: url('./${fname}') format('woff2');\n}\n`);
    } else {
        for (const { weight, url } of faces) {
            const fname = `${slug(family)}-${weight}-latin.woff2`;
            const fr = await fetch(url, { headers: { 'User-Agent': UA } });
            if (!fr.ok) throw new Error(`Download failed for ${family} ${weight}: ${fr.status}`);
            await writeFile(path.join(OUT, fname), Buffer.from(await fr.arrayBuffer()));
            fileCount++;
            console.log(`downloaded ${fname} (${family} ${weight})`);
            familyCss.push(`@font-face {\n    font-family: '${family}';\n    font-style: normal;\n    font-weight: ${weight};\n    font-display: swap;\n    src: url('./${fname}') format('woff2');\n}\n`);
        }
    }
}

await writeFile(path.join(OUT, 'fonts.css'), familyCss.join('\n'));
console.log(`\nWrote ${fileCount} font file(s) and fonts.css`);
