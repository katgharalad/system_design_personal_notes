import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/aws/compute/',
  plugins: [tailwindcss()],
  build: { outDir: '../compute', emptyOutDir: true },
  test: { environment: 'node' }
});
