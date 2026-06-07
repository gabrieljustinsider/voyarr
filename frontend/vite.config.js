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
      includeAssets: ['favicon.ico', 'favicon-32x32.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Voyarr Media Manager',
        short_name: 'Voyarr',
        description: 'Automated Media Management & Ripping',
        theme_color: '#0b0f19',
        background_color: '#0b0f19',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  build: {
    // Vite 8 uses rolldown (Rust bundler) — use advancedChunks instead of
    // rollupOptions.manualChunks which is no longer supported.
    advancedChunks: {
      groups: [
        { name: 'mui-icons', test: /@mui\/icons-material/ },
        { name: 'mui',       test: /@mui\// },
        { name: 'recharts',  test: /recharts/ },
        { name: 'react-vendor', test: /node_modules\/react/ },
      ]
    }
  },
  server: {
    port: 3001,
    host: true,
    https: getHttpsConfig(),
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false, // Bypass SSL validation if backend is using self-signed certs
        rewrite: (path) => path.replace(/^\/api/, ''),
        ws: true // Enables WebSocket proxying for this route
      }
    }
  }
});