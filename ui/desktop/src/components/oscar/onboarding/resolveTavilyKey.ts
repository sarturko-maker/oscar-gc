// Sprint 15 (ADR-052): resolve the user's Tavily API key for the hosted
// SSE web-search extension. Tries env var first (dev / CI / launcher-
// wrapper env), then the user's secrets file at
// ~/.config/oscar/secrets/tavily.json (0600 perms). Returns null when
// neither is present — the caller MUST omit the Tavily extension from
// the recipe in that case; rule 4 of the intake prompt handles the
// absence silently.

export interface TavilyKey {
  apiKey: string;
  source: 'env' | 'file';
}

export async function resolveTavilyKey(): Promise<TavilyKey | null> {
  try {
    return await window.electron.oscarResolveTavilyKey();
  } catch {
    return null;
  }
}
