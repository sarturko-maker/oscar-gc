## KFTC Inquiry: Carrier-Ranking Algorithm — Defensibility Assessment

Based on my research of Korean competition law and KFTC enforcement patterns, here's where you stand and how to defend the approach.

---

### The Legal Line

**Prohibited discrimination** under Article 23(1) MRFTA and the KFTC's Online Platform Review Guidelines (Jan 2023) targets:

1. **Self-preferencing** — favoring your own services or affiliated carriers through algorithmic manipulation
2. **Undisclosed or fabricated inputs** — using non-transparent metrics or unreliable data as ranking signals
3. **Affiliation-based favoritism** — disadvantaging non-affiliated carriers without objective justification

**Performance-based differentiation** is permissible when you can demonstrate:

- The metric is **objectively measurable** and applied uniformly to all carriers
- The metric is ** causally linked** to consumer welfare (e.g., delivery speed, cost savings)
- The weighting is the **least restrictive means** to achieve a pro-competitive efficiency
- Benefits accrue to users/buyers, not just your platform's cost savings

Your three factors — on-time delivery, claim ratio, and pricing — are all **objective, measurable, and consumer-facing**. That's a strong starting position. The issue is whether the weighting applies uniformly or veers into hidden preference for affiliated carriers.

---

### What Triggers KFTC Liability (From Enforcement History)

| Case | Violation | Fine |
|------|-----------|------|
| **Naver** | Search ranking manipulation favoring Naver Smart Store | KRW ~26.7B |
| **Kakao Mobility** | Algorithmic dispatch favoring affiliated taxis | KRW 25.7B |
| **Coupang** | Search algorithm manipulation + undisclosed employee reviews | KRW hundreds of billions |

**Common trigger patterns**: undisclosed ranking inputs, affiliation-based favoritism, manipulation of algorithmic stages without documented rationale.

Your defensible position requires showing these three factors are **documented, versioned, uniformly applied, and genuinely tied to delivery quality**.

---

### Defensible Documentation Posture

| Element | What KFTC Expects | Your Readiness |
|--------|-------------------|-----------------|
| **Ranking criteria disclosure** | Publish criteria categories + business rationale | ✅ Publish on-site; internal doc needed |
| **Audit logs** | Timestamped ranking decisions, model versions, input data provenance | ⚠️ Verify logs exist for each algorithm change |
| **Attribution rules** | Documented rules for measuring on-time delivery, claim attribution | ⚠️ Define who owns the data (carrier vs. platform) |
| **Weighting rationale** | Business case linking each factor to consumer welfare | ⚠️ Document why each weight matters |
| **Appeal mechanism** | Seller/carrier can contest ranking, obtain explanation | ⚠️ Implement if not existing |
| **Model governance** | Formalized process for algorithm updates + manual overrides | ⚠️ Formalize if ad hoc |

---

### Immediate Action Items

1. **Document your weighting formula** — KFTC will ask for the exact weights and how each factor drives visibility. Have an internal memo explaining why on-time delivery matters to shipping customers, why claim ratio reflects service quality, and why pricing benefits buyers.

2. **Preserve audit trails** — Log every ranking model version, the input data (carrier delivery reports), and any manual overrides. Enforcement turns on whether you can show the algorithm wasn't manipulated post-hoc.

3. **Define attribution standards** — How do you measure "on-time delivery"? Who's timestamp counts? Carrier's pick-up confirmation or buyer's receipt? Document this and apply it uniformly.

4. **Neutral benchmarking** — If any carriers are affiliated, test whether removing the affiliation factor changes ranking outcomes. If it does, document why the performance factors still justify the ranking independently.

5. **Prepare a business rationale memo** — One internal document showing: (a) each metric's link to buyer experience, (b) the efficiency gain from prioritizing high-performance carriers, (c) that no less restrictive means exists to achieve the same buyer outcome.

6. **Seller/carrier appeal process** — Ensure affected carriers can query their ranking and receive a documented response. KFTC procedural rules emphasize parties' right to be heard.

---

### Bottom Line

Your algorithm uses **objective, consumer-relevant metrics** — that's the right side of the line. The risk isn't the factors themselves; it's whether you can demonstrate they're applied **uniformly, transparently, and without hidden affiliation bias**.

Document the weighting, preserve the logs, and build the appeal pathway. If an affiliated carrier happens to rank well, show the performance factors earned it — not the affiliation. That's your defensible posture.