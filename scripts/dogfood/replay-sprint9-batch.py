#!/usr/bin/env python3
"""Sprint 13 — deterministic replay of Sprint 9's adeu batch through PATCHED adeu.

Sprint 9 dogfood captured the LLM's exact (target_text, new_text) pairs in
docs/dogfood/sprint-9/cli-transcript.txt. Each pair is a wholesale
clause-scale rewrite. Pre-patch, adeu produced 15 tracked elements with
median wrap = 60 words (verified by verify-redline-shape.py inspect).

This script replays the same batch through adeu's RedlineEngine in-process,
exercising the ADR-045 word-diff vendor patch. Output written to
docs/dogfood/sprint-13/sprint9-replay-patched.docx; pair the run with
verify-redline-shape.py inspect to compare width distributions.

Run via:
  /srv/projects/oscar-runtime/python/adeu-venv/bin/python scripts/dogfood/replay-sprint9-batch.py
"""

from __future__ import annotations

import sys
from io import BytesIO
from pathlib import Path

from docx import Document  # type: ignore[import-not-found]

from adeu.models import ModifyText  # type: ignore[import-not-found]
from adeu.redline.engine import RedlineEngine  # type: ignore[import-not-found]

REPO_ROOT = Path(__file__).resolve().parents[2]
INPUT_DOCX = REPO_ROOT / "docs" / "dogfood" / "sprint-9" / "fixtures" / "unilateral-nda.docx"
OUTPUT_DOCX = REPO_ROOT / "docs" / "dogfood" / "sprint-13" / "sprint9-replay-patched.docx"
AUTHOR = "Oscar"

