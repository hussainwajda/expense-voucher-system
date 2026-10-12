import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      rollupOptions: {
        output: {
          // Keep rarely-changing libraries in their own cached chunks.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router'],
            vendor: ['@tanstack/react-query', 'react-hook-form', '@hookform/resolvers', 'zod', 'lucide-react'],
          },
        },
      },
    },
    server: {
      port: 5173,
      // Same-origin API in development: the session cookie just works and no CORS is needed.
      proxy: {
        '/api': { target: env.VITE_API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true },
      },
    },
  };
});
