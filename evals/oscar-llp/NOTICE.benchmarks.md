# Benchmark Attributions — Sprint 24-C iteration eval

The Oscar LLP partner-prompt iteration eval (Sprint 24-C) uses external legal-tech benchmarks. Per the respective licenses, this NOTICE preserves attribution. Benchmarks are eval-only; they are NOT bundled into the Oscar GC distribution.

## MAUD — Merger Agreement Understanding Dataset

- **Source**: The Atticus Project — https://www.atticusprojectai.org/maud
- **License**: Creative Commons Attribution 4.0 International (CC-BY-4.0)
- **Citation**: Wang, S., Scardigli, A., Tang, L., Chen, W., Levkin, D., Chen, A., Ball, S., Woodside, T., Zhang, O., and Hendrycks, D. *MAUD: An Expert-Annotated Legal NLP Dataset for Merger Agreement Understanding.* NeurIPS 2023.
- **Use here**: Sarah Chen (M&A) iteration cycles. Filtered to 50 instances (~20 sampled per cycle).

## CUAD — Contract Understanding Atticus Dataset

- **Source**: The Atticus Project — https://www.atticusprojectai.org/cuad / HuggingFace mirror `theatticusproject/cuad-qa`
- **License**: Creative Commons Attribution 4.0 International (CC-BY-4.0)
- **Citation**: Hendrycks, D., Burns, C., Chen, A., and Ball, S. *CUAD: An Expert-Annotated NLP Dataset for Legal Contract Review.* NeurIPS 2021.
- **Use here**: 
  - Diana Park (Privacy) — Data_Privacy + Audit_Rights + Affiliate_License clause types (~50 instances).
  - Aisha Khan (Tech Tx) — SaaS + Source_Code_Escrow + Most_Favored_Nation + Volume_Restriction clause types (~30 instances).

## LegalBench

- **Source**: Stanford CRFM / HazyResearch — https://hazyresearch.stanford.edu/legalbench/
- **License**: MIT License (and per-task license metadata for vendored tasks).
- **Citation**: Guha, N., Nyarko, J., Ho, D.E., Re, C., Chilton, A., Narayana, A., Chohlas-Wood, A., Peters, A., Waldon, B., Rockmore, D.N., Zambrano, D., Talisman, D., Hoque, E., Surani, F., Fagan, F., Sarfaty, G., Dickinson, G.M., Porat, H., Hegland, J., Wu, J., Nudell, J., Niklaus, J., Nay, J., Choi, J.H., Tobia, K., Hagan, M., Ma, M., Livermore, M., Rasumov-Rahe, N., Holzenberger, N., Kolt, N., Henderson, P., Rehaag, S., Goel, S., Gao, S., Williams, S., Gandhi, S., Zur, T., Iyer, V., and Li, Z. *LegalBench: A Collaboratively Built Benchmark for Measuring Legal Reasoning in Large Language Models.* 2023.
- **Use here**: Diana Park (Privacy) supplement — `privacy_policy_qa` task instances. Drop-order candidate #2 if scope tightens.

## Public SaaS T&Cs corpus (research use)

- **Source**: Public-facing terms of service / customer agreements scraped from major SaaS providers' GitHub-hosted docs.
- **License**: Per-site Terms of Service. Used here for non-commercial research evaluation only.
- **Use here**: Aisha Khan (Tech Tx) supplement. Drop-order candidate #1 if scope tightens.

## License compatibility

Atticus Project MAUD + CUAD are CC-BY-4.0; LegalBench is MIT. Both compatible with Oscar GC's Apache-2.0-or-MIT-license posture for our own additions. Eval outputs (transcripts, scores) under `iterations/` are git-ignored per `.gitignore` rules. Curated reports under `reports/` are derivative works of Oscar GC's iteration analysis; the underlying benchmark instances are NOT redistributed verbatim except as JSON pointers (document_id + clause-type + gold-label) under `benchmarks/`.
