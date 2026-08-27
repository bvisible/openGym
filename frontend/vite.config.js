import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

//// Neoffice — this build targets a Frappe app, not a standalone nginx.
////   base     -> /assets/opengym/frontend/, because Frappe serves an app's
////              public/ under /assets/<app>/ and the hashed names must
////              resolve from there whatever route the SPA is on.
////   outDir   -> ../opengym/public/frontend, COMMITTED: the fleet NEVER
////              rebuilds a SPA on an instance, it serves prebuilt assets.
////   manifest -> so gym.py reads the hashed names instead of us freezing
////              them into the shell at every release.
//// Upstream's Umami plugin is kept as is: it only injects itself when both
//// variables are set, so a Neoffice build stays telemetry-free.
const backend = process.env.API_TARGET || 'http://127.0.0.1:8000'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

// Optional web analytics (Umami). Injected only when BOTH vars are set at build time,
// so a plain `npm run build` — and every self-hosted install — stays telemetry-free.
// Set for the public instance: VITE_UMAMI_SRC=https://stats.example/script.js VITE_UMAMI_ID=<uuid>
const umamiSrc = process.env.VITE_UMAMI_SRC
const umamiId = process.env.VITE_UMAMI_ID

const umami = {
  name: 'opengym-umami',
  transformIndexHtml() {
    if (!umamiSrc || !umamiId) return
    return [{
      tag: 'script',
      attrs: { defer: true, src: umamiSrc, 'data-website-id': umamiId },
      injectTo: 'head'
    }]
  }
}

export default defineConfig({
  plugins: [react(), umami],
  base: '/assets/opengym/frontend/',
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/img': { target: media, changeOrigin: true },
      '/gif': { target: media, changeOrigin: true }
    }
  },
  build: {
    outDir: '../opengym/public/frontend',
    emptyOutDir: true,
    manifest: true,
    chunkSizeWarningLimit: 1500
  }
})
