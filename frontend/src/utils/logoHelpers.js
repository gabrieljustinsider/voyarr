/**
 * Logo and Favicon helper utilities for Voyarr UI.
 * Standardizes domain favicon resolution, Clearbit legacy migration,
 * and safe fallback logo rendering across all entity cards (Studios, Providers, Billers).
 */

export const getSafeLogoUrl = (url) => {
  if (!url) return '';
  if (url.includes('logo.clearbit.com/')) {
    const domain = url.split('logo.clearbit.com/')[1];
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  }
  return url;
};

export const getFaviconFromUrl = (webUrl) => {
  if (!webUrl) return '';
  try {
    const domain = webUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    if (domain) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
  } catch (e) {
    return '';
  }
  return '';
};
