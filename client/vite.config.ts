import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  envDir: '..',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false, // Smaller production bundle
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'query': ['@tanstack/react-query'],
          'maplibre': ['maplibre-gl'],
          'web3': ['wagmi', 'viem', '@rainbow-me/rainbowkit'],
          'charts': ['lightweight-charts'],
          'flexlayout': ['flexlayout-react'],
          'state': ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
