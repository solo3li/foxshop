import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const blockScannerProbes = (): Plugin => ({
  name: 'block-scanner-probes',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url || '').split('?')[0].toLowerCase();
      if (
        url.startsWith('/.aws') ||
        url.startsWith('/.git') ||
        url.startsWith('/.env') ||
        url.startsWith('/.netrc') ||
        url.startsWith('/.pgpass') ||
        url.startsWith('/etc/') ||
        url === '/dockerfile'
      ) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), blockScannerProbes()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
});
