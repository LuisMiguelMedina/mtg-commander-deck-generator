export function resolveAnalyticsFunctionUrl(): string | undefined {
  const fromEnv = import.meta.env.VITE_ANALYTICS_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  return undefined;
}
