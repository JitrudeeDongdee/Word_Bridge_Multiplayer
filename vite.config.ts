import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // Served at the root of wordbridgemultiplayer.thaidongdee.com (public/CNAME); GitHub redirects
  // the old jitrudeedongdee.github.io/Word_Bridge_Multiplayer/ URLs there.
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Database rules tests need the Firebase emulator: npm run test:rules
    exclude: ['**/node_modules/**', 'rules-tests/**'],
  },
})
