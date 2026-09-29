export const APP_NAME = 'Voyarr';
import pkg from '../../package.json';
export const APP_VERSION = pkg.version;

export const AUTH_EXCLUSIONS = [
  '/api/health',
  '/api/status',
  '/api/fleet/status',
  '/api/auth/discord',
  '/api/auth/callback/discord',
  '/api/auth/pair',
  '/favicon.ico',
  '/brand/logo.svg',
  '/manifest.json'
];
