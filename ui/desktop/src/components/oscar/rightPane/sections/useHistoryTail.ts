// Sprint 20-M3 (ADR-083): History section data hook. Reads the session's
// message log from the existing /sessions/{session_id} route — no Rust
// touch (fork-hygiene). Reduces the full Conversation to a small list of
// {ts, role, summary} events with consecutive same-role + same-tool-name
// turns collapsed and a cap on the tail length.

import { useMemo } from 'react';
import {
  getSession,
  type Conversation,
  type MessageContent,
} from '../../../../api';
import { usePanelReader } from './usePanelReader';

export interface HistoryEvent {
  ts: number;
  role: 'user' | 'assistant';
  summary: string;
}

const DEFAULT_LIMIT = 10;
const SUMMARY_MAX = 80;

const truncate = (s: string, n = SUMMARY_MAX): string =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

const firstLine = (s: string): string => {
  for (const raw of s.split('\n')) {
    const line = raw.trim();
    if (line.length > 0) return line;
  }
  return '';
};

// The codegen lost the precise ToolCall shape (a Result enum upstream).
// Probe the common paths used across Goose versions instead of giving up.
const toolNameOf = (toolCall: unknown): string | null => {
  if (!toolCall || typeof toolCall !== 'object') return null;
  const o = toolCall as Record<string, unknown>;
  if (typeof o.name === 'string') return o.name;
  if (o.Ok && typeof o.Ok === 'object') {
    const n = (o.Ok as Record<string, unknown>).name;
    if (typeof n === 'string') return n;
  }
  if (o.value && typeof o.value === 'object') {
    const n = (o.value as Record<string, unknown>).name;
    if (typeof n === 'string') return n;
  }
  return null;
};

interface ContentSummary {
  summary: string;
  toolName: string | null;
}

const summariseContent = (
  role: 'user' | 'assistant',
  content: MessageContent[],
): ContentSummary => {
  let text: string | null = null;
  let toolName: string | null = null;
  for (const c of content) {
    if (c.type === 'text' && typeof c.text === 'string' && text === null) {
      text = c.text;
    }
    if (c.type === 'toolRequest' && toolName === null) {
      toolName = toolNameOf((c as { toolCall: unknown }).toolCall);
    }
  }
  if (role === 'user') {
    return { summary: truncate(firstLine(text ?? '')), toolName: null };
  }
  if (toolName) return { summary: `Called ${toolName}`, toolName };
  if (text) return { summary: truncate(firstLine(text)), toolName: null };
  return { summary: 'Responded', toolName: null };
};

export function reduceConversationToEvents(
  conversation: Conversation,
  limit = DEFAULT_LIMIT,
): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (const msg of conversation) {
    const { summary, toolName } = summariseContent(msg.role, msg.content);
    if (!summary) continue;
    const ev: HistoryEvent = { ts: msg.created, role: msg.role, summary };
    const prev = events[events.length - 1];
    // Collapse consecutive identical tool-call summaries into one event so
    // a noisy "Called foo / Called foo / Called foo" tail doesn't crowd the
    // pane. Same-role-only collapse stays out — two user turns are distinct.
    if (
      prev &&
      prev.role === ev.role &&
      toolName !== null &&
      prev.summary === ev.summary
    ) {
      prev.ts = ev.ts;
      continue;
    }
    events.push(ev);
  }
  return events.slice(-limit).reverse();
}

export interface UseHistoryTailResult {
  events: HistoryEvent[];
  error: Error | null;
  loading: boolean;
}

export function useHistoryTail(
  sessionId: string | null,
  limit = DEFAULT_LIMIT,
): UseHistoryTailResult {
  const { data, error } = usePanelReader<Conversation | null>(
    async () => {
      if (!sessionId) return null;
      const response = await getSession({ path: { session_id: sessionId } });
      return response.data?.conversation ?? null;
    },
    [sessionId],
  );

  const events = useMemo(
    () => (data ? reduceConversationToEvents(data, limit) : []),
    [data, limit],
  );

  return {
    events,
    error,
    loading: data === null && error === null && sessionId !== null,
  };
}
