import { defineConfig, searchForWorkspaceRoot } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const workspaceRoot = searchForWorkspaceRoot(process.cwd())
const projectRoot = path.resolve(__dirname, '..')
const parentProjectDir = path.resolve(projectRoot, '..')

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
      // Allow monorepo/workspace roots plus one parent level to avoid
      // Vite allowlist failures when node_modules is resolved via a nearby clone.
      allow: [workspaceRoot, projectRoot, parentProjectDir],
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
