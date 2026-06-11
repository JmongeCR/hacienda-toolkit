import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/hacienda": {
        target: "https://api.hacienda.go.cr",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/hacienda/, ""),
      },
      "/bccr": {
        target: "https://gee.bccr.fi.cr",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/bccr/, ""),
      },
    },
  },
})
