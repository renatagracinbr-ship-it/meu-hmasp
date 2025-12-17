const { resolve } = require('path');

module.exports = {
  root: '.',
  publicDir: 'Arquivos',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 5173,
    open: false, // Navegador abre via INICIAR.bat
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
};
