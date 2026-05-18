# Sprint 9 fixture provenance

## `unilateral-nda.docx`

**Source:** hand-drafted for Sprint 9 by CC, based on common English-law unilateral-NDA conventions visible in public-domain templates (SEC EDGAR exhibits, PandaDoc/Lawpath public samples, the UK Government NDA template guidance). No copying of a single source — a clean composition of widely-used clause patterns. No proprietary content from any party's actual NDAs.

**Shape:** one-direction commercial NDA. Party A (Sentinel Foundry Ltd.) discloses; Party B (counterparty) receives and accepts confidentiality obligations.

**Marker counts (input):**
- Party A: 24
- Party B: 18
- Receiving Party: 1
- either Party: 1
- both Parties: 1

The asymmetry is the load-bearing feature for the addendum's "substantive fixture" requirement: a real "make this mutual" instruction requires 7-8 coordinated edits across clauses 1, 3, 4, 5, 6, 8, 9 (the Obligations, Exclusions, Compelled Disclosure, Return, No-Licence/Warranty, and Remedies clauses all need mirroring; the Purpose recital may need adjustment).

**Generator:** `/tmp/build_nda_fixture.py` (committed at this path is the source-of-record; the .docx is the binary artifact under it). The script uses `python-docx` from the Sprint 9 adeu venv and produces a deterministic single-file output.

**Reproduce:**
```
/srv/projects/oscar-runtime/python/adeu-venv/bin/python /tmp/build_nda_fixture.py \
  docs/dogfood/sprint-9/fixtures/unilateral-nda.docx
```

**Why we don't ship a real public-domain sample:** public-domain NDA exhibits tend to be either too brief (single-paragraph confidentiality, no clause structure) or too jurisdiction-specific (US securities-filing NDAs include filing-specific recitals that distract from the redline workflow). A clean hand-drafted commercial NDA at the granularity an in-house lawyer would actually edit is the right fit for Sprint 9's verification standard.

**Provenance for any subsequent fixtures** (Sprint 10+ will likely re-use the shape) should follow this pattern: source-script committed under `fixtures/`, fixture binary committed alongside, PROVENANCE entry describing the synthesis and the marker counts that justify substantiveness.
