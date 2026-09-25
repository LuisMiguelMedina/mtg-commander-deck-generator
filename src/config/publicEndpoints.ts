/** Production analytics Lambda (also embedded in manafoundry.gg builds). Update after CDK redeploy. */
export const DEFAULT_ANALYTICS_FUNCTION_URL =
  'https://ge5snsne7lr62h44l7w5bm6z540hkpue.lambda-url.us-east-1.on.aws/';

export function resolveAnalyticsFunctionUrl(): string | undefined {
  const fromEnv = import.meta.env.VITE_ANALYTICS_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  if (import.meta.env.PROD) return DEFAULT_ANALYTICS_FUNCTION_URL;
  return undefined;
}
