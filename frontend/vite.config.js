import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

//// Neoffice — the build targets a Frappe app instead of a standalone nginx.
////
//// Upstream built into frontend/dist and let its own nginx serve it at the site
//// root, with /api proxied to the Node server. On Neoffice the journal is one
//// route of a Frappe site: the page shell comes from neoffice_gym (www/gym.py,
//// which is where the session and the boot data live), and this build only
//// produces the assets it loads.
////
//// Hence three changes:
////   base    → /assets/opengym/frontend/, because Frappe serves an app's
////             public/ folder from /assets/<app>/ and the hashed filenames must
////             resolve from there whatever route the SPA is on.
////   outDir  → ../opengym/public/frontend, committed. The fleet NEVER rebuilds a
////             SPA on an instance (see the build model in neoffice-devops):
////             assets are built in CI and shipped as-is.
////   manifest → so gym.py can read the hashed entry names instead of us
////             hardcoding them into the shell at every release.

const backend = process.env.API_TARGET || 'http://127.0.0.1:8000'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

export default defineConfig({
  plugins: [react()],
  base: '/assets/opengym/frontend/',
  server: {
    proxy: {
      //// Neoffice — /api now means the Frappe site, not the old Node server.
      '/api': { target: backend, changeOrigin: true },
      '/img': { target: media, changeOrigin: true },
      '/gif': { target: media, changeOrigin: true },
    },
  },
  build: {
    outDir: '../opengym/public/frontend',
    emptyOutDir: true,
    manifest: true,
    chunkSizeWarningLimit: 1500,
  },
})
