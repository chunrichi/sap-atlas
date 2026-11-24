import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 让产物可以直接放在 GitHub Pages 的子路径下
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
})
