/* global process, __dirname */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

// Helper to load SSL certificates if they exist
const getHttpsConfig = () => {
  const keyPath = process.env.SSL_KEY_PATH || path.resolve(__dirname, '../certs/key.pem');
  const certPath = process.env.SSL_CERT_PATH || path.resolve(__dirname, '../certs/cert.pem');
  
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }
  return false; // Fallback to standard HTTP if no certificates are found
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Voyarr Media Manager',
        short_name: 'Voyarr',
        description: 'Automated Media Management & Ripping',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    host: true,
    https: getHttpsConfig(),
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false, // Bypass SSL validation if backend is using self-signed certs
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});