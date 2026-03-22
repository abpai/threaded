import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function resolveDevServerPort() {
  const fallbackPort = 3000
  const rawPort = process.env.PORT

  if (!rawPort) {
    return fallbackPort
  }

  const parsedPort = Number.parseInt(rawPort, 10)
  return Number.isNaN(parsedPort) ? fallbackPort : parsedPort
}

export default defineConfig({
  server: {
    port: resolveDevServerPort(),
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ['**/.DS_Store'],
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          katex: ['rehype-katex', 'katex'],
          highlight: ['rehype-highlight', 'highlight.js'],
          markdown: ['react-markdown', 'remark-math'],
          'ai-sdk': ['ai', '@ai-sdk/openai', '@ai-sdk/anthropic', '@ai-sdk/google'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
