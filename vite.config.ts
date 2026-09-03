/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The one public origin. index.html derives every absolute URL in its Open
// Graph tags from it (share crawlers reject relative og:image paths), so a
// domain change is a one-line edit here. Runs before Vite's own %ENV%
// substitution so the placeholder never reaches it.
const SITE_URL = 'https://foreground-self.vercel.app'

function siteUrl(): Plugin {
  return {
    name: 'site-url',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.split('%SITE_URL%').join(SITE_URL),
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrl()],
  test: {
    environment: 'node',
    // api/ holds the serverless handler; its test drives the live-AI branch
    // with the Anthropic SDK mocked. Kept out of the api tsc build below.
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
  },
})
