import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const vendorChunks: Record<string, string[]> = {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-state': ['zustand', '@tanstack/react-query'],
  'vendor-network': ['axios', 'socket.io-client'],
  'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
  'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
  'vendor-export': ['html2canvas', 'jspdf'],
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          for (const [chunkName, packages] of Object.entries(vendorChunks)) {
            if (packages.some((packageName) => normalizedId.includes(`/node_modules/${packageName}/`))) {
              return chunkName;
            }
          }

          return undefined;
        },
      },
    },
  },
});
