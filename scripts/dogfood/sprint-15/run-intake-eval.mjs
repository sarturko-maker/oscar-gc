#!/usr/bin/env node
// Sprint 15 (ADR-054): top-level eval orchestrator. For one persona,
// runs the intake end-to-end against the production onboarding recipe,
// captures the transcript + produced profile, runs the persona's
// first-turn questions against two practice-area recipes (with
// company_context injected per ADR-053), then invokes the three judges.
//
// Usage:
//   node run-intake-eval.mjs --persona sarah-chen [--iteration 1]
//
// Pre-reqs:
//   - goose CLI on PATH or at GOOSE_BIN env var.
//   - goose's config.yaml has goose_provider=minimax + provider key.
//   - oscar-onboarding-mcp dist built (`cd /srv/projects/oscar-onboarding-mcp && npm run build`).
//   - Tavily key resolvable via env TAVILY_API_KEY or ~/.config/oscar/secrets/tavily.json.
//
// Output layout:
//   docs/sprint-15/eval/iter-<N>/<persona-id>/
//     ├── transcript.md
//     ├── profile.json
//     ├── recipe-intake.json
//     ├── first-responses/
//     │     ├── <area-1>.md
//     │     └── <area-2>.md
//     └── scores/
//           ├── coverage.json
//           ├── efficiency.json
//           └── downstream-briefing.json

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '..', '..', '..');
const GOOSE_BIN = process.env.GOOSE_BIN || join(REPO_ROOT, 'target', 'release', 'goose');
const TSX_BIN = join(REPO_ROOT, 'ui', 'desktop', 'node_modules', '.bin', 'tsx');
const RENDER_RECIPE = join(here, 'recipes', 'render-recipe.ts');
const PERSONAS_DIR = join(here, 'personas');
const TURN_HARD_CAP = 22; // ADR-050 budget is 14; this is the abort cap.

function parseFlag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}

function log(msg) {
  process.stderr.write(`[eval] ${msg}\n`);
}

function runProcess(cmd, args, { cwd, env, input } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, {
      cwd: cwd ?? REPO_ROOT,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else
        reject(
          new Error(`${cmd} exited ${code}\nstderr:\n${stderr}\nstdout:\n${stdout.slice(-400)}`),
        );
    });
    child.on('error', reject);
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function renderRecipe(kind, extraArgs = []) {
  const { stdout } = await runProcess(TSX_BIN, [RENDER_RECIPE, kind, ...extraArgs]);
  return JSON.parse(stdout);
}

async function writeJson(path, obj) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(obj, null, 2), 'utf8');
}

async function writeText(path, text) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, text, 'utf8');
}

async function gooseOneShot(recipePath, text, { sessionId, resume, profilePath } = {}) {
  const args = ['run', '--recipe', recipePath, '--quiet', '--output-format', 'json', '-t', text];
  if (sessionId) args.push('--session-id', sessionId);
  if (resume) args.push('--resume');
  else if (!sessionId) args.push('--no-session');
  const env = {};
  if (profilePath) env.OSCAR_PROFILE_PATH = profilePath;
  const { stdout, stderr } = await runProcess(GOOSE_BIN, args, { env });
  return { stdout, stderr };
}

function extractAgentTextFromGooseOutput(stdout) {
  // Goose --output-format json emits one JSON object per turn. Pull the
  // last assistant message text. Tolerant of multi-line / streamed output.
  const text = stdout.trim();
  // Try simple JSON parse first; otherwise pick text fields heuristically.
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed.text === 'string') return parsed.text;
    if (parsed && parsed.message && typeof parsed.message.text === 'string')
      return parsed.message.text;
  } catch {
    /* fall through */
  }
  // Fall back: take everything after the last newline block boundary.
  return text;
}

