import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

//// Neoffice — this build targets a Frappe app, not a standalone nginx.
////   base     -> /assets/opengym/frontend/, because Frappe serves an app's
////              public/ under /assets/<app>/ and the hashed names must
////              resolve from there whatever route the SPA is on. Upstream
////              switched this to './' for its Capacitor shells; we cannot,
////              the hashed names have to resolve from /assets whatever the
////              SPA route is.
////   outDir   -> ../opengym/public/frontend, COMMITTED: the fleet NEVER
////              rebuilds a SPA on an instance, it serves prebuilt assets.
////   manifest -> so gym.py reads the hashed names instead of us freezing
////              them into the shell at every release.
//// Upstream's Umami plugin is kept as is: it only injects itself when both
//// variables are set, so a Neoffice build stays telemetry-free.
//// API_TARGET defaults to Frappe's port, not upstream's Node server on 3000.
const backend = process.env.API_TARGET || 'http://127.0.0.1:8000'
// The API refuses a state-changing request that a browser sent from anywhere other than its own
// ORIGIN (the CSRF guard in api/server.js). The dev server is on a different port, so the page's
// real Origin is not ORIGIN — modern browsers get through on Sec-Fetch-Site: same-origin, and
// presenting the expected Origin here covers the ones that don't send it. Match your .env if you
// changed ORIGIN: API_ORIGIN=https://gym.example.com npm run dev
//// Neoffice — kept from upstream and inert here: our /api proxy talks to Frappe,
//// which gates on its own X-Frappe-CSRF-Token, not on Origin. It only matters to
//// somebody running `npm run dev` against upstream's Node server.
const apiOrigin = process.env.API_ORIGIN || 'http://localhost:8080'
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

// The version people are asked for in #install-help and on every bug report. Read from
// package.json so it cannot drift from the release it was built in, and inlined at build
// time so no runtime fetch is involved.
const pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkgVersion) },
  plugins: [react(), umami],
  base: '/assets/opengym/frontend/',
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true, headers: { Origin: apiOrigin } },
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
