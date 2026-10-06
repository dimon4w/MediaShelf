import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiPort = Number(process.env.API_PORT ?? 4174)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // changeOrigin stays false so the API sees the browser's Host and the Origin check passes.
    proxy: { '/api': { target: `http://127.0.0.1:${apiPort}` } },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
