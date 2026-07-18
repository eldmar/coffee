// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// TODO: replace with the real production domain before launch
const SITE_URL = 'https://thedailybrew.pages.dev';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react(), sitemap()],
});
