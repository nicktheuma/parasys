import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowFree =
    env.ALLOW_FREE_DESIGN_PACKAGE === 'true' || env.ALLOW_FREE_DESIGN_PACKAGE === '1'

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_ALLOW_FREE_DESIGN_PACKAGE': JSON.stringify(allowFree ? 'true' : 'false'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three', '@react-three/fiber', '@react-three/drei'],
            reactflow: ['@xyflow/react'],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          // Helps Set-Cookie from the API reach the browser when using the dev proxy
          cookieDomainRewrite: { '*': '' },
        },
      },
    },
  }
})
