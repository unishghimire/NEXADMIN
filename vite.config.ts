import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (!normalizedId.includes('node_modules')) return;
          if (normalizedId.includes('/react@') || normalizedId.includes('/node_modules/react/')) return 'react-core';
          if (normalizedId.includes('/react-dom@') || normalizedId.includes('/node_modules/react-dom/')) return 'react-dom-vendor';
          if (normalizedId.includes('/react-router')) return 'router-vendor';
          if (normalizedId.includes('/lucide-react')) return 'icons-vendor';
          if (normalizedId.includes('/firebase')) return 'firebase-vendor';
          return 'vendor';
        },
      },
    },
  },
});
