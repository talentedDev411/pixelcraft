import { defineConfig } from 'vite';
import { resolve } from 'path';
import userFontsPlugin from './scripts/user-fonts-plugin.mjs';

export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@resources': resolve(__dirname, 'resources'),
        },
    },
    plugins: [userFontsPlugin()],
});
