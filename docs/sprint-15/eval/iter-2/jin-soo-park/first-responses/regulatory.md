# Legal Analysis: Carrier Ranking Algorithm & KFTC Compliance

## The Line: Performance-Based vs. Prohibited Discrimination

Based on Korea's regulatory framework, here's where the line falls:

### ✅ Legitimate Performance Factors (Your Current Weights)

| Factor | Status | Rationale |
|--------|--------|-----------|
| **On-time delivery rate** | ✅ Generally permissible | Direct consumer-impacting metric; aligns with ecommerce service quality |
| **Claim/complaint ratio** | ✅ Generally permissible | Objective service failure indicator; relates to consumer harm |
| **Pricing** | ⚠️ Context-dependent | Can be legitimate if reflecting real cost differentials, but risky if used to favor price-competitive carriers over smaller/newer ones |

### 🚩 Red Flags Under Korea Law

The KFTC's enforcement pattern—particularly the Naver Shopping case (KRW 26.6 billion fine, 2021) and Coupang case—shows triggers:

1. **Self-preferencing**: Prioritizing your own private brand or affiliated carriers → violates 공정거래법 Article 21-2 (discriminatory treatment prohibition)
2. **Opaque weighting**: Applying hidden/adjusted weights that affect ranking without disclosure → violates 전자상거래법 Article 23 disclosure obligations
3. **Algorithmic manipulation**: Adjusting algorithms to downgrade specific sellers/carriers without objective justification → can constitute "unfair discrimination" under the Platform Competition guidelines
4. **Incentive-based ranking**: Ranking that effectively forces carriers to use your paid services → potentially abusive under MRFTA Article 21

---

## Legal Framework Summary

| Source | Key Provisions | Your Risk |
|--------|--------------|----------|
| **공정거래법 (MRFTA)** | Article 21 – Prohibits discriminatory treatment; Article 21-2 – Prohibits self-preferencing | Medium |
| **전자상거래법** | Article 23 – Platform operator disclosure obligations | Medium-High |
| **KFTCPlatform Guidelines** | Requires disclosure of ranking/exposure criteria | High (specific enforcement here) |
| **Proposed Online Platform Fairness Act** | Would require mandatory disclosure of ranking criteria; under legislative discussion | Monitor |

**Key case**: The Naver Shopping case (2021) is directly analogous—KFTC found that manipulating search algorithm to favor own service constituted unfair discrimination under Article 21 and abuse of market-dominant position.

---

## Defensibility: Documentation Posture

### Minimum Required Documentation

1. **Written Ranking Methodology Document**
   - Explicitly list all weighting factors
   - State objective rationale for each weight
   - Document that the methodology was set **before** implementation (not retrofitted after dispute)
   - Show that weights are applied **uniformly** to all carriers, not selectively

2. **Algorithm Audit Trail**
   - Retain logs showing how weights translate to ranking positions
   - Document any changes to weights with justification
   - Demonstrate that third-party carriers are not systematically disadvantaged vs. your affiliates

3. **Periodic Review Records**
   - Show regular (at least annual) internal reviews of whether weights remain objectively justified
   - Document consideration of alternative metrics

4. **Disclosure Evidence**
   - Evidence that ranking methodology is accessible to carriers (terms of service, seller FAQ, or similar)
   - If no written disclosure exists, this is your highest compliance gap

---

## Recommendations

| Priority | Action |
|----------|--------|
| **Immediate** | Document your current weighting methodology in writing if not already done |
| **Immediate** | Verify that weights apply uniformly to all carriers (including any affiliates) |
| **Short-term** | Review whether your pricing weight could be recharacterized as "discriminating against smaller carriers" |
| **Short-term** | Consider publishing a high-level ranking methodology in your seller terms |
| **Ongoing** | Retain audit trails; prepare for potential KFTC request for methodology explanation |

---

## Bottom Line

Your three factors (on-time delivery, claim ratio, pricing) are **not inherently discriminatory**—they can be legitimate performance factors. The key questions KFTC will ask:

1. **Are weights disclosed?** → If not, this is the primary gap
2. **Is the methodology applied uniformly?** → If affiliates/subsidiaries are treated differently, this is problematic
3. **Can you demonstrate objective justification for each weight?** → Documentation is key
4. **Is there a business rationale, or does it disadvantage specific carriers systematically?** → The Naver case involved intent; mere outcome disparities alone are typically not sufficient for violation

**Start with documentation**. If you can produce a pre-existing methodology document showing these weights were set for service quality reasons (not to disadvantage competitors), you have a defensible position.