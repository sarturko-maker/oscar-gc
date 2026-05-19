## User

Sarah Chen

---

## Oscar

Sarah. What role do you play at the company, and which one is it?

---

## User

I'm Sarah Chen, General Counsel here at PayFlow. I report to the CFO and oversee legal across our B2B payments SaaS business — commercial deals, privacy compliance, regulatory matters, employment, the works. We're based in the UK but operate in the US and Germany too.

---

## Oscar

PayFlow, B2B payments SaaS. Size-wise — a handful of people, a few hundred, or larger?

---

## User

We're in the 1,001-5,000 employee range — mid-market, B2B SaaS.

---

## Oscar

Based on a B2B payments SaaS operating in UK, US, and Germany, I'd expect: GDPR, UK GDPR, FCA registration, PSD2/PSR (or PSD3 as it transitions), DORA, DSA, AI Act, and US state money-transmitter regimes in the operating states.

Any I'm missing or off?

---

## User

You're close. A few notes:

**FCA** — Yes, FCA authorization is the practical outcome of PSD2/PSR compliance in the UK. We often track it separately in the register as the authorizing regulator.

**AML/BSA** — Missing. Fundamental for payments across all three jurisdictions: UK Money Laundering Regulations 2017, US BSA/FinCEN, German GwG. This is baseline infrastructure, not optional.

**AI Act** — Technically in force for EUdeployments now, but for a B2B SaaS it's more of a cross-cutting governance item than core payment regulation. I'd weight it lower than AML/BSA unless you're selling AI-native features.

**State MTLs** — Correct. Worth noting California and New York are the expensive ones (CA-DBO, BitLicense).

**PCI DSS** — Already covered in our stack (Level 1), but worth calling out since you're handling card data.

**What we don't track that may matter:** UK Electronic Money Regulations if you hold customer funds (even temporarily), and German BaFin oversight if you're processing cross-border into the EU broadly.

Anything specific you want to dig into?

---

## Oscar

Understood — I'll capture AML/BSA as baseline infrastructure, FCA as the UK authorizing register entry, and note the state money-transmitter regimes (CA-DBO, BitLicense) and PCI DSS.

Now, recurring matters: what kinds of legal work come up repeatedly for PayFlow, and who do you typically loop in — CFO, finance, product, compliance?

---

## User

Three big buckets on repeat: customer contracts (SaaS T&Cs, often custom for enterprise), vendor MSAs for our cloud/data infra (AWS, Snowflake, etc.), and MSA renegotiations as deals scale.

Then there's the FCA — we get regulatory queries a few times a quarter, usually around authorization scope or PSD2 compliance.

Stakeholders I loop in: CFO on anything financial or commitment threshold, CISO for vendor security reviews, CTO on tech procurement and data handling, and VP Sales on the customer deal terms. Anything above £500k goes to CEO; material regulatory matters go to the Board.

---

## Oscar

Three buckets: customer contracts, vendor MSAs, MSA renegotiations — plus FCA regulatory work. CFO, CISO, CTO, VP Sales as regulars, £500k threshold to CEO, Board for material regulatory.

One more: risk appetite — conservative, balanced, or growth-oriented?

---

## User

Balanced — we take reasonable risks but not reckless ones. Makes sense for a regulated B2B payments business handling other people's money.

---

## Oscar

Now the practice areas. Here's what I have by default — let me know if anything doesn't fit:

**Commercial + Commercial Disputes** — Customer contracts, vendor MSAs, dispute memory.
**Corporate + CoSec** — Entities, subsidiaries, board records, statutory filings.
**Employment + Employment Disputes** — Employees, contractors, HR memory, tribunal matters.
**Privacy** — Data subjects, processors, privacy memory.
**IP + IP Disputes** — Inventors, marks, IP portfolio, infringement claims.
**Regulatory + Regulatory Disputes** — Regulators, obligations, FCA/AML/enforcement.
**Product** — Products, releases, product-agreement memory.
**AI Governance** — Models, datasets, AI risk artefacts.

That's the full list. Looks close to your practice, or do you want to drop or add anything?

---

## User

That's close. From PayFlow's perspective, I'd keep:

- **Commercial** — customer agreements, vendor MSAs (our bread and butter)
- **Privacy** — data subjects, processors
- **Regulatory** — FCA, AML, but drop the disputes piece, we handle that externally
- **Employment** — employees, contractors, but again disputes go outside
- **AI Governance** — models, risk
- **Corporate** — entities, subsidiaries

Drop: CoSec, IP, Product, and all the disputes variants. We're a lean team — matters that hit tribunals or litigation go to external counsel.

That works for us.

---

## Oscar

All the plugin question libraries are empty — the regulatory baseline and geography already cover the key dimensions (privacy regimes, employment jurisdictions, primary regulators).

That's everything I needed area-by-area.

Anything else I should know before I hand you off to the practice-area agents — biggest legal challenge right now, a recent change in the business, or anything specific I haven't asked about?

---

## User

One thing to flag: the acquisition. We're acquiring a smaller competitor next quarter — diligence is already active. That'll be the bulk of legal bandwidth for the next few months: deal docs, integration, regulatory notifications, IP/privacy due diligence.

On the regulatory side, DORA kicks in soon — January 2025 for EU entities. We're not fully compliant yet, and our德国 business falls squarely in scope.

Beyond that, nothing urgent. The FCA queries have been manageable.

---

## Oscar

Acquisition and DORA compliance — noted. Let me finalize your profile.

I'm using MiniMax-M2.5 to power Oscar GC. That works for you?

Here's the profile I'm about to save:

**You** — Sarah Chen, General Counsel, PayFlow.
**Company** — B2B payments SaaS, UK HQ operating in US and Germany, 1,001-5,000 employees.
**Regulatory baseline** — GDPR, UK GDPR, FCA, AML/BSA, PSD2/PSR, DORA, DSA, state money-transmitter regimes (CA-DBO, BitLicense), PCI DSS.
**Recurring matters** — Customer contracts, vendor MSAs, FCA regulatory queries.
**Stakeholders** — CFO, CISO, CTO, VP Sales; £500k to CEO, material regulatory to Board.
**Risk appetite** — Balanced.
**Practice areas** — Commercial, Privacy, Regulatory, Employment, AI Governance, Corporate.
**Open notes** — Acquisition (next quarter, active diligence), DORA compliance (January 2025, German entity in scope).

Save?

---

## User

Save. Works for me.

MiniMax-M2.5 — you're the engineer, you tell me. My concern is whether it gives me sound legal advice, not the silicon.

---

## Oscar

Welcome to Oscar GC. Your practice areas are listed in the sidebar — agents are briefed with your context. Pick one to begin.