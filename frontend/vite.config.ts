import { defineConfig, searchForWorkspaceRoot } from 'vite'
import path from 'path'
import { createRequire } from 'node:module'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const workspaceRoot = searchForWorkspaceRoot(process.cwd())
const projectRoot = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const vitePackageRoot = path.dirname(require.resolve('vite/package.json'))

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // Keep allow-list narrow while allowing the actual resolved Vite install path.
      allow: [workspaceRoot, projectRoot, vitePackageRoot],
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
