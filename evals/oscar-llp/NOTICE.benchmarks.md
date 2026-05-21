# Benchmark Attributions — Sprint 25 iteration eval

The Oscar LLP partner-prompt iteration eval (Sprint 25, executing 24-C substrate per [[ADR-082]]) uses external legal-tech benchmarks. Per the respective licenses, this NOTICE preserves attribution. Benchmarks are eval-only; they are NOT bundled into the Oscar GC distribution. Source-document excerpts under `benchmarks/*.json` are redistributed with attribution under CC-BY-4.0 (truncated to 30,000 characters; `truncated: true` flagged per instance).

## MAUD — Merger Agreement Understanding Dataset

- **Source**: The Atticus Project — https://www.atticusprojectai.org/maud
- **License**: Creative Commons Attribution 4.0 International (CC-BY-4.0)
- **Citation**: Wang, S., Scardigli, A., Tang, L., Chen, W., Levkin, D., Chen, A., Ball, S., Woodside, T., Zhang, O., and Hendrycks, D. *MAUD: An Expert-Annotated Legal NLP Dataset for Merger Agreement Understanding.* NeurIPS 2023.
- **Use here**: Sarah Chen (M&A) iteration cycles. 50 instances loaded from `MAUD_test.csv` (test split) by `loaders/maud-loader.js`; N=20 sampled per cycle. Source docs from `data/contracts/<name>.txt`, truncated to 30k chars.

## CUAD — Contract Understanding Atticus Dataset

- **Source**: The Atticus Project — https://www.atticusprojectai.org/cuad
- **License**: Creative Commons Attribution 4.0 International (CC-BY-4.0)
- **Citation**: Hendrycks, D., Burns, C., Chen, A., and Ball, S. *CUAD: An Expert-Annotated NLP Dataset for Legal Contract Review.* NeurIPS 2021.
- **Use here**:
  - Diana Park (Privacy) — 50 instances from `CUADv1.json`. **Clause-type substitution**: CUAD does NOT include "Data_Privacy" in its 41-clause taxonomy. Diana's benchmark instead filters for the closest privacy-adjacent commercial clauses CUAD does cover: `Audit Rights`, `Affiliate License-Licensee`, `Affiliate License-Licensor`, `Anti-Assignment`, `Insurance`, `Change Of Control`, `Covenant Not To Sue`. The partner question template flags this substitution explicitly so judging accounts for it. See `loaders/cuad-loader.js`.
  - Aisha Khan (Tech Tx) — 50 instances from `CUADv1.json`. Filter: `License Grant`, `Cap On Liability`, `Uncapped Liability`, `Termination For Convenience`, `Post-Termination Services`, `Renewal Term`, `Notice Period To Terminate Renewal`, `Exclusivity`, `Source Code Escrow`, `Most Favored Nation`, `Volume Restriction`, `Warranty Duration`, `Irrevocable Or Perpetual License`, `Liquidated Damages`, `Affiliate License-Licensee`, `Affiliate License-Licensor`.

## LegalBench (deferred per drop-order)

- **Source**: Stanford CRFM / HazyResearch — https://hazyresearch.stanford.edu/legalbench/
- **License**: MIT License (and per-task license metadata for vendored tasks).
- **Citation**: Guha, N., et al. *LegalBench: A Collaboratively Built Benchmark for Measuring Legal Reasoning in Large Language Models.* 2023.
- **Status**: Stub file `benchmarks/legalbench-privacy.json` retained for drop-order reactivation. Not loaded in Sprint 25; iter-0 results determine whether benchmark-source overfitting evidence justifies activation.

## Public SaaS T&Cs corpus (deferred per drop-order)

- **Source**: Public-facing terms of service / customer agreements scraped from major SaaS providers' GitHub-hosted docs.
- **License**: Per-site Terms of Service. Research use only.
- **Status**: Stub file `benchmarks/github-saas-tnc.json` retained for drop-order reactivation. Not loaded in Sprint 25.

## License compatibility

Atticus Project MAUD + CUAD are CC-BY-4.0; LegalBench is MIT. Both compatible with Oscar GC's Apache-2.0-or-MIT-license posture for our own additions. Eval outputs (transcripts, scores, proposals) under `iterations/` are git-ignored per `.gitignore` rules. Curated reports under `reports/` are derivative works of Oscar GC's iteration analysis. Benchmark instance JSON files under `benchmarks/` contain source-document excerpts (truncated to 30k chars) — redistribution permitted under CC-BY-4.0 with attribution; this NOTICE.benchmarks.md is the attribution surface.
