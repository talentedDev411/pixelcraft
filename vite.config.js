import { defineConfig } from 'vite';
import userFontsPlugin from './scripts/user-fonts-plugin.mjs';

export default defineConfig({
    plugins: [userFontsPlugin()],
});
