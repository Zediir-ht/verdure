import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/trefle-auth': {
        target: 'https://trefle.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trefle-auth/, '/api/auth/claim'),
      },
      '/trefle-api': {
        target: 'https://trefle.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trefle-api/, '/api/v1'),
      },
      '/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/anthropic/, ''),
      },
    },
  },
})
