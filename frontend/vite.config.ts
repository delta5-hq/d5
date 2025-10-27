import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      svgr(),
      // Remove crossorigin attribute for Safari compatibility
      // Safari has stricter CORS enforcement even for same-origin when crossorigin is present
      // See: https://github.com/vitejs/vite/issues/6648
      {
        name: 'remove-crossorigin',
        transformIndexHtml(html) {
          return html.replace(/ crossorigin/g, '');
        },
      },
      ...(mode === 'production'
        ? [
            obfuscatorPlugin({
              options: {
                compact: true,
                numbersToExpressions: true,
                simplify: true,
                stringArrayShuffle: true,
                splitStrings: true,
                stringArrayThreshold: 1,
                deadCodeInjection: true,
                debugProtection: false,
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@app': path.resolve(__dirname, 'src/app'),
        '@entities': path.resolve(__dirname, 'src/entities'),
        '@features': path.resolve(__dirname, 'src/features'),
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@widgets': path.resolve(__dirname, 'src/widgets'),
        '@processes': path.resolve(__dirname, 'src/processes'),
        '@/components': path.resolve(__dirname, 'src/shared/components'),
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            intl: ['react-intl'],
            icons: ['lucide-react'],
          },
        },
      },
    },
    define: {
      'import.meta.env.API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3001'),
      'import.meta.env.API_BASE_PATH': JSON.stringify(process.env.VITE_API_BASE_PATH || '/api/v1'),
    },
    server: {
      proxy: {
        '/api/v1': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
