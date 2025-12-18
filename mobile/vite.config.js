import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    base: '/',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: './index.html'
        }
    },
    server: {
        port: 5173,
        host: true,
        open: false,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
});
