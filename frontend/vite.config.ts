import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), svgr()],
    preview: {
      port: 8080,
      strictPort: true,
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: env.VITE_PROXY_API || 'http://localhost:8000', changeOrigin: true },
        '/media': { target: env.VITE_PROXY_MEDIA || 'http://localhost:9000', changeOrigin: true },
      },
      host: true,
      watch: {
        usePolling: true,
      },
    },
    base: '/',
    build: {
      //add this property for react devtools
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env': {},
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
  };
});
