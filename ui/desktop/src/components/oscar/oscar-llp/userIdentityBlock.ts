// Sprint 21 (ADR-071) + Sprint 24-A (ADR-078): renderer for the "## About the
// in-house lawyer you are advising" markdown block prepended to every Oscar
// LLP partner recipe's instructions at session-spawn time.
//
// Counterpart to companyContextBlock.ts (Sprint 15, ADR-053): companyContextBlock
// briefs the partner on the *company*; userIdentityBlock briefs the partner on
// the *lawyer* sitting opposite. Practice-area recipes don't use this yet (the
// gap exists in in-house mode too — carried forward as a Sprint 22+ candidate).
//
// Static per session: built once at spawn from the profile read on the
// renderer side.

import type { OscarUserProfile } from '../hooks/useOscarProfile';

type Corporate = OscarUserProfile['corporate'];
type User = OscarUserProfile['user'];

function companyLine(corporate: Corporate): string {
  const parts: string[] = [corporate.name ?? 'an unnamed company'];
  if (corporate.industry) parts.push(corporate.industry);
  if (corporate.size_band) parts.push(`${corporate.size_band} headcount`);
  return parts.join(', ');
}

export function renderUserIdentityBlock(
  user: User | null | undefined,
  corporate: Corporate | null | undefined
): string | null {
  if (!user || !corporate) return null;
  if (!user.name && !corporate.name) return null;
  const lawyer = user.name
    ? `${user.name}${user.role_label ? `, ${user.role_label}` : ''}`
    : user.role_label || 'in-house counsel';
  const lines: string[] = [
    '## About the in-house lawyer you are advising',
    `- **Lawyer**: ${lawyer}`,
    `- **Company**: ${companyLine(corporate)}`,
    "- **Context**: You are being consulted as an external specialist. The lawyer sitting opposite you is your client's in-house team; treat them as a trusted partner-tier client, brief them with the kind of decisiveness a senior partner would.",
  ];
  return lines.join('\n');
}
