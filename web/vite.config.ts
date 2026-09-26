import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Every supported browser has modulepreload; skips a script on the static home page.
    modulePreload: { polyfill: false },
    rollupOptions: {
      // home.html is prerendered by scripts/prerender.mjs after the build.
      input: {
        app: path.resolve(import.meta.dirname, 'index.html'),
        home: path.resolve(import.meta.dirname, 'home.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
