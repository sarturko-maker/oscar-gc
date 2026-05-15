import { describe, expect, it } from 'vitest';
import {
  defaultClaudeThinkingEffort,
  getClaudeThinkingEffortValues,
  getClaudeThinkingTypeValues,
  normalizeClaudeThinkingEffort,
  supportsAdaptiveThinking,
  supportsEnabledThinking,
} from './claudeThinking';

describe('Claude thinking model capabilities', () => {
  it('supports adaptive thinking but not fixed-budget thinking for Opus 4.7', () => {
    expect(supportsAdaptiveThinking('claude-opus-4-7')).toBe(true);
    expect(supportsEnabledThinking('claude-opus-4-7')).toBe(false);
    expect(getClaudeThinkingTypeValues('claude-opus-4-7')).toEqual(['adaptive', 'disabled']);
  });

  it('includes xhigh effort and defaults to it for Opus 4.7', () => {
    expect(getClaudeThinkingEffortValues('claude-opus-4-7')).toEqual([
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ]);
    expect(defaultClaudeThinkingEffort('claude-opus-4-7')).toBe('xhigh');
  });

  it('keeps existing Claude 4.6 thinking options', () => {
    expect(getClaudeThinkingTypeValues('claude-opus-4-6')).toEqual([
      'adaptive',
      'enabled',
      'disabled',
    ]);
    expect(getClaudeThinkingEffortValues('claude-opus-4-6')).toEqual([
      'low',
      'medium',
      'high',
      'max',
    ]);
    expect(defaultClaudeThinkingEffort('claude-opus-4-6')).toBe('high');
  });

  it('normalizes unsupported effort values by model', () => {
    expect(normalizeClaudeThinkingEffort('claude-sonnet-4-6', 'xhigh')).toBe('high');
    expect(normalizeClaudeThinkingEffort('claude-opus-4-7', 'xhigh')).toBe('xhigh');
  });
});
