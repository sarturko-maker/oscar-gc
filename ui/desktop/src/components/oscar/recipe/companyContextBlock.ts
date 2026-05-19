// Sprint 15 (ADR-053): renderer for the "## About this company" markdown
// block prepended to every practice-area recipe's instructions at
// session-spawn time. This is the load-bearing wire from the intake
// (ADR-050 P2.5 — Company context block) into the agent layer.
//
// Static per session: built once at spawn from the profile read on the
// renderer side. Top of Mind (ADR-044) remains the per-matter channel;
// this block is the per-session/per-area company channel.

import type { OscarCompanyContext } from '../hooks/useOscarProfile';

function joinList(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function industryLine(ctx: OscarCompanyContext): string | null {
  const parts = [
    ctx.industry.sector,
    ctx.industry.sub_sector,
    ctx.industry.business_model,
  ].filter((p): p is string => !!p);
  if (parts.length === 0) return null;
  return `**Industry**: ${parts.join(' — ')}.`;
}

function geographyLine(ctx: OscarCompanyContext): string | null {
  const parts: string[] = [];
  if (ctx.geography.hq_jurisdiction) parts.push(`HQ ${ctx.geography.hq_jurisdiction}`);
  if (ctx.geography.operating_jurisdictions.length > 0) {
    parts.push(`operating ${joinList(ctx.geography.operating_jurisdictions)}`);
  }
  if (ctx.geography.customer_jurisdictions && ctx.geography.customer_jurisdictions.length > 0) {
    parts.push(`customers in ${joinList(ctx.geography.customer_jurisdictions)}`);
  }
  if (ctx.geography.employee_jurisdictions && ctx.geography.employee_jurisdictions.length > 0) {
    parts.push(`employees in ${joinList(ctx.geography.employee_jurisdictions)}`);
  }
  if (parts.length === 0) return null;
  return `**Geography**: ${parts.join('; ')}.`;
}

function regulatoryLine(ctx: OscarCompanyContext): string | null {
  if (ctx.regulatory_baseline.frameworks.length === 0) return null;
  const labels = ctx.regulatory_baseline.frameworks.map((f) => f.label);
  const provenance =
    ctx.regulatory_baseline.captured_via === 'hypothesis-confirm'
      ? 'user-confirmed against web search'
      : ctx.regulatory_baseline.captured_via === 'user-enumerated'
        ? 'user-enumerated'
        : ctx.regulatory_baseline.captured_via === 'tavily-failed-llm-fallback'
          ? 'LLM hypothesis, user-reviewed'
          : 'pending re-intake';
  return `**Regulatory baseline** (${provenance}): ${labels.join(', ')}.`;
}

function recurringLine(ctx: OscarCompanyContext): string | null {
  if (ctx.recurring_matters.top_shapes.length === 0) return null;
  return `**Recurring matters**: ${joinList(ctx.recurring_matters.top_shapes)}.`;
}

function stakeholdersLine(ctx: OscarCompanyContext): string | null {
  const parts: string[] = [];
  if (ctx.stakeholders.reports_to) parts.push(`reports to ${ctx.stakeholders.reports_to}`);
  if (ctx.stakeholders.key_business_partners.length > 0) {
    parts.push(`key partners ${joinList(ctx.stakeholders.key_business_partners)}`);
  }
  if (ctx.stakeholders.escalation_threshold_label) {
    parts.push(ctx.stakeholders.escalation_threshold_label);
  }
  if (parts.length === 0) return null;
  return `**Stakeholders**: ${parts.join('; ')}.`;
}

function riskAppetiteLine(ctx: OscarCompanyContext): string | null {
  if (!ctx.risk_appetite) return null;
  return `**Risk appetite**: ${ctx.risk_appetite}.`;
}

function openNotesLine(ctx: OscarCompanyContext): string | null {
  if (!ctx.open_notes) return null;
  return `**Open notes**: ${ctx.open_notes}`;
}

export function renderCompanyContextBlock(ctx: OscarCompanyContext | null | undefined): string | null {
  if (!ctx) return null;
  if (ctx.regulatory_baseline.captured_via === 'needs-re-intake') return null;
  const lines = [
    industryLine(ctx),
    geographyLine(ctx),
    regulatoryLine(ctx),
    recurringLine(ctx),
    stakeholdersLine(ctx),
    riskAppetiteLine(ctx),
    openNotesLine(ctx),
  ].filter((l): l is string => !!l);
  if (lines.length === 0) return null;
  return ['## About this company', ...lines].join('\n');
}
