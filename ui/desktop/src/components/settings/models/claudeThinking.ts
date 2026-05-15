export type ClaudeThinkingType = 'adaptive' | 'enabled' | 'disabled';
export type ClaudeThinkingEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export function isClaudeModel(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().startsWith('claude-');
}

export function isClaudeOpus47(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().includes('claude-opus-4-7');
}

export function supportsAdaptiveThinking(name: string | null | undefined): boolean {
  const lower = name?.toLowerCase() ?? '';
  return (
    isClaudeOpus47(lower) ||
    lower.includes('claude-opus-4-6') ||
    lower.includes('claude-sonnet-4-6')
  );
}

export function supportsEnabledThinking(name: string | null | undefined): boolean {
  return !isClaudeOpus47(name);
}

export function getClaudeThinkingTypeValues(name: string | null | undefined): ClaudeThinkingType[] {
  const values: ClaudeThinkingType[] = [];
  if (supportsAdaptiveThinking(name)) {
    values.push('adaptive');
  }
  if (supportsEnabledThinking(name)) {
    values.push('enabled');
  }
  values.push('disabled');
  return values;
}

export function getClaudeThinkingEffortValues(
  name: string | null | undefined
): ClaudeThinkingEffort[] {
  const values: ClaudeThinkingEffort[] = ['low', 'medium', 'high'];
  if (isClaudeOpus47(name)) {
    values.push('xhigh');
  }
  values.push('max');
  return values;
}

export function defaultClaudeThinkingEffort(name: string | null | undefined): ClaudeThinkingEffort {
  return isClaudeOpus47(name) ? 'xhigh' : 'high';
}

export function normalizeClaudeThinkingEffort(
  name: string | null | undefined,
  effort: string | null | undefined
): ClaudeThinkingEffort {
  const values = getClaudeThinkingEffortValues(name);
  return values.includes(effort as ClaudeThinkingEffort)
    ? (effort as ClaudeThinkingEffort)
    : defaultClaudeThinkingEffort(name);
}
