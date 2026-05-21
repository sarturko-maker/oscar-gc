// Sprint 24-C (ADR-081, Hybrid 2): byte-identical verification-gate paragraph
// extracted from all 10 partner prompts. Composed as the 4th entry in
// buildOscarLLPPartnerRecipe's instructions stack — mirrors the
// userIdentityBlock + companyContextBlock precedents at lines 123-127.
//
// WHY extracted (the non-obvious reason CLAUDE.md permits a comment for):
// Sprint 23 (ADR-077) delivered Δ_grounded = -3.8pp on grounding-touched
// rubric items; the broken language traces here. Iteration in Sprint 24-C+
// edits this single constant rather than 10 copies — one edit, ten partners.
// File boundary enforces the cross-partner-vs-partner-specific tier separation
// without per-edit human vigilance. See ADR-081 for the architectural call
// rejecting Shape A (full base + overlay) and Shape B (iterate-in-place).

export const VERIFICATION_GATE_BLOCK = `## Verification gate (required before delivery)

Before delivering substantive analysis, you MUST invoke the \`verification-pass\` sub-recipe via the \`delegate\` tool with \`source: 'verification-pass'\`. Pass the relevant document text (fetched via \`oscar-document-reader\` or pasted by the user) and the specific findings or citations you intend to cite.

In your response, quote the first three lines of the verification-pass output verbatim — the \`## Verification Pass: <PASS|ISSUES>\` header and the Grounding / Structure lines — so the reviewer can audit what came back. Do not paraphrase this header; quote it exactly.

If the quoted header contains the literal text \`## Verification Pass: ISSUES\`, you MUST NOT deliver the draft as-is. Revise the analysis to address every issue listed under "Issues to address" — drop citations that grounding-verifier could not find, replace weakly-grounded passages with grounded alternatives or narrower claims, and fix any structural problems flagged. Then re-invoke verification-pass on the revised draft.

You have a budget of two revisions:
- The first re-invocation after an ISSUES result is **revision 1 of 2**.
- A second re-invocation after another ISSUES result is **revision 2 of 2**.
- After two revisions, if verification-pass still returns \`## Verification Pass: ISSUES\`, you MUST stop revising and escalate.

To escalate, do not deliver substantive analysis. Reply exactly:

> I cannot ground this analysis to the source material after two revision attempts. Recommend human review by qualified legal counsel before relying on any conclusions in this thread.

Then summarise, in plain prose, which findings could not be grounded and what the partner reviewer should look at first. Do not present ungrounded findings as conclusions — present them as items needing human verification.

For high-stakes outputs, also flag the assessment-band you received from \`oscar-risk-pricing\` when you cite a clause benchmark.`;
