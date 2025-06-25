import { defineConfig } from 'vite';
import { unstable_vitePlugin as remix } from '@remix-run/dev';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';
import UnoCSS from 'unocss/vite';
import optimizeCss from 'vite-plugin-optimize-css-modules';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    remix({
      ignoredRouteFiles: ['**/.*'],
    }),
    tsconfigPaths(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    react(),
    UnoCSS(),
    optimizeCss(),
  ],
  build: {
    // Memory optimizations for Cloudflare Pages
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 1, // Reduce memory usage
      }
    },
    rollupOptions: {
      output: {
        // Split chunks more aggressively to reduce memory pressure
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Group common dependencies
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('codemirror')) return 'vendor-codemirror';
            if (id.includes('@radix')) return 'vendor-radix';
            return 'vendor'; // Other dependencies
          }
        },
        // Limit chunk size
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
    // Ensure we don't exceed memory limits
    sourcemap: false,
    // Improve memory usage during build
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app'),
    },
  },
});
