Let me work from the regulatory context and company details in the instructions block.

## Short Answer: Parallel Addenda Recommended

You cannot cleanly cover both with a single document. APPI and PIPA have fundamentally different consent paradigms — merging them creates a Frankendocument that satisfies neither regulator fully.

---

### Why Parallel, Not One Document

| Dimension | Korean PIPA | Japanese APPI |
|-----------|-------------|---------------|
| **Consent trigger** | Atsignup (implied consent acceptable for service provision) | **Explicit, opt-in affirmative consent** required for personal data use beyond necessity |
| **Scope of consent** | General terms cover processing for service delivery | Must specify **each purpose** — marketing, analytics, third-party sharing require separate consent |
| **Withdrawal mechanism** | Notice + discontinuation right | Must be as easy as giving consent (withdrawal toggle, not email required) |
| **Cross-border notice** | Required under PIPA Article 17 | Required under APPI Article 24 — separate disclosure |

**Your gap**: PIPA consent at signup covers "provide the service." APPI does not accept this — corporate user data going to a Korean processor requires explicit notice of:
- The fact of cross-border transfer
- Destination country (Korea — not on Japan's "white list" of adequate jurisdictions)
- The safeguards in place

---

### Recommended Structure

| Document | Purpose |
|----------|---------|
| **Standard DPA** | Core processing agreement — GDPR-style, covers your contractual bases with all shippers |
| **PIPA Addendum** | Attaches to DPA for Korean data subjects — affirm PIPA compliance, cross-border transfer notice, consent at signup flow documented |
| **APPI Addendum** | Attaches to DPA for Japanese corporate users (your customer, not their end users) — explicit consent flow, specified purposes, withdrawal toggle |

**Key point**: The APPI addendum is for *your customer's corporate users*, not their end recipients. You're the processor handling their shipment data. Your Japanese shipper customer likely needs this to show *their* KFTC-compliant (or Japan Customs) downstream obligations.

---

### Practical Takeaway for the Sales Team

Tell the Japanese customer:
> *"We've structured parallel addenda to keep each jurisdiction's flow clean. Our PIPA addendum covers the Korean side; the APPI addendum gives you the explicit consent language your corporate users see at account creation. One document would require you to explain to both regulators why the other framework's requirements are buried inside it."*

This is a commercial win: you're offering compliant specificity, not saying no.

---

*Want me to draft skeleton language for the APPI addendum — consent checkbox text, cross-border disclosure language, withdrawal mechanism wording?*