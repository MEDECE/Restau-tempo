import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Expose test3d.html comme page additionnelle
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        test3d: 'test3d.html',
      },
    },
  },
})
