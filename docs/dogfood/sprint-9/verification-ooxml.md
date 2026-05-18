# Sprint 9 — OOXML change-by-change verification

The agent's batch under `redline__process_document_batch` produced 8 typed `modify` operations on `docs/dogfood/sprint-9/fixtures/unilateral-nda.docx`, written to `docs/dogfood/sprint-9/output-cli-verify.docx`. OOXML structural metrics:

| Metric | Input | Output | Delta |
|---|---|---|---|
| md5sum | `5c1320ed233165096536c66ab3364852` | `1d9892ccb68eed2847d6c2b819747f8c` | differs ✅ |
| Mutual-coded language markers (each Party / Receiving Party / Disclosing Party / the other Party / both Parties) | 2 | 32 | +30 ✅ |
| `<w:ins>` tags (Track Changes insertion) | 0 | 8 | +8 ✅ |
| `<w:del>` tags (Track Changes deletion) | 0 | 7 | +7 ✅ |
| python-docx parseable (no corruption) | yes | yes | ✅ |

The 8 inserts + 7 deletes correspond to 8 typed-modify operations in the batch. The 8th modify (Clause 9 / Remedies) is a wholesale rewrite where the new text bears no common substring with the original — adeu's engine emitted a single `w:ins` for the new content and no `w:del` for the old paragraph (it removed the run without flagging it as a deletion run). The other 7 modifies each produced a paired `w:ins` + `w:del`. This is engine behaviour, not a Sprint 9 finding.

## Change-by-change catalogue

For each typed-modify operation in the batch, I capture: which clause, the lawyer-shaped intent it served, and an in-document quote of what changed.

### 1. Preamble — append a mutuality clause

**Intent served**: declare upfront that the agreement is mutual; both Parties may be Disclosing.

**Before** (excerpt — final sentence of preamble):
> Each is referred to herein as a "Party" and together as the "Parties".

**After**:
> Each is referred to herein as a "Party" and together as the "Parties". **Each Party may disclose its Confidential Information to the other Party, and each Party may receive Confidential Information from the other Party, in connection with the Purpose.**

**Comment**: The agent appended rather than restructured. Clean, but a senior lawyer might have preferred to recast the entire preamble in mutual terms. Acceptable.

### 2. Purpose (Clause 1) — bilateral disclosure intent

**Intent served**: the Purpose now contemplates disclosure flowing both ways.

**Before**:
> Party A wishes to disclose to Party B certain confidential and proprietary information in connection with the parties' evaluation of a potential commercial relationship relating to Party A's industrial process control software (the "Purpose"). Party B agrees to receive such information subject to the obligations set out in this Agreement.

**After**:
> Party A wishes to disclose to Party B, and Party B wishes to disclose to Party A, certain confidential and proprietary information in connection with the parties' evaluation of a potential commercial relationship relating to Party A's industrial process control software (the "Purpose").

**Comment**: The Subject-matter "Party A's industrial process control software" remains — appropriate, since Party A's specific subject of disclosure is still defined; Party B's might be unstated and is inferred from the bilateral framing. Senior lawyer might soften "Party A's industrial process control software" to a more generic subject — minor stylistic gap.

### 3. Confidential Information definition (Clause 2) — symmetric source

**Intent served**: Confidential Information is no longer tied to disclosures from Party A only.

**Before** (excerpt):
> "Confidential Information" means any non-public information disclosed by Party A to Party B [...] Confidential Information includes, without limitation, Party A's business plans [...]

**After**:
> "Confidential Information" means any non-public information disclosed by **either** Party to the other [...] Confidential Information includes, without limitation, the **disclosing Party's** business plans [...]

**Comment**: Note the lowercase 'disclosing'. A senior lawyer would capitalize "Disclosing Party" as a defined term throughout; the agent's lowercase rendering reads as descriptive rather than defined. Stylistic gap, not legally consequential.

### 4. Obligations of the Receiving Party (Clause 3) — symmetric protection

**Intent served**: whichever Party is in the role of Receiving Party owes the obligations to the other.

**Before**:
> Party B shall: (a) hold Party A's Confidential Information in strict confidence [...]

**After**:
> The Receiving Party shall: (a) hold **the other Party's** Confidential Information in strict confidence [...]

**Comment**: Properly mirrored. "The Receiving Party" capitalization here matches the original Clause 3 heading.

### 5. Exclusions (Clause 4) — symmetric carve-outs

**Intent served**: exclusions apply whichever Party is in the Receiving role.

**Before**:
> The obligations in clause 3 do not apply to information that Party B can demonstrate [...]

**After**:
> The obligations in clause 3 do not apply to information that the Receiving Party can demonstrate [...]

**Comment**: Correct.

### 6. Compelled Disclosure (Clause 5) — symmetric notice obligation

**Intent served**: either Party, when compelled, must give the other prompt notice and cooperate.

**Before**:
> If Party B is compelled by law [...]

**After**:
> If the Receiving Party is compelled by law [...]

**Comment**: Correct.

### 7. Return or Destruction (Clause 6) — symmetric return obligation

**Intent served**: the Disclosing Party of any disclosure may request return; the Receiving Party of that disclosure must comply.

**Before**:
> Upon Party A's written request, or upon termination of discussions between the Parties, Party B shall promptly return to Party A or destroy [...]

**After**:
> Upon **either Party's** written request, or upon termination of discussions between the Parties, the Receiving Party shall promptly return to **the disclosing Party** or destroy [...]

**Comment**: Correct.

### 8. Remedies (Clause 9) — symmetric injunctive relief

**Intent served**: either Party, when the non-breaching Party, may seek injunctive relief.

**Before**:
> Party B acknowledges that a breach of this Agreement by Party B would cause Party A irreparable harm [...] and accordingly Party A shall be entitled to seek injunctive relief and specific performance [...]

**After**:
> **Each Party acknowledges that a breach of this Agreement by the other Party would cause the non-breaching Party irreparable harm [...] and accordingly the non-breaching Party shall be entitled to seek injunctive relief and specific performance [...]**

**Comment**: Correct and clean. The whole-paragraph rewrite triggered a `w:ins` without a paired `w:del` (engine behaviour noted above).

## Clauses the agent did NOT modify

| Clause | Why not modified | Agent's behaviour |
|---|---|---|
| Clause 7 (Term) | Already used "either Party" symmetrically | Agent listed it in the plan but correctly skipped it in the batch — already symmetric. |
| Clause 8 (No Licence; No Warranty) | Still refers to "Party A's Confidential Information" asymmetrically | **Agent surfaced this in its coherence-check reply** — "One coherence concern: Clause 8 still refers to 'Party A's Confidential Information' — asymmetrically. Should this also be mutual?" This is the kind of judgment call a senior lawyer reviewer would flag. |
| Clause 10 (Governing Law) | Already symmetric | Not in plan, not in batch. Correct. |
| Clause 11 (Miscellaneous) | Already uses "both Parties" | Not in plan, not in batch. Correct. |

## Summary

The agent produced a competent, internally consistent, lawyer-recognisable redline. All edits are correctly mirrored. The single asymmetry the agent did not auto-fix (Clause 8) was **explicitly surfaced** as a coherence concern with a question for the lawyer — exactly the behaviour the ADR-020 system-prompt doctrine prescribes.

OOXML markup is real Track Changes (`w:ins` / `w:del`), so the output is a redline ready for Word / LibreOffice review-and-accept workflow, not a silent rewrite.