async function readProfileIfWritten(profilePath) {
  try {
    const raw = await fs.readFile(profilePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function runIntake(persona, outDir) {
  const tmp = await mkdtemp(join(tmpdir(), `oscar-eval-${persona.id}-`));
  const profilePath = join(tmp, 'profile.json');
  // Recipes carry the Tavily key in the SSE URI — keep them OUT of the
  // committed docs/ directory and under /tmp instead. ADR-052 redaction
  // discipline.
  const intakeRecipePath = join(tmp, 'recipe-intake.json');
  const personaRecipePath = join(tmp, 'recipe-persona.json');
  const sessionId = `eval-${persona.id}-${randomUUID().slice(0, 8)}`;

  const intakeRecipe = await renderRecipe('onboarding');
  await writeJson(intakeRecipePath, intakeRecipe);
  const personaRecipe = await renderRecipe('persona', [
    '--persona',
    join(PERSONAS_DIR, `${persona.id}.json`),
  ]);
  await writeJson(personaRecipePath, personaRecipe);

  // Seed turn = the persona's name (response to greeting). We pre-compose
  // it from the seed so the harness doesn't depend on a persona-driver
  // call before the first agent response exists.
  const seedTurn = persona.identity.name;

  const transcriptTurns = [];
  log(`[${persona.id}] starting intake session ${sessionId}`);

  // Turn 0 — user (persona) opens with name.
  transcriptTurns.push({ role: 'user', text: seedTurn });
  let nextUserTurn = seedTurn;
  let firstCall = true;

  for (let turnIndex = 0; turnIndex < TURN_HARD_CAP; turnIndex++) {
    const { stdout: agentOut } = await gooseOneShot(intakeRecipePath, nextUserTurn, {
      sessionId,
      resume: !firstCall,
      profilePath,
    });
    firstCall = false;
    const agentText = extractAgentTextFromGooseOutput(agentOut);
    transcriptTurns.push({ role: 'agent', text: agentText });
    log(`[${persona.id}] turn ${turnIndex}: agent ${agentText.slice(0, 80).replace(/\n/g, ' ')}…`);

    // Done? Check whether profile was written.
    const writtenProfile = await readProfileIfWritten(profilePath);
    if (writtenProfile && writtenProfile.schema_version === 3) {
      log(`[${persona.id}] profile written; intake complete after ${turnIndex + 1} agent turns`);
      return {
        sessionId,
        profile: writtenProfile,
        transcriptTurns,
        agentTurnCount: turnIndex + 1,
      };
    }

    // Otherwise ask persona-driver for next user turn.
    const { stdout: personaOut } = await gooseOneShot(personaRecipePath, agentText, {});
    const userText = extractAgentTextFromGooseOutput(personaOut).trim();
    transcriptTurns.push({ role: 'user', text: userText });
    nextUserTurn = userText;
  }

  log(`[${persona.id}] hit hard-cap ${TURN_HARD_CAP} without finalize_profile`);
  return {
    sessionId,
    profile: await readProfileIfWritten(profilePath),
    transcriptTurns,
    agentTurnCount: TURN_HARD_CAP,
    aborted: 'hard-cap',
  };
}

async function runPracticeAreaFirstTurn(persona, profile, areaId, question, outDir) {
  // Build a synthetic matter folder structure for the eval.
  const workingDir = await mkdtemp(join(tmpdir(), `oscar-pa-${persona.id}-${areaId}-`));
  const stateFolder = await mkdtemp(join(tmpdir(), `oscar-pa-state-${persona.id}-${areaId}-`));
  await fs.writeFile(
    join(workingDir, 'matter.md'),
    `# ${persona.identity.company} — eval matter (${areaId})\n\nSynthetic Sprint 15 eval.\n`,
    'utf8',
  );

  // Profile is committed to docs/; recipes (Tavily key) stay in /tmp.
  const profileTmpPath = join(outDir, 'profile.json');
  await writeJson(profileTmpPath, profile);

  const recipeTmp = await mkdtemp(join(tmpdir(), `oscar-pa-recipe-${persona.id}-`));
  const paRecipe = await renderRecipe('practice-area', [
    '--area',
    areaId,
    '--working-dir',
    workingDir,
    '--state-folder',
    stateFolder,
    '--profile',
    profileTmpPath,
  ]);
  const paRecipePath = join(recipeTmp, `recipe-pa-${areaId}.json`);
  await writeJson(paRecipePath, paRecipe);

  const { stdout } = await gooseOneShot(paRecipePath, question, {});
  return extractAgentTextFromGooseOutput(stdout);
}

async function runJudge(axis, body) {
  const judgeRecipe = await renderRecipe('judge', ['--axis', axis]);
  const tmp = await mkdtemp(join(tmpdir(), `oscar-judge-${axis}-`));
  const recipePath = join(tmp, `judge-${axis}.json`);
  await writeJson(recipePath, judgeRecipe);
  const { stdout } = await gooseOneShot(recipePath, body, {});
  const raw = extractAgentTextFromGooseOutput(stdout);
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    // Try to extract a JSON object from the text.
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* ignore */
      }
    }
    return { axis, score: null, rationale: 'parse failure', raw, specific_gaps: [] };
  }
}

