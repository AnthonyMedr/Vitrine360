/**
 * UTM and referrer tracking utilities
 * Captures marketing attribution data for lead events
 */

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const UTM_STORAGE_KEY = 'omnigrow_utm_data';

export interface UTMData {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

/**
 * Parse UTM parameters from URL
 */
export function parseUTMFromURL(url?: string): UTMData {
  try {
    const searchParams = new URLSearchParams(
      url ? new URL(url).search : window.location.search
    );

    const utm: UTMData = {};
    
    if (searchParams.has('utm_source')) utm.source = searchParams.get('utm_source')!;
    if (searchParams.has('utm_medium')) utm.medium = searchParams.get('utm_medium')!;
    if (searchParams.has('utm_campaign')) utm.campaign = searchParams.get('utm_campaign')!;
    if (searchParams.has('utm_term')) utm.term = searchParams.get('utm_term')!;
    if (searchParams.has('utm_content')) utm.content = searchParams.get('utm_content')!;

    return utm;
  } catch {
    return {};
  }
}

/**
 * Store UTM data in session storage (persists during session)
 */
export function storeUTMData(utm: UTMData): void {
  if (Object.keys(utm).length > 0) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }
}

/**
 * Get stored UTM data
 */
export function getStoredUTMData(): UTMData {
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Get current UTM data (from URL or storage)
 */
export function getCurrentUTM(): UTMData {
  // First check URL for fresh UTM params
  const fromURL = parseUTMFromURL();
  if (Object.keys(fromURL).length > 0) {
    storeUTMData(fromURL);
    return fromURL;
  }
  
  // Fall back to stored UTM
  return getStoredUTMData();
}

/**
 * Get current page context for events
 */
export function getPageContext(): {
  page_url: string;
  referrer: string;
  utm: UTMData;
} {
  return {
    page_url: window.location.href,
    referrer: document.referrer,
    utm: getCurrentUTM(),
  };
}

/**
 * Initialize UTM tracking on page load
 */
export function initializeUTMTracking(): void {
  const utm = parseUTMFromURL();
  if (Object.keys(utm).length > 0) {
    storeUTMData(utm);
    if (import.meta.env.DEV) {
      console.log('[UTM] Captured:', utm);
    }
  }
}
