This is a solid regulatory question for the LLM rollout. Let me give you the key issues and analysis.

---

## 1. DPA Addendum — Gaps vs. Standard DPA

Your standard DPA likely covers baseline SaaS vendors (payment processors, cloud infrastructure, etc.). LLM providers expose different vectors:

| Gap | Why It Matters for LLM |
|---|---|
| **Training/Tuning Rights** | Most LLM providers either (a) state they train on API inputs, or (b) offer "non-training" tokens at premium. Need explicit prohibition or opt-out. |
| **Prompt & Context Retention** | Standard DPA says "delete after processing." LLM providers often retain inputs for months for model retraining/debugging. Need specific retention windows + deletion confirmations. |
| **Output Ownership** | Who owns generated text? Derivative works? IP clauses are often missing—providers typically claim broad rights to outputs. |
| **Inference/Generated Personal Data** | If the model infers new personal data (e.g., categorises transactions, predicts behaviour), that's "new" data. DPA should clarify who is controller for outputs. |
| **Model Access/Audit Rights** | Standard DPA has audit rights. For LLM, need clause for model cards, bias documentation, impact assessments—particularly if provider won't allow technical audits. |
| **Sub-processor Visibility** | LLM stacks often involve: model provider → cloud host → inference engine → embedding service. Need full chain + objection rights. |
| **Geographic Control** | Providers may offer region-locked deployment but with limited guarantees. Need explicit data localisation commitments tied to regulatory requirements (UK→UK, US→US). |
| **Security Architecture** | Standard DPA security annex is insufficient. Need: encryption at rest/in transit, key management, whether provider sees plaintext prompts, ingress/egress controls. |

**Practical recommendation:** Get these as "mandatory" clauses in the addendum—don't let provider push entirely to their T&Cs.

---

## 2. Controller Posture Analysis

### The "Essential Service" Argument

LLM providers (Anthropic, OpenAI, Google, etc.) often contract as processors but behave like **sub-processors with limited negotiability**—standard T&Cs, no SLA tweaks, "essential service" framing.

| Factor | Analysis |
|---|---|
| **Who determines purposes?** | You're sending customer data to achieve a defined purpose (fraud detection, customer support summarisation, etc.). You determine *why*; provider determines *how*. That points to **you = controller**, them = processor. |
| **Who selects the model?** | If you're locked into a specific model (e.g., "we use GPT-4"), you have less discretion—but you still choose the processing activity. Not enough for joint controllership. |
| **Provider "essential service" claim** | Under UK GDPR, "essential" doesn't relieve processor obligations—it describes a service the data subject depends on (e.g., telecom). For LLM, this is a **commercial** claim, not a legal one. It doesn't change the controller/processor analysis. |
| **Joint controllership risks** | If the provider uses inputs for its own purposes (training, product improvement), they become a joint controller. Need explicit prohibition + audit. |
| **FCA angle** | If you're sending transaction data through a US provider, FCA may ask about data localisation and your due diligence on the provider's security posture. This is a regulatory risk, not just contract risk. |

**Bottom line:** You are the controller for processing through LLM APIs. The provider is a processor (or potential joint controller if they retain training rights). The "essential service" framing is marketing, not law—don't let it dilute your due diligence or contractual protections.

---

## 3. Minimum Viable Addendum Clauses

For the acquisition phase (UK/US target), expect extra scrutiny. Your addendum should include:

1. **No training on customer data** — explicit opt-out, with deletion of inputs after inference.
2. **Retention cap** — 30 days max for inputs (or shorter), with certifiable deletion.
3. **Data locality guarantee** — UK data processed in UK/EU regions only; US data in US.
4. **Output rights** — outputs belong to you; provider has no reuse rights.
5. **Breach notification** — 24hr notice for any compromise of your data, not just "material" breaches.
6. **Audit** — right to request model documentation, impact assessments, and (where feasible) technical access.
7. **Sub-processor chain** — full disclosure + objection right.

---

Want me to flag any specific regulatory (FCA/ICO) precedents on AI processing, or draft a term sheet for negotiation?