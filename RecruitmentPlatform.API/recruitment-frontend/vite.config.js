import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CORS on the API is already configured for http://localhost:5173 (see
// Program.cs "AllowFrontend" policy), so no dev proxy is required.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
})
