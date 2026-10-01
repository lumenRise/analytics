import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '').replace(/\/v1$/, '')

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5180,
      strictPort: true,
      open: true,
      proxy: apiTarget ? {
        '/v1': { target: apiTarget, changeOrigin: true },
      } : undefined,
    },
  }
})
