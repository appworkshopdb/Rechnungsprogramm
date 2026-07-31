import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative Pfade, damit der Build unabhängig vom Repo-Namen auch unter
  // https://<user>.github.io/<repo>/ korrekt lädt (GitHub Pages).
  base: './',
});
