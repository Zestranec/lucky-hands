import { GameApp } from './game/GameApp';

// import.meta.env.BASE_URL is set by Vite from the `base` config option.
// This ensures asset paths work correctly on GitHub Pages.
// Currently no static assets are loaded, but the pattern is here for future use.
const _base = import.meta.env.BASE_URL; // eslint-disable-line @typescript-eslint/no-unused-vars

const game = new GameApp();
game.init().catch((err) => {
  console.error('[LuckyHands] Failed to initialise game:', err);
});
