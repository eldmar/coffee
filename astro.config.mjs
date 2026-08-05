// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Update when a custom domain is connected
const SITE_URL = 'https://coffee.ridkous.workers.dev';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react(), sitemap()],
});
