import { resolveAnalyticsFunctionUrl } from '@/config/publicEndpoints';

/** Build analytics Lambda Function URL requests (browser-safe — no direct Moxfield). */
export function buildAnalyticsActionUrl(
  action: string,
  params: Record<string, string> = {},
): string | null {
  if (import.meta.env.DEV) {
    const qs = new URLSearchParams(params).toString();
    const path =
      action === 'brawl-popularity'
        ? '/api/brawl-popularity'
        : action === 'brawl-top-commanders'
          ? '/api/brawl-top-commanders'
          : null;
    if (!path) return null;
    return qs ? `${path}?${qs}` : path;
  }
  const base = resolveAnalyticsFunctionUrl();
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function fetchAnalyticsAction<T>(action: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = buildAnalyticsActionUrl(action, params);
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
