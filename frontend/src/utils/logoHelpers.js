/**
 * Logo and Favicon helper utilities for Voyarr UI.
 * Standardizes domain favicon resolution, Clearbit legacy migration,
 * and safe fallback logo rendering across all entity cards (Studios, Providers, Billers).
 */

export const getSafeLogoUrl = (url) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'logo.clearbit.com' || parsed.hostname.endsWith('.logo.clearbit.com')) {
      const domain = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (domain) {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      }
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    return '';
  }
  return '';
};

export const getFaviconFromUrl = (webUrl) => {
  if (!webUrl) return '';
  try {
    const parsed = new URL(webUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const domain = parsed.hostname.replace(/^www\./, '');
    if (domain) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
  } catch (e) {
    return '';
  }
  return '';
};