# Sprint 9's batch, lifted verbatim from docs/dogfood/sprint-9/cli-transcript.txt.
# Each (target, new) pair is exactly what MiniMax sent to adeu's process_document_batch.
# Verbatim quoting: do NOT reformat or shorten — the diff against fixture text
# must be byte-equivalent to the Sprint 9 run.
BATCH: list[tuple[str, str]] = [
    (
        'This Non-Disclosure Agreement (the "Agreement") is entered into as of the date last signed below (the "Effective Date") by and between Sentinel Foundry Ltd., a company incorporated in England and Wales with company number 09876543, with its registered office at 12 Wharf Lane, London EC1A 2BB ("Party A"), and the counterparty signing below ("Party B"). Each is referred to herein as a "Party" and together as the "Parties".',
        'This Non-Disclosure Agreement (the "Agreement") is entered into as of the date last signed below (the "Effective Date") by and between Sentinel Foundry Ltd., a company incorporated in England and Wales with company number 09876543, with its registered office at 12 Wharf Lane, London EC1A 2BB ("Party A"), and the counterparty signing below ("Party B"). Each is referred to herein as a "Party" and together as the "Parties". **Each Party may disclose its Confidential Information to the other Party, and each Party may receive Confidential Information from the other Party, in connection with the Purpose.**',
    ),
    (
        "Party A wishes to disclose to Party B certain confidential and proprietary information in connection with the parties' evaluation of a potential commercial relationship relating to Party A's industrial process control software (the \"Purpose\"). Party B agrees to receive such information subject to the obligations set out in this Agreement.",
        "Party A wishes to disclose to Party B, and Party B wishes to disclose to Party A, certain confidential and proprietary information in connection with the parties' evaluation of a potential commercial relationship relating to Party A's industrial process control software (the \"Purpose\").",
    ),
    (
        '"Confidential Information" means any non-public information disclosed by Party A to Party B, whether before or after the Effective Date and whether in writing, orally, electronically, or by inspection of tangible objects, that is identified as confidential at the time of disclosure or that a reasonable person would understand to be confidential given its nature and the circumstances of disclosure. Confidential Information includes, without limitation, Party A\'s business plans, customer lists, source code, technical specifications, financial information, and unreleased product roadmaps.',
        '"Confidential Information" means any non-public information disclosed by **either** Party to the other, whether before or after the Effective Date and whether in writing, orally, electronically, or by inspection of tangible objects, that is identified as confidential at the time of disclosure or that a reasonable person would understand to be confidential given its nature and the circumstances of disclosure. Confidential Information includes, without limitation, the **disclosing Party\'s** business plans, customer lists, source code, technical specifications, financial information, and unreleased product roadmaps.',
    ),
    (
        "Party B shall: (a) hold Party A's Confidential Information in strict confidence and protect it with no less than the same degree of care that Party B uses to protect its own confidential information of similar importance, but in no event less than a reasonable degree of care; (b) use Party A's Confidential Information solely for the Purpose and for no other reason; (c) not disclose Party A's Confidential Information to any third party without Party A's prior written consent; and (d) limit access to Party A's Confidential Information to those of its employees, contractors, and professional advisers who have a need to know it for the Purpose and who are bound by confidentiality obligations at least as protective as those in this Agreement.",
        "The Receiving Party shall: (a) hold **the other Party's** Confidential Information in strict confidence and protect it with no less than the same degree of care that **the Receiving Party** uses to protect its own confidential information of similar importance, but in no event less than a reasonable degree of care; (b) use **the other Party's** Confidential Information solely for the Purpose and for no other reason; (c) not disclose **the other Party's** Confidential Information to any third party without **the disclosing Party's** prior written consent; and (d) limit access to **the other Party's** Confidential Information to those of its employees, contractors, and professional advisers who have a need to know it for the Purpose and who are bound by confidentiality obligations at least as protective as those in this Agreement.",
    ),
    (
        "The obligations in clause 3 do not apply to information that Party B can demonstrate by competent evidence: (a) was already in Party B's lawful possession without confidentiality restriction prior to disclosure by Party A; (b) is or becomes publicly available through no breach of this Agreement by Party B; (c) is rightfully received from a third party not under a confidentiality obligation to Party A; or (d) is independently developed by Party B without use of or reference to Party A's Confidential Information.",
        "The obligations in clause 3 do not apply to information that the Receiving Party can demonstrate by competent evidence: (a) was already in the Receiving Party's lawful possession without confidentiality restriction prior to disclosure by the other Party; (b) is or becomes publicly available through no breach of this Agreement by the Receiving Party; (c) is rightfully received from a third party not under a confidentiality obligation to the other Party; or (d) is independently developed by the Receiving Party without use of or reference to the other Party's Confidential Information.",
    ),
    (
        "If Party B is compelled by law, regulation, or court order to disclose Party A's Confidential Information, Party B shall, to the extent legally permitted, provide Party A with prompt prior written notice and cooperate with Party A's reasonable efforts to obtain a protective order or other appropriate remedy. If such a remedy is not obtained, Party B shall disclose only that portion of the Confidential Information that it is legally required to disclose.",
        "If the Receiving Party is compelled by law, regulation, or court order to disclose **the other Party's** Confidential Information, the Receiving Party shall, to the extent legally permitted, provide **the disclosing Party** with prompt prior written notice and cooperate with **the disclosing Party's** reasonable efforts to obtain a protective order or other appropriate remedy. If such a remedy is not obtained, the Receiving Party shall disclose only that portion of the Confidential Information that it is legally required to disclose.",
    ),
    (
        "Upon Party A's written request, or upon termination of discussions between the Parties, Party B shall promptly return to Party A or destroy (at Party A's option) all materials in any form containing or reflecting Party A's Confidential Information, and certify in writing that it has done so. Party B may retain a single archival copy solely to comply with applicable legal or regulatory retention requirements, which copy shall remain subject to the confidentiality obligations in this Agreement for so long as it is retained.",
        "Upon **either Party's** written request, or upon termination of discussions between the Parties, the Receiving Party shall promptly return to **the disclosing Party** or destroy (at **the disclosing Party's** option) all materials in any form containing or reflecting **the other Party's** Confidential Information, and certify in writing that it has done so. The Receiving Party may retain a single archival copy solely to comply with applicable legal or regulatory retention requirements, which copy shall remain subject to the confidentiality obligations in this Agreement for so long as it is retained.",
    ),
    (
        "Party B acknowledges that a breach of this Agreement by Party B would cause Party A irreparable harm for which monetary damages would not be an adequate remedy, and accordingly Party A shall be entitled to seek injunctive relief and specific performance, in addition to any other remedies available at law or in equity, without the requirement to post bond.",
        "**Each Party acknowledges that a breach of this Agreement by the other Party would cause the non-breaching Party irreparable harm for which monetary damages would not be an adequate remedy, and accordingly the non-breaching Party shall be entitled to seek injunctive relief and specific performance, in addition to any other remedies available at law or in equity, without the requirement to post bond.**",
    ),
]


def main() -> int:
    if not INPUT_DOCX.exists():
        print(f"FAIL: input not found: {INPUT_DOCX}", file=sys.stderr)
        return 2

    OUTPUT_DOCX.parent.mkdir(parents=True, exist_ok=True)

    with INPUT_DOCX.open("rb") as f:
        stream = BytesIO(f.read())
    engine = RedlineEngine(stream, author=AUTHOR)

    changes = [
        ModifyText(type="modify", target_text=t, new_text=n, comment=None) for t, n in BATCH
    ]

    result = engine.process_batch(changes)
    print(f"applied={result['edits_applied']}  skipped={result['edits_skipped']}")
    if result.get("skipped_details"):
        for d in result["skipped_details"]:
            print(f"  {d}")

    out = engine.save_to_stream()
    OUTPUT_DOCX.write_bytes(out.getvalue())
    print(f"wrote: {OUTPUT_DOCX}")
    return 0 if result["edits_applied"] > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
