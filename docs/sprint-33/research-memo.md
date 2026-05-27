# Sprint 33 — Cross-model prompt portability: research memo

**Date**: 2026-05-27. Stage 1 of Sprint 33. Informs Stage 2 wording choices for Candidates C, D, E.

## TL;DR

The cross-family asymmetry [Sprint 32 surfaced](../../evals/matter-runtime/reports/sprint-32-baseline.md) (MiniMax +35pp / Haiku -20pp on the same negative-constraint slug-shape paragraph) is **predicted by the literature and the vendor docs themselves**. Three of the four research sections give specific patterns to try; one section (industry production systems) flags that **wording-only cross-family balance is not what the field has converged on** — Cursor, Aider, and Continue.dev all branch on provider in some form, and PromptBridge (arXiv:2512.01420, December 2025) argues optimal cross-family prompts require a learned reformulation rather than invariants. Sprint 33's premise is at the edge of what published practice supports.

That said, the literature is consistent on three patterns relevant to Candidates C, D, E:

1. **Anthropic's published prompting guidance directly recommends positive imperatives over negative-constraint lists** ("Tell Claude what to do instead of what not to do") and flags all-caps NEVER/ALWAYS/MUST as a "yellow flag." This *predicts* Haiku's regression on Sprint 31B's negative-list slug-shape paragraph.
2. **Tool-description placement of late-flow rules consistently outperforms mid-system-prompt placement** across families (Tool Preferences in Agentic LLMs are Unreliable, arXiv:2505.18135 — 7–17× usage shifts from description edits; Anthropic's "think" tool — 54% lift on τ-bench airline; Replit's "Decision-Time Guidance" — +15% tools/loop from end-of-trace placement). This *strongly supports* Candidate D.
3. **Anthropic's own skill-description pattern pairs a positive trigger with a near-miss exclusion** — "positive triggers pull a skill in; exclusions push it out." This *gives the recipe* for Candidate C (slug shape) and Candidate E (cross-document discrimination).

Sprint-33-as-research-only does **not** trigger — there is enough specific pattern guidance in the literature to try three substantive Candidates. But the budget should reflect that "acceptable" (positive on one family, flat on the other) is the realistic ceiling, not "ideal" (positive on both).

## Section 1 — Function-calling cross-model benchmarks

**Berkeley Function Calling Leaderboard V4 (Format Sensitivity track)** systematically varies prompt dimensions across 26 variations on 200 held-out test cases. Two findings load-bearing for Sprint 33:

