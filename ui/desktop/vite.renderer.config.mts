import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config
export default defineConfig({
  define: {
    'process.env.GOOSE_TUNNEL': JSON.stringify(process.env.GOOSE_TUNNEL !== 'no' && process.env.GOOSE_TUNNEL !== 'none'),
  },

  plugins: [tailwindcss()],

  // Sprint 17b (P7 Crostini dogfood): pnpm 11+ uses a hybrid linker — top-
  // level packages land as real directories under ui/node_modules/<name>/
  // (1094 of them) AND ui/desktop/node_modules/<name> is a symlink into
  // ui/node_modules/.pnpm/. That double presence makes Vite resolve react
  // from two absolute paths, and Rollup bundles two copies of react@19.2.4
  // in the same chunk. react-dom flips the dispatcher on one copy;
  // components import the other → "Cannot read properties of null (reading
  // 'useRef')" on every render. `dedupe` collapses both imports to a single
  // module id, restoring the single-React invariant React requires.
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },

  build: {
    target: 'esnext'
  },
});
