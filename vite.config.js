import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' 让构建产物可以部署在任意子路径下;
// 不注入任何分析脚本、不上传 sourcemap,保持构建产物"零外联"。
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
