type AnalyticsValue = string | number | boolean | null | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: string, eventName: string, params?: Record<string, AnalyticsValue>) => void;
  }
}

function sanitizeParams(params?: Record<string, AnalyticsValue>) {
  if (!params) return undefined;

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  );
}

export function trackEvent(eventName: string, params?: Record<string, AnalyticsValue>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, sanitizeParams(params));
}
