import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

//// Neoffice — le build vise une app Frappe, pas un nginx autonome.
////   base    → /assets/opengym/frontend/, parce que Frappe sert le public/
////             d'une app depuis /assets/<app>/ et que les noms hachés doivent
////             résoudre depuis là quelle que soit la route de la SPA.
////   outDir  → ../opengym/public/frontend, COMMITÉ : la flotte ne recompile
////             JAMAIS une SPA sur une instance, elle sert des assets déjà faits.
////   manifest → pour que gym.py lise les noms hachés au lieu qu'on les fige
////             dans la coquille à chaque release.
//// Le plugin Umami de l'amont est conservé tel quel : il ne s'injecte que si
//// les deux variables sont posées, donc un build Neoffice reste sans télémétrie.
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
