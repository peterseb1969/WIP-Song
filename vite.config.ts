import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is served at the root of its own origin (https://<label>.<host>/),
// so Vite keeps its default base '/' and the dev proxy keys sit at the root.
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the containerizing proxy can reach the dev
    // server. Harmless on the host — the OS firewall normally still gates
    // external access.
    host: '0.0.0.0',
    port: 5181,
    proxy: {
      '/api': 'http://localhost:3016',
      '/wip': 'http://localhost:3016',
      '/server-api': 'http://localhost:3016',
    },
  },
})
