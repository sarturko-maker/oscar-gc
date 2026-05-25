## On-demand playbooks

These playbooks live in `~/.config/oscar/playbooks/`. They are NOT auto-injected;
load any that apply to the question via `oscar-fs__read_file` (text formats) or
computercontroller's `pdf_tool` / `docx_tool` (binary formats). Filenames are the
load-bearing signal — pick by purpose.

- `_global/nda-redline-playbook.md` (global, 60 B) — NDA redline playbook
- `commercial/msa-checklist.md` (this area, 54 B) — MSA negotiation checklist