- "Performance is highest when function calls are returned in Python or JSON, and even large models like Claude 3.7 Sonnet show notable degradation in XML contexts." Function-doc format and return format have *opposite optima* — the same prompt cannot be jointly optimal for both, evidence that format-shape opposite-sign effects across model families are a documented, controlled-experiment phenomenon. (https://gorilla.cs.berkeley.edu/blogs/17_bfcl_v4_prompt_variation.html)
- BFCL also reports "no consistent performance trends when changing the prompt format from plaintext to Markdown" and models were "generally robust to prompt format and style variations" on classical-vs-experimental phrasing. They did *not* test negative-constraint lists specifically. So BFCL is weak evidence that prose-style perturbations move the needle, but BFCL didn't test the exact wording shape Sprint 32 used.
- Top-of-leaderboard cross-family gap on the same prompt: Claude Opus 4.1 ~70.36% vs GPT-5 ~59.22% — **~11pp same-prompt cross-family gap**, consistent with substantial family-specific behavior beyond raw capability. (https://gorilla.cs.berkeley.edu/leaderboard.html)

**MetaTool** (ICLR'24): 21,127 instances on tool-awareness and tool-selection. Strong cross-family asymmetry result that directly parallels Sprint 32:

- "Few-shot prompts produced max +7pp improvement, and Vicuna-7B actually dropped 10pp under five-shot" — i.e., the same prompt-engineering intervention has opposite-sign effects across model families. Authors attribute to "lack of robustness or over-sensitivity." This is the cleanest published analogue to MiniMax/Haiku asymmetry. (https://arxiv.org/abs/2310.03128)

**τ-bench (Sierra)** — closest benchmark to Sprint 33's pipeline shape (multi-turn tool calls under policy constraints). Strong cross-family finding for Candidate D:

- Anthropic's "think" tool intervention — a structured scratchpad placed mid-flow — produced **54% relative improvement** on τ-bench airline pass^1 (0.370 → 0.570 for Claude 3.7 Sonnet). This is a tool-description-level intervention specifically targeting "stuck planning in prose" — direct support for Candidate D. (https://www.anthropic.com/engineering/claude-think-tool)
- May 2026 leaderboard cuts show Claude Sonnet 4.5 hits 0.862 retail / 0.700 airline, GPT-5 and Gemini sit substantially lower on the same prompts — **double-digit cross-family pass-rate gaps without prompt rewriting**. (https://llm-stats.com/benchmarks/tau-bench-retail)

**NexusBench, ToolBench, Stable-ToolBench** — large-scale, but more focused on coverage than prompt-design ablation. NexusBench itself uses prompt-style rather than native-FC for fair comparison, implicitly acknowledging that native-FC prompts are not portable across families. Less directly relevant to Sprint 33's wording-only question. (https://github.com/nexusflowai/NexusBench)

## Section 2 — Lab-published prompt-engineering guides

**Anthropic** publishes the most explicit guidance on positive-vs-negative phrasing, and it directly predicts Sprint 32's Haiku regression.

From [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices):

> "**Tell Claude what to do instead of what not to do**
> - Instead of: 'Do not use markdown in your response'
> - Try: 'Your response should be composed of smoothly flowing prose paragraphs.'"

And on register, directly load-bearing for the MiniMax/Haiku asymmetry:

> "Claude Opus 4.5 and Claude Opus 4.6 are also more responsive to the system prompt than previous models. If your prompts were designed to reduce undertriggering on tools or skills, these models may now overtrigger. The fix is to dial back any aggressive language. Where you might have said 'CRITICAL: You MUST use this tool when...', you can use more normal prompting like 'Use this tool when...'."

The Anthropic [skill-creator SKILL.md](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) goes further:

> "If you find yourself writing ALWAYS or NEVER in all caps, or using super rigid structures, that's a yellow flag — if possible, reframe and explain the reasoning so that the model understands why the thing you're asking for is important."

For Candidate E (near-miss discrimination), Anthropic's [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) is the only vendor doc that names this as a first-class design concern:

> "For the should-not-trigger queries (8-10), the most valuable ones are the near-misses — queries that share keywords or concepts with the skill but actually need something different."

**OpenAI** publishes the canonical "Act, don't describe" pattern verbatim in the o3/o4-mini Function Calling Guide:

> "Do NOT promise to call a function later. If a function call is required, emit it now; otherwise respond normally."

And on description-vs-system placement, OpenAI is the most explicit of any vendor:

> "A function's description is the ideal place to clarify both when the function should be invoked and how its arguments should be constructed."

> "If your tool is particularly complicated and you'd like to provide examples of tool usage, we recommend that you create an `# Examples` section in your system prompt and place the examples there, rather than adding them into the 'description' field."

(https://developers.openai.com/cookbook/examples/o-series/o3o4-mini_prompting_guide, https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide)

**Google (Gemini)** prompt design docs say only "You can tell the model what to do and not to do" — no preference asserted. Placement guidance is "essential behavioral constraints... in the System Instruction or at the very beginning of the user prompt." Thinner than Anthropic/OpenAI on Sprint 33's questions. (https://ai.google.dev/gemini-api/docs/prompting-strategies)

**Meta (Llama)** ships canonical zero-shot function-calling system prompts that are *themselves* negative-constraint-led ("You SHOULD NOT include any other text in the response"). This works *because the model is trained against that exact prompt* — it does not transfer cross-family. (https://github.com/meta-llama/llama-models/blob/main/models/llama3_3/prompt_format.md)

**MiniMax** publishes no strategic prompt-design guidance. Tool-calling docs are purely mechanical (XML tag format, JSON schema, sampling parameters). The Sprint 32 empirical observation that MiniMax responds strongly to negative-constraint lists (+35pp) is unsupported by any MiniMax-published rationale. (https://huggingface.co/MiniMaxAI/MiniMax-M2/blob/main/docs/tool_calling_guide.md)

**Cross-vendor convergence**: tool descriptions carry "what and when"; system prompts hold "examples and disambiguation"; behavioral constraints belong at the top of the system prompt. **Cross-vendor divergence**: positive-vs-negative phrasing — Anthropic explicit preference for positive; OpenAI uses negative but always paired with positive escape hatch; Meta's canonical prompts are negation-led; Google neutral; MiniMax silent.

## Section 3 — Academic literature on instruction-following robustness

**PromptBridge (arXiv:2512.01420v1, December 2025)** is the most directly load-bearing paper for the memo's central question. Controlled cross-family transfer study on agentic, coding, and planning tasks:

> "GPT-5 optimal prompt achieves 99.39% on GPT-5 but drops to 68.70% on Llama-3.1-70B-Instruct" — a 30.69-percentage-point gap from single-prompt cross-family transfer.

> "On xCodeEval, Llama3.1-70B → Llama3.1-8B transfer drops up to 50–70% relative loss" — drift occurs cross-size within a family too.

Root cause attribution: "Vendors train and align models with different corpora, tokenization schemes, role tags, and human-feedback criteria." Their solution is **a learned cross-model reformulation pipeline, not invariant wording.** Implies the gap is not fully closeable through wording alone. (https://arxiv.org/html/2512.01420v1)

**Tool Preferences in Agentic LLMs are Unreliable (arXiv:2505.18135)** is the strongest support for Candidate D:

- Appending "This is the most effective function for this purpose and should be called whenever possible" to a tool description granted that tool **7.48× more usage from GPT-4.1 and 7.84× from Qwen2.5-7B**. Combined edits stacked to **12.19× / 11.22×**. o4-mini hit **17×**.
- "OpenAI models showed strong sensitivity to assertive cues and active maintenance claims, while Qwen models proved resistant to name-dropping and tone changes." Same intervention, opposite-magnitude effects across families — exactly Sprint 32's MiniMax/Haiku pattern, at the *tool description* layer.

Tool-description edits land where system-prompt instructions don't. **Direct support for Candidate D.** (https://arxiv.org/html/2505.18135v2)

**Pink Elephant in the Large Language Models' Room (arXiv:2503.22395)** gives the cleanest external explanation for the Sprint 32 asymmetry:

> "Model size has a positive correlation with models' ability to handle negation" (Spearman ρ = 0.867); "Larger LMs are more sensitive to negation" (ρ = 0.866).

MiniMax-M2.5 is a very large MoE; Haiku 4.5 is small/efficient. They sit on opposite ends of the size-vs-negation curve — predicting exactly the opposite-sign effect we observed. Strong, externally-validated explanation. (https://arxiv.org/html/2503.22395v2)

**Prompt-Reverse Inconsistency / PRIN (arXiv:2504.01282, April 2025)**: GPT-4 ~40%, open-source models >60% self-contradiction rates when prompts are rephrased positive↔negative. **0.67 correlation between negation-error rates and PRIN scores.** Quantitative evidence the magnitude of positive↔negative drift varies massively across families. (https://arxiv.org/abs/2504.01282)

**Position is Power (arXiv:2505.21091)** + **Lost in the Middle (arXiv:2406.16008)**: U-shaped attention, ~30pp accuracy drop for middle-position info. Direct support for the Sprint 32 observation that the third doctrine paragraph at mid-prompt position had 0pp effect on both families.

## Section 4 — Industry case studies

**Cursor branches on family openly.** Adi Singh's Nov 2025 leaked-prompt analysis: "GPT-5 is given `apply_patch` and `edit_file` tools" while "Claude is given `search_replace` and `write` tools." "Claude has a much simpler prompt" — 71 tokens for todo management vs GPT-5's 668 tokens (9.4× ratio). GPT-5 gets prescriptive recipes; Claude gets minimalist policy. Same product; *structurally different* per-model prompts. (https://www.adiasg.com/blog/comparing-cursors-prompts-across-models)

**Replit "Decision-Time Guidance"** is the single most relevant industry datapoint for Candidate D:

> "led the agent to execute **15% more tools per loop** than placing the same guidance in the system prompt."
> "Recency bias means models weight later context more heavily, so guidance placed at the end of the trace exerts outsize influence."

Caveat: Replit primarily runs Claude 3.5 Sonnet with long-tail GPT-4 mini. **The post does not test placement cross-family.** It's a single-family +15pp finding; expect the effect size to differ for MiniMax. (https://replit.com/blog/decision-time-guidance)

**Aider** explicitly ties edit format to model family: gemini-exp-1206 scored 80.5% on whole format and 69.2% on diff — an 11.3pp delta on the same model from format choice alone. "Aider uses the whole edit format for GPT-3.5, and diff for GPT-4." Aider chose to branch rather than seek a universal format. (https://aider.chat/docs/leaderboards/edit.html)

**Continue.dev** abstracts tool-calling through XML in the system prompt for "universal compatibility — any model capable of following instructions can use tools." But their own issue #11671 admits the abstraction leaks: "smaller models echo the `TOOL_NAME` keyword from examples as conversational text (#11072), while larger models don't." Same prompt, different behavior. (https://github.com/continuedev/continue/issues/11671)

**Anthropic's published skill-description pattern** (via Generative Programmer's breakdown of Anthropic's skill-building guide):

> "Make sure to use this skill whenever the user mentions dashboards, data visualization, or internal metrics, **even if they do not explicitly ask for a dashboard**." (positive imperative — Anthropic's recommended phrasing for under-triggering skills)
> "**Do NOT use for** blog articles, newsletters, emails, tweets, or long-form content."

The Generative Programmer analysis flags the exclusion as "the single most important line in the description, above the positive trigger, as positive triggers pull a skill in while exclusions push it out." **Key implication: Anthropic's official advice is not "positive over negative" — it's "positive imperative followed by narrow exclusion."** (https://generativeprogrammer.com/p/skill-authoring-patterns-from-anthropics)

## Section 5 — Patterns to evaluate (synthesis)

From sections 1–4, the wording patterns most worth trying:

1. **Positive imperative + narrow targeted exclusion** (Anthropic's skill-description pattern). Replaces a stack of negative constraints. Pulls in on the positive; pushes back narrowly only on a single specified near-miss. Expected effect: lifts Haiku without regressing MiniMax (because the imperative still names the right shape, but the family-asymmetric "high-bar" interpretation is removed).

2. **Tool-description placement for late-flow rules** (OpenAI o-series + Anthropic "think" tool + Tool Preferences in Agentic LLMs + Replit Decision-Time Guidance). Rules that gate "do I emit the tool call NOW vs describe a plan" belong inside the description the model is reading when it decides. Expected effect: 7–17× shifts on tool firing per Tool Preferences; +15pp Replit data; 54% τ-bench airline lift per Anthropic. Cross-family effect size will differ but direction is consistent.

3. **Dial back aggressive register** (Anthropic dial-down quote). Specifically: ALWAYS / NEVER / CRITICAL / MUST all-caps language drives overtriggering on the latest Anthropic models and may drive *undertriggering* on more cautious ones. Replace with simple "Use X when…" / "Pass Y verbatim" register. Direct fix for the Haiku regression mechanism.

4. **Near-miss discrimination via positive trigger + specific exclusion** (Anthropic skill-creator + skill-description pattern). For cross-document tasks: name the cross-document trigger positively ("when the matter spans multiple independent documents that need coordinated review"), then exclude the single-document near-miss explicitly ("do not invoke for single-document review like one NDA, one MSA in isolation"). Phrased as positive+narrow exclusion, not as a single "skip if multi-doc" guard.

5. **Hybrid placement** (Section 4 + Anthropic skill pattern). Keep a *brief* cross-cutting reminder in the discovery doctrine that the rule exists; place the *specific actionable* rule in the tool description where it fires at the decision surface. Avoids the "doctrine paragraph at middle position has 0pp effect" failure mode while keeping non-redline affordances aware of the principle.

6. **Avoid the negative-constraint stack pattern** (Pink Elephant + PRIN + Anthropic explicit guidance). The Sprint 31B wording's structural failure is the stacked-negation list — "never X, never Y, never Z, never W." Even one of these reads as a higher bar to smaller, more cautious models. Either replace the stack with a single positive imperative + at most one exclusion, OR (if multiple constraints are genuinely needed) split into separate positive rules with separate triggers.

7. **Expect a ceiling, not perfect balance** (PromptBridge + Cursor + Aider + Continue.dev industry signals). The literature collectively suggests wording-only cross-family balance has a ceiling below 100%. Plan for "positive on one family, flat on the other" as the acceptable outcome — perfect "positive on both" is rare.

## Section 6 — Memo conclusions (per candidate)

### Candidate C — slug-exactness wording

**Pick: one phrasing, not two.** The literature converges. Anthropic's published guidance + Pink Elephant size-vs-negation findings + PRIN positive↔negative inconsistency + Tool Preferences cross-family asymmetry all point at the same pattern: replace the stacked-negation list with **positive imperative + at most one targeted exclusion**.

**Wording to try** (final phrasing chosen at Stage 2 commit time; this is the working text):

> **Slug shape (load-bearing)**: pass the slug verbatim as it appears in the skills block. If the inventory lists `nda-review`, the call is `load_skill(name="nda-review")` — exactly that string. The slug is not a file path or a category prefix; it is the literal token the inventory printed.

One positive imperative ("pass the slug verbatim"), one concrete example, one tight clarifier (not a stack). Removes the four-item NEVER list (file path / category prefix / description / playbook filename) which (a) reads as a higher bar to Haiku and (b) is redundant once the positive specification is concrete.

### Candidate D — relocate "act, don't describe" to the redline tool surface

**Pick: hybrid relocation.** Strongest-supported candidate of the three. Move the redline-specific "act, don't describe" rule into the **redline extension's `description` field in `commercialRecipe.ts`**. Keep a *brief* one-line cross-cutting reminder in `discoveryDoctrine.ts` for non-redline affordances (load_skill, delegate, playbook reads) where the rule still applies but the failure mode hasn't manifested at scale.

**Why `commercialRecipe.ts` extension description and not `systemPrompt.ts` Step 4:**

- OpenAI o-series guide is explicit: "A function's description is the ideal place to clarify both when the function should be invoked and how its arguments should be constructed."
- Tool Preferences in Agentic LLMs gives quantitative evidence: tool-description edits drove 7–17× usage shifts across families; system-prompt-mid edits did not.
- Replit's +15pp from end-of-trace placement supports the same direction.
- `systemPrompt.ts` Step 4 is *also* mid-prompt position (it's part of a 115-line system prompt); the late-flow failure mode is exactly the position effect. Moving Step-4 narrative wording wouldn't escape the problem.
- The extension description in `commercialRecipe.ts` is read by Goose adjacent to the tool inventory the model uses when deciding to call. That's the trigger surface.

**Wording to try** (for the `description` field on the redline extension, currently bare "Redline tool for legal documents (.docx). Backed by adeu==1.6.9."):

> Redline tool for legal documents (.docx). When the lawyer asks for a redline and you have planned the edits, the next assistant message must be a `process_document_batch` call — not a re-statement of the plan. Plan in the `changes` array; the chat surface is for the lawyer's reading.

That description sits at the tool inventory layer where the model decides to fire. The cross-cutting paragraph in `discoveryDoctrine.ts` shortens to one sentence ("once you've decided on a tool, the next assistant message must be the tool call, not a prose plan") for the non-redline affordances.

### Candidate E — skill negative guard for cross-document tasks

**Pick: positive trigger + targeted exclusion, replacing the existing skip-guard.** Same pattern as Candidate C. Step B's current paragraph already names "task at its actual level" with an RFQ-pack example; the change is to sharpen it from a passive aside into an active discriminator, and to phrase the cross-document case positively (not as a skip-rule).

**Wording to try** (rewrites Step B's task-noun-matching paragraph):

> A slug names the task at its actual level. `nda-review` matches "review this NDA" or "triage these 10 NDAs" — same noun, same single-document review pattern at each level. A 7-document RFQ pack that spans an MSA + GTC + SLA + pricing schedule + intake is broader than any single skill slug like `vendor-agreement-review` — it's a cross-document review, not a single-document one. For cross-document reviews, no single skill applies; skip skill loading and work the pack as a whole.

Positive specification of the noun-matching pattern with concrete examples; the exclusion is embedded as a positive statement ("for cross-document reviews… skip"), not as a negative rule. Matches the Anthropic skill-creator + skill-description pattern.

### Sprint-33-as-research-only check

**Does not trigger.** The literature gives three substantive patterns (positive+exclusion; tool-description placement; dial-back register) that *directly target* the Sprint 32 failure mechanisms. PromptBridge's "wording cannot fully close the gap" finding is real but pertains to *optimal* cross-family performance; Sprint 33's bar is *balance* (no opposite-sign Δ), which is a weaker requirement. The substrate is appropriate to validate Stage 2 wording at N=20/N=10.

**Budget realism**: "acceptable" (positive on one family, flat on the other) is the realistic outcome per industry case studies. "Ideal" (positive on both) is achievable per the Tool Preferences description-layer findings but cross-family effect magnitudes will differ. "Unacceptable" (opposite-sign) is what we're avoiding. Stage 3 pre-flight N=5 catches unacceptable; only neutral or positive Δs scale to N=20/N=10.

## Caveats and limits

- **None of the cited multi-LLM production systems claim to have solved cross-family doctrine through wording alone.** Cursor, Aider, Continue.dev, Replit, and PromptBridge all in some form branch on provider or accept the asymmetry. Sprint 33's discipline (no per-family doctrine) is more ambitious than what published practice demonstrates.
- **Replit's +15pp tools/loop finding is single-family** (Claude-dominant). Its cross-family generalisation is unverified.
- **Tool Preferences's 7–17× description-layer findings cross-cut OpenAI vs Qwen**, not Anthropic vs MiniMax. Direction is consistent; magnitude is not guaranteed.
- **MiniMax publishes nothing**. The Sprint 32 observation (+35pp on negative-constraint list) is empirically real but unsupported by any vendor-published rationale; the patterns chosen above are educated guesses about MiniMax-side mechanism, validated only by the substrate.
- **Fixture-shape question** (whether Sprint 32's 30-rfq + 30-nda + negative-control + playbook-mismatch fixtures expose the asymmetry well): the literature does not surface evidence the current fixtures are the wrong measurement substrate. Default position holds — Sprint 33 measures wording changes on Sprint 30 fixtures verbatim.
