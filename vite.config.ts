import { defineConfig } from 'vite';

// Set GITHUB_PAGES=true when deploying to GitHub Pages
// e.g.  GITHUB_PAGES=true npm run build
// Or pass --base=/lucky-hands/ directly to vite build
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/lucky-hands/' : '/',
});
