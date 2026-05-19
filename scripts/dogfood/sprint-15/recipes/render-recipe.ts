// Sprint 15 (ADR-054): emits a Goose recipe JSON to stdout. Invoked by
// the eval orchestrator. Imports the production recipe builders directly
// via tsx so the eval exercises the same code path as the UI.
//
// Usage:
//   tsx render-recipe.ts onboarding [--tavily-key <KEY>]
//   tsx render-recipe.ts practice-area --area <ID> --working-dir <PATH> \
//     --state-folder <PATH> --profile <PATH> [--tavily-key <KEY>]
//   tsx render-recipe.ts persona --persona <PATH>
//   tsx render-recipe.ts judge --axis <coverage|efficiency|downstream-briefing|regulatory-fit>

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildOnboardingRecipe } from '../../../../ui/desktop/src/components/oscar/onboarding/onboardingRecipe';
import { buildPracticeAreaRecipe } from '../../../../ui/desktop/src/components/oscar/recipe/buildPracticeAreaRecipe';
import { buildCommercialRecipe } from '../../../../ui/desktop/src/components/oscar/commercial/commercialRecipe';
import { PRACTICE_AREAS } from '../../../../ui/desktop/src/components/oscar/practiceAreas';
import type { TavilyKey } from '../../../../ui/desktop/src/components/oscar/onboarding/resolveTavilyKey';
import type {
  OscarCompanyContext,
  OscarUserProfile,
} from '../../../../ui/desktop/src/components/oscar/hooks/useOscarProfile';

function parseArg(name: string): string | null {
  const argv = process.argv;
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : null;
}

function loadTavilyFromArgOrSecrets(): TavilyKey | null {
  const fromArg = parseArg('tavily-key');
  if (fromArg) return { apiKey: fromArg, source: 'env' };
  const envKey = process.env.TAVILY_API_KEY?.trim();
  if (envKey) return { apiKey: envKey, source: 'env' };
  const secretsPath =
    process.env.OSCAR_TAVILY_PATH ||
    join(process.env.HOME ?? '', '.config', 'oscar', 'secrets', 'tavily.json');
  try {
    const raw = readFileSync(secretsPath, 'utf8');
    const parsed = JSON.parse(raw) as { api_key?: unknown };
    if (typeof parsed.api_key === 'string' && parsed.api_key.trim().length > 0) {
      return { apiKey: parsed.api_key.trim(), source: 'file' };
    }
  } catch {
    /* absent — fine */
  }
  return null;
}

function loadProfile(path: string): OscarUserProfile {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as OscarUserProfile;
}

function loadPersona(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function emit(recipe: unknown): void {
  process.stdout.write(JSON.stringify(recipe, null, 2));
}

const kind = process.argv[2];

if (kind === 'onboarding') {
  const tavily = loadTavilyFromArgOrSecrets();
  emit(buildOnboardingRecipe({ resourcesRoot: null, tavily }));
} else if (kind === 'practice-area') {
  const areaId = parseArg('area');
  const workingDir = parseArg('working-dir');
  const stateFolder = parseArg('state-folder');
  const profilePath = parseArg('profile');
  if (!areaId || !workingDir || !stateFolder || !profilePath) {
    console.error(
      'Usage: render-recipe.ts practice-area --area ID --working-dir PATH --state-folder PATH --profile PATH [--tavily-key KEY]',
    );
    process.exit(2);
  }
  const area = PRACTICE_AREAS.find((a) => a.id === areaId);
  if (!area) {
    console.error(`Unknown practice area: ${areaId}`);
    process.exit(2);
  }
  const profile = loadProfile(profilePath);
  const companyContext: OscarCompanyContext | null = profile.company_context ?? null;
  const tavily = loadTavilyFromArgOrSecrets();
  const recipe =
    area.id === 'commercial'
      ? buildCommercialRecipe(workingDir, stateFolder, null, tavily, companyContext)
      : buildPracticeAreaRecipe({
          area,
          workingDir,
          stateFolder,
          resourcesRoot: null,
          tavily,
          companyContext,
        });
  emit(recipe);
} else if (kind === 'persona') {
  const personaPath = parseArg('persona');
  if (!personaPath) {
    console.error('Usage: render-recipe.ts persona --persona PATH');
    process.exit(2);
  }
  const p = loadPersona(personaPath);
  // The persona-driver is a single-shot LLM that plays the lawyer. It
  // gets only a system prompt; the orchestrator passes the intake-
  // agent's latest message as -t input each call. No tools. No session
  // (caller uses --no-session).
  const systemPrompt = [
    `You are role-playing ${(p.identity as { name: string }).name}, ${(p.identity as { role_label: string }).role_label} at ${(p.identity as { company: string }).company}.`,
    '',
    'Your seed facts (do not invent beyond these; you may decline to share if asked something not in the seed):',
    '',
    '```json',
    JSON.stringify(
      {
        industry: p.industry_seed,
        geography: p.geography_seed,
        regulatory: p.regulatory_seed,
        recurring_matters: p.recurring_matters_seed,
        stakeholders: p.stakeholders_seed,
        risk_appetite: p.risk_appetite_seed,
        open_notes: p.open_notes_seed,
        practice_areas_to_select: p.practice_areas_to_select,
        areas_to_drop: p.areas_to_drop,
        custom_practice_areas_to_add: p.custom_practice_areas_to_add ?? [],
      },
      null,
      2,
    ),
    '```',
    '',
    `Conversation style: ${p.conversation_style as string}.`,
    '',
    "The system you're talking to is an onboarding agent for an in-house legal tool. Respond as the lawyer in plain English — short turns, one or two sentences. Reveal facts from your seed when asked, organically and without volunteering every detail. If asked something not in the seed, decline naturally (e.g. \"I'd rather not share that\") OR give a plausible short answer marked clearly as inferred (e.g. \"probably around X but I'd need to check\"). Never narrate your role-play; never mention that you are a synthetic persona. Output only what the lawyer would say.",
  ].join('\n');
  emit({
    version: '1.0.0',
    title: `Persona — ${(p.identity as { name: string }).name}`,
    description: `Synthetic in-house-lawyer persona for Sprint 15 eval (${p.id as string}).`,
    instructions: systemPrompt,
    extensions: [],
    settings: { goose_provider: 'minimax', goose_model: 'MiniMax-M2.5' },
  });
} else if (kind === 'judge') {
  const axis = parseArg('axis');
  if (!axis || !['coverage', 'efficiency', 'downstream-briefing', 'regulatory-fit'].includes(axis)) {
    console.error('Usage: render-recipe.ts judge --axis coverage|efficiency|downstream-briefing|regulatory-fit');
    process.exit(2);
  }
  const promptPath = resolve(__dirname, '..', 'judge-prompts', `${axis}.md`);
  const judgeBody = readFileSync(promptPath, 'utf8');
  emit({
    version: '1.0.0',
    title: `Judge — ${axis}`,
    description: `Sprint 15 model-as-judge for the ${axis} axis.`,
    instructions: judgeBody,
    extensions: [],
    settings: { goose_provider: 'minimax', goose_model: 'MiniMax-M2.5' },
  });
} else {
  console.error(
    'Usage: render-recipe.ts onboarding | practice-area | persona | judge [...flags]',
  );
  process.exit(2);
}
