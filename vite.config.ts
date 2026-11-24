import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 让产物可以直接放在 GitHub Pages 的子路径下（配合 hash 路由，刷新不会 404）
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // 内容会经常改，框架不会：分开打，用户只用重下小的那个
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@xyflow') || id.includes('zustand')) return 'flow'
          return 'vendor'
        },
      },
    },
  },
})
