import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Deployment builds read no local .env files; only explicitly supplied public settings.
  envDir: process.env.OPH_BUILD_ENV_DIR || process.cwd(),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@frontend': path.resolve(__dirname, 'src/frontend'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.OPH_DEPLOY_BUILD !== '1',
  },
  server: {
    host: '0.0.0.0',
    port: 3001,
    proxy: { '/api': 'http://127.0.0.1:8787', '/sitemap.xml': 'http://127.0.0.1:8787', '/robots.txt': 'http://127.0.0.1:8787' },
    open: true,
  },
});
