// Sprint 24-C (ADR-081): subtractive-edit validator + unified-diff emitter.
// Layer B of the three-layer subtractive constraint (Layer A: system prompt;
// Layer C: human-eyeball diff at sprint close). Validates Claude's proposed
// removals: all end > start; no overlaps; net length is strictly negative;
// resulting prompt is a strict char-subset of the source.

'use strict';

function validateRemovals({ source, removals }) {
  if (!Array.isArray(removals)) {
    return { ok: false, reason: 'removals must be an array', removals };
  }
  if (removals.length === 0) {
    return { ok: false, reason: 'no removals proposed (subtractive iteration requires ≥1)', removals };
  }

  // Sort by start so we can check overlaps and bounds in one pass.
  const sorted = [...removals]
    .map((r, idx) => ({ ...r, _idx: idx }))
    .sort((a, b) => a.start - b.start);

  let totalRemoved = 0;
  let prevEnd = -1;
  for (const r of sorted) {
    if (typeof r.start !== 'number' || typeof r.end !== 'number') {
      return { ok: false, reason: `removal #${r._idx} missing numeric start/end`, removals };
    }
    if (!Number.isInteger(r.start) || !Number.isInteger(r.end)) {
      return { ok: false, reason: `removal #${r._idx} start/end must be integers`, removals };
    }
    if (r.start < 0 || r.end > source.length) {
      return {
        ok: false,
        reason: `removal #${r._idx} out of range [0, ${source.length}]`,
        removals,
      };
    }
    if (r.end <= r.start) {
      return { ok: false, reason: `removal #${r._idx} end must be > start`, removals };
    }
    if (r.start < prevEnd) {
      return {
        ok: false,
        reason: `removal #${r._idx} overlaps a prior removal`,
        removals,
      };
    }
    totalRemoved += r.end - r.start;
    prevEnd = r.end;
  }

  if (totalRemoved <= 0) {
    return { ok: false, reason: 'net diff length is not negative (no characters removed)', removals };
  }

  return { ok: true, totalRemoved, sortedRemovals: sorted };
}

function applyRemovals({ source, removals }) {
  const sorted = [...removals].sort((a, b) => a.start - b.start);
  const pieces = [];
  let cursor = 0;
  for (const r of sorted) {
    pieces.push(source.slice(cursor, r.start));
    cursor = r.end;
  }
  pieces.push(source.slice(cursor));
  return pieces.join('');
}

function strictSubsetCheck({ before, after, removals }) {
  // Confirms the after string is composed solely of characters from before,
  // in original order, minus the removed ranges. Catches Claude proposing a
  // removal that secretly inserts text in the same range.
  const applied = applyRemovals({ source: before, removals });
  return applied === after;
}

// Emits a basic unified-diff representation of the removed ranges. Not a
// full diff implementation; just enough for human eyeball review at Layer C.
function emitUnifiedDiff({ source, removals, beforeName = 'iter-k-1', afterName = 'iter-k' }) {
  const sorted = [...removals].sort((a, b) => a.start - b.start);
  const lines = [`--- ${beforeName}`, `+++ ${afterName}`];
  for (const r of sorted) {
    const removed = source.slice(r.start, r.end);
    const contextStart = Math.max(0, r.start - 40);
    const contextEnd = Math.min(source.length, r.end + 40);
    const contextBefore = source.slice(contextStart, r.start);
    const contextAfter = source.slice(r.end, contextEnd);
    lines.push(``);
    lines.push(`@@ chars ${r.start}-${r.end} (-${r.end - r.start}) @@`);
    if (r.rationale) lines.push(`# rationale: ${r.rationale}`);
    lines.push(` ${contextBefore.replace(/\n/g, '\\n')}`);
    for (const removedLine of removed.split('\n')) {
      lines.push(`-${removedLine}`);
    }
    lines.push(` ${contextAfter.replace(/\n/g, '\\n')}`);
  }
  return lines.join('\n');
}

module.exports = {
  validateRemovals,
  applyRemovals,
  strictSubsetCheck,
  emitUnifiedDiff,
};
