export type CookieConsentCategory = 'essential' | 'functional' | 'analytics';

export interface CookieConsentPreferences {
  essential: true; // Strictly required for security, auth, and routing
  functional: boolean; // Preferences like theme, active guild selection, UI layout
  analytics: boolean; // Telemetry, performance, and usage diagnostics
  updatedAt: string; // ISO Date String
}

export const COOKIE_CONSENT_KEY = 'gp_cookie_consent';

export const DEFAULT_CONSENT_PREFERENCES: CookieConsentPreferences = {
  essential: true,
  functional: false,
  analytics: false,
  updatedAt: new Date().toISOString(),
};

/**
 * Read current cookie consent preferences from storage/cookie
 */
export function getCookieConsent(): CookieConsentPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!item) return null;
    const parsed = JSON.parse(item) as CookieConsentPreferences;
    return {
      ...DEFAULT_CONSENT_PREFERENCES,
      ...parsed,
      essential: true,
    };
  } catch {
    return null;
  }
}

/**
 * Save cookie consent preferences and dispatch a notification event
 */
export function saveCookieConsent(prefs: Partial<Omit<CookieConsentPreferences, 'essential'>>): CookieConsentPreferences {
  const current = getCookieConsent() || DEFAULT_CONSENT_PREFERENCES;
  const updated: CookieConsentPreferences = {
    ...current,
    ...prefs,
    essential: true,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(updated));
      // Also store consent record in a standard cookie for edge worker inspection if needed
      document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(JSON.stringify(updated))}; path=/; max-age=31536000; SameSite=Lax; Secure`;
      window.dispatchEvent(new CustomEvent('gp-cookie-consent-change', { detail: updated }));
    } catch (e) {
      console.warn('[CookieConsent] Failed to write preferences:', e);
    }
  }

  return updated;
}

/**
 * Helper to check if a specific cookie category is consented to
 */
export function isCookieCategoryAllowed(category: CookieConsentCategory): boolean {
  if (category === 'essential') return true;
  const prefs = getCookieConsent();
  if (!prefs) return false;
  return !!prefs[category];
}
