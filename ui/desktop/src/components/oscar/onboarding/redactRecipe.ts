// Sprint 15 (ADR-052): if any code path serialises a Recipe to disk or
// to a log line, redact the Tavily SSE uri's tavilyApiKey query parameter
// first. The resolved Recipe object passed to goosed contains the user's
// Tavily key in plaintext (encoded as a query param); the audit posture
// promises that this credential never lands in committed files, build
// artefacts, or log files. Use this utility at any logging or
// serialisation boundary.

import type { Recipe } from '../../../api';

const TAVILY_REDACTION = 'tavilyApiKey=REDACTED';
const TAVILY_KEY_RE = /tavilyApiKey=[^&]+/g;

export function redactRecipeForLog(recipe: Recipe): Recipe {
  if (!recipe.extensions) return recipe;
  return {
    ...recipe,
    extensions: recipe.extensions.map((ext) => {
      if ((ext.type !== 'sse' && ext.type !== 'streamable_http') || !ext.uri) return ext;
      return { ...ext, uri: ext.uri.replace(TAVILY_KEY_RE, TAVILY_REDACTION) };
    }),
  };
}
