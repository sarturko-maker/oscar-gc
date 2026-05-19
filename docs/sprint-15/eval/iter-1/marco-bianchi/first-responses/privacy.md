Understood — I can see the matter files aren't accessible here, but I've got the facts from your intake.

## Article 6 Analysis: Training on Public-Scrape Corpus

**The problem:** Emails in commit messages and names in code comments are personal data (Art. 4(1) GDPR — "any information relating to an identified or identifiable natural person," including email addresses and names). Training a model on this involves GDPR "processing" (Art. 4(2)). So we need an Article 6 lawful basis.

### Candidate bases:

| Basis | applicability | risk |
|---|---|---|
| **Art. 6(1)(f) — legitimate interests** | Most plausible. We have a genuine interest in training foundation models. Public data was openly accessible. Core balancing test: our interest vs. data subject rights. | High. The balancing is tough — data subjectslikely didn't expect their commit metadata to train third-party AI. Recital 47 weighs AI research, but not a blanket excuse. |
| **Art. 6(1)(a) — consent** | Impractical. Getting consent from millions of GitHub/GitLab users whose commits are in the scrape is impossible. | N/A — not viable. |
| **Art. 6(1)(c) — legal obligation** | No obligations requiring this training. | N/A. |
| **Art. 6(1)(b) — contract** | Not applicable. | N/A. |

**My take:** Legitimate interests is the only runway, but it's not a safe harbor. We need to document the balancing test rigorously — see below.

### The "public" trap

Just because data is *publicly accessible* on the web doesn't equal "publicly available personal data" under GDPR (that term isn't in the regulation). People posting code with their email don't implicitly consent to AI training. The EDPD's guidance on web scraping is evolving, but the consensus trend is: **publicly available ≠ freely given for AI training**.

## Deployment Notice Strategy

Here's the tension: we need to disclose to meet transparency obligations (Art. 13/14, + Art. 5(1)(a) principle), but we don't want to invite a regulatory complaint or litigation by being too specific.

### Principles:
1. **Be accurate, not self-incriminating** — Say what we did, not "we violated GDPR"
2. **Use generic phrasing where legally permissible** — "trained on publicly available code repositories" is true; "likely contains personal data" is speculation we can flag
3. **Anchor to rights-neutral language** — Focus on what rights exist, not what we think data subjects can't exercise

### Draft language (tweaks needed for your T&Cs):

> **Data Sources**
> Our models are trained on publicly available code and related data from open-source repositories. This data may include information such as email addresses or names that authors included in their publicly posted code. 
> 
> **Your Rights**
> Under applicable data protection law (including GDPR and UK GDPR), you may have the right to access, rectify, or erase personal data contained in training data used for our models. To exercise these rights or raise concerns, contact [privacy @ yourdomain]. We will assess requests on a case-by-case basis, considering technical constraints of model retraining.

### What this does:
- Satisfies Art. 13/14 disclosure obligation (general notice of data sources)
- Doesn't admit breach — it's a factual description
- Preserves defensibility — "assess on case-by-case basis" gives you flexibility rather than promising retraining (which may be impossible)
- Opens the door for individual DSARs without guaranteeing outcomes

### What *doesn't* work:
- Over-specific admission ("we scraped GitHub and didn't filter emails") — invites targeted complaints
- Promising deletion from model weights — likely technically impossible, and overpromising creates Art. 5(1)(b) violation risk if you can't deliver

## Risk mitigation beyond the notice

1. **Document the LI balancing test** — Internal memo detailing: our interest (foundation model training / R&D), minimal expectation of privacy given public posting, no other viable data source, steps taken to reduce personal data (e.g., filtering if technically feasible). This is yourExhibit A if challenged.

2. **Consider technical remediation** — If there's a reasonable way to filter emails/names post-hoc (even if imperfect), do it and document it. Shows good faith.

3. **Watch the AI Act** — If your model is high-risk under EU AI Act, the conformity assessment process will require documenting training data provenance. This may need to be more detailed than the deployment notice. Coordinate with Trust & Safety.

4. **Jurisdiction nuance** — UK GDPR has the same Art. 6 framework, but the ICO has been more aggressive on web scraping. If you have UK users or the model is deployed there, the legitimate interests balancing is even tighter.

---

**Next steps?** I can draft the internal LI balancing memo, refine the deployment notice language for B2C vs. B2B contexts, or pull the latest ICO/EDPB guidance on web scraping if you want to cite specific Regulatory language. LMK how you want to proceed.