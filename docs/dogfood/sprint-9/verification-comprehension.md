# Sprint 9 — Lawyer-quality comparison

Per the Sprint 9 addendum's verification standard: a side-by-side of the agent's output against what CC would have drafted as a lawyer doing the same task. Gaps reported as findings.

## CC's lawyer-shaped reference

If I were a senior in-house counsel asked to "make this NDA mutual so both parties have the same confidentiality obligations," my approach would be:

1. **Define `Disclosing Party` and `Receiving Party` as capitalized defined terms** referring to whichever role each Party plays in a given disclosure. The defined-term convention is the cleanest way to express bilateral confidentiality — one set of clauses applies in both directions.
2. **Recast (not append) the preamble** so the mutuality statement is the first substantive line, not an afterthought.
3. **Mirror obligations precisely**, never adding emphasis-Markdown to the clauses — counterparties don't expect to receive a contract with bold-emphasis on the substantive language. Bold reads as editorial annotation in the working copy, not legal text.
4. **Strip "Party A's" from the definition's examples** of CI (business plans, source code, etc.) — leave the list as illustrative of either Party's CI.
5. **Make Clause 8 (No Licence / No Warranty) mutual**: neither Party grants a license to the other's CI; neither Party makes warranties as to its own CI's accuracy.
6. **Consider** whether Clause 1 (Purpose) needs its product-specific subject matter ("Party A's industrial process control software") softened to a generic "the parties' respective business operations" or similar — for a true mutual NDA this is usually broader.
7. **Final pass** for capitalization consistency: `Disclosing Party`, `Receiving Party`, `Confidential Information` all defined-term-capitalized; `the other Party` lowercase as a referential phrase.

## Side-by-side comparison

| Element | CC's ideal | Agent's output | Verdict |
|---|---|---|---|
| Preamble structure | Restructure mutuality as the first line of recital | Append mutuality sentence to existing preamble | Adequate; less clean |
| Defined-term capitalization | `Disclosing Party` (capitalised throughout) | Mix of `Disclosing Party` and lowercase `disclosing Party` | Minor consistency gap |
| Confidential Information definition source | "disclosed by either Party to the other" | "disclosed by either Party to the other" | ✅ matches |
| Confidential Information examples | "the Disclosing Party's business plans" | "the **disclosing Party's** business plans" (Markdown bold + lowercase) | Stylistic gaps: bold + capitalization |
| Obligations (Clause 3) mirroring | "The Receiving Party shall hold the Disclosing Party's CI" | "The Receiving Party shall hold the other Party's CI" | Both are valid mutuality framings |
| Exclusions (Clause 4) symmetric | parallel | parallel | ✅ matches |
| Compelled Disclosure symmetric | parallel | parallel | ✅ matches |
| Return / Destruction symmetric | parallel | parallel | ✅ matches |
| Clause 7 (Term) | Untouched — already symmetric | Untouched — already symmetric | ✅ matches |
| Clause 8 (No Licence) | Make mutual: neither Party grants a license to the other's CI | **Not mutual; agent flagged as concern** | **Real gap, transparently surfaced** |
| Clause 9 (Remedies) symmetric | "Each Party acknowledges... non-breaching Party shall be entitled..." | "Each Party acknowledges... non-breaching Party shall be entitled..." | ✅ matches |
| Markdown emphasis | None used in clause text | `**bold**` used on mutuality changes | Stylistic — bold is review-emphasis, not contract language |
| Purpose Subject-matter softening | Broaden to "respective business operations" | Left "Party A's industrial process control software" intact | Minor gap; defensible since Party A's domain was named in original |

## Findings (P-priority, Sprint 7 / 8 pattern)

### P1 — System prompt should discourage Markdown emphasis in `new_text`

The agent used `**bold**` on the mutuality-coded language across multiple clauses. The system prompt currently mentions Markdown is supported in `new_text` (`'**bold**'`, `'_italic_'`, `'\\n\\n'`) — which is true for adeu but encourages emphasis-as-editorial-annotation. A senior commercial lawyer would not send a counterparty a contract with bold runs on substantive language.

**Fix candidate** (Sprint 10): tighten the system prompt's tool-surface description to say Markdown is for *structural* formatting (headings, paragraph breaks) and not for emphasis in substantive contract text.

**Severity**: P1. Doesn't break the workflow, but the output is less professional than a lawyer's hand-draft.

### P2 — Capitalization inconsistency on defined terms

The agent rendered "disclosing Party" (lowercase) in some clauses and "Disclosing Party" (capitalized) implicitly in others. The standard convention is to capitalize defined terms throughout once introduced.

**Fix candidate** (Sprint 10): system prompt should remind the agent of defined-term capitalisation discipline when mirroring clauses.

**Severity**: P2 (stylistic; doesn't affect legal meaning).

### P2 — Clause 8 not auto-handled

Agent correctly flagged Clause 8 (No Licence; No Warranty) as still asymmetric and asked the lawyer whether to also mirror it. This is the right *behaviour* (surface uncertainty), but a stronger system prompt might encourage the agent to extend a "make this mutual" instruction to ALL clauses that reference one Party asymmetrically, not just the obligations-and-remedies clauses.

**Fix candidate** (Sprint 10): system prompt could include a "scope of mutuality" reminder: when the lawyer says "make X mutual," consider every clause that names one Party.

**Severity**: P2. The agent's transparency mitigates this — the lawyer is informed and can extend the request.

### P3 — Subject-matter recital narrowness

The Purpose recital still names "Party A's industrial process control software" only. For a truly bilateral NDA, the subject may be broader. Lawyer judgement call; the agent's conservatism is defensible.

**Severity**: P3 (judgment call; not a defect).

## Headline finding

**The agent's output is competent, lawyer-recognisable, and self-aware about its own limitations.** A senior commercial lawyer reviewer would accept the edits with minor cleanup (capitalization, removal of bold) and would address Clause 8 either by extending the agent's batch or hand-editing — either way, the agent's surfacing of that gap saved the reviewer one round of "you missed Clause 8."

The five-step doctrine (intent → interacting clauses → coordinated plan → batch → coherence check) was followed step-by-step in a single conversation turn. The recovery from the missing `type` field in the first batch attempt (adeu returned a validation error, agent retried with the field) demonstrates competent tool-use error recovery.

**Verification standard met.** Sprint 9 round-trip survives the addendum's "lawyer-quality reasoning + OOXML-verified output" bar.