function transcriptToMarkdown(turns) {
  return turns
    .map((t) => (t.role === 'user' ? `## User\n\n${t.text}` : `## Oscar\n\n${t.text}`))
    .join('\n\n---\n\n');
}

async function main() {
  const personaId = parseFlag('persona');
  const iteration = parseFlag('iteration') ?? '1';
  if (!personaId) {
    console.error('Usage: run-intake-eval.mjs --persona <id> [--iteration <N>]');
    process.exit(2);
  }
  const personaPath = join(PERSONAS_DIR, `${personaId}.json`);
  const persona = JSON.parse(await fs.readFile(personaPath, 'utf8'));
  const outDir = join(REPO_ROOT, 'docs', 'sprint-15', 'eval', `iter-${iteration}`, personaId);
  await fs.mkdir(outDir, { recursive: true });

  log(`persona ${personaId} → ${outDir}`);
  const intake = await runIntake(persona, outDir);
  await writeText(join(outDir, 'transcript.md'), transcriptToMarkdown(intake.transcriptTurns));
  if (intake.profile) await writeJson(join(outDir, 'profile.json'), intake.profile);

  const firstQuestions = persona.first_turn_questions ?? {};
  const firstResponses = {};
  if (intake.profile) {
    for (const [areaId, question] of Object.entries(firstQuestions)) {
      log(`[${persona.id}] practice-area first turn: ${areaId}`);
      try {
        const response = await runPracticeAreaFirstTurn(
          persona,
          intake.profile,
          areaId,
          question,
          outDir,
        );
        firstResponses[areaId] = response;
        await writeText(join(outDir, 'first-responses', `${areaId}.md`), response);
      } catch (err) {
        log(`[${persona.id}] practice-area ${areaId} failed: ${err.message}`);
        firstResponses[areaId] = `(failed: ${err.message})`;
      }
    }
  }

  const transcriptText = transcriptToMarkdown(intake.transcriptTurns);
  const scores = {};

  // Coverage axis
  scores.coverage = await runJudge(
    'coverage',
    JSON.stringify({
      persona_seed: persona,
      company_context: intake.profile?.company_context ?? null,
      transcript: transcriptText,
    }),
  );
  await writeJson(join(outDir, 'scores', 'coverage.json'), scores.coverage);

  // Efficiency axis
  scores.efficiency = await runJudge(
    'efficiency',
    JSON.stringify({
      conversation_style: persona.conversation_style,
      transcript: transcriptText,
      turn_count: intake.agentTurnCount,
    }),
  );
  await writeJson(join(outDir, 'scores', 'efficiency.json'), scores.efficiency);

  // Downstream-briefing axis (one judge call per area)
  scores.downstream_briefing = {};
  for (const [areaId, question] of Object.entries(firstQuestions)) {
    if (!firstResponses[areaId] || firstResponses[areaId].startsWith('(failed')) {
      scores.downstream_briefing[areaId] = { score: null, rationale: 'no response captured' };
      continue;
    }
    scores.downstream_briefing[areaId] = await runJudge(
      'downstream-briefing',
      JSON.stringify({
        persona_seed: persona,
        area_id: areaId,
        first_turn_question: question,
        company_context_block: intake.profile?.company_context ?? null,
        first_response: firstResponses[areaId],
      }),
    );
    await writeJson(
      join(outDir, 'scores', `downstream-briefing-${areaId}.json`),
      scores.downstream_briefing[areaId],
    );
  }

  await writeJson(join(outDir, 'scores', 'all.json'), {
    persona_id: persona.id,
    agent_turn_count: intake.agentTurnCount,
    aborted: intake.aborted ?? null,
    scores,
  });
  log(`[${persona.id}] complete. scores → ${join(outDir, 'scores/all.json')}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
