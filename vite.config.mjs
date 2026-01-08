import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 這裡請先用你「準備建立的前端公開 repo 名稱」
// 我建議 repo 名稱就叫：tsmc-web-frontend
// 之後如果 repo 名稱不同，再回來改這一行即可
export default defineConfig({
  plugins: [react()],
  base: '/tsmc-web-frontend/',
})
