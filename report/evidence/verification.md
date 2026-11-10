# Verified application and recovery report

Verified locally on **11 November 2026 (India time)**. The browser-run assertions were recorded at `2026-11-10T20:05:46.955Z` (UTC).

## Current deliverables

The report contains **36 pages, 17 figures (nine diagrams and eight screenshots), 12 tables and 79 indexed headings/captions**. The DOCX passed schema validation. Every rendered page was visually reviewed; the final page references match the PDF. Artifact and screenshot hashes are recorded in [report-validation.json](report-validation.json).

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| JavaScript syntax and static serving/API tests | Passed; 5 tests | [checks-2026-11-11.log](checks-2026-11-11.log) |
| Backup/restore and wrapper safety | 13 tests passed | Same checks log |
| Node production dependency audit | Zero reported advisories | Same checks log |
| Compose configuration | Passed | Same checks log |
| Existing scripts/demo.sh recovery exercise | Exact original records recovered after isolated volume deletion | [recovery-run-2026-11-11.log](recovery-run-2026-11-11.log) |
| Folio browser recovery exercise | Exact original records recovered; no browser exceptions | [ui-recovery-summary.json](ui-recovery-summary.json) and [ui-recovery.log](ui-recovery.log) |
| Temporary containers and volumes | Removed after both demonstrations | Each recovery log |

## Browser demonstration

Two notes were created and saved through Folio: **Database recovery lab** and **Presentation checklist**. Search and the mobile editor were captured. Two different manual backup keys were created and listed; bucket versioning, dump size and SHA-256 were verified. One note was edited, the second deleted, and a new post-backup note added. The changed state still had two notes, demonstrating why count-only checks are insufficient.

The app and worker were stopped, the PostgreSQL volume's Compose ownership was checked, and only that isolated database volume was deleted. The new database had **zero public tables**. Starting Folio created an empty notes table, allowing the empty notebook to be captured. The app was stopped again before restoring the verified archive. After restart, both original notes returned and the post-backup note disappeared. All returned fields matched the recorded snapshot exactly, including IDs and creation/update timestamps.

Selected key: `backups/2026-11-10/20261110T200522Z-e393761ff0934ec59f8d21efc64345c1.dump`

Archive size: **3,181 bytes**. SHA-256: `28dd431031d8bced14ced9589848dc93789cbb5aed134a835b3d229c5fbfb05d`.

The observed restore/startup interval was 7.58 seconds for this dataset; this is not a production RTO guarantee. Full records are retained in [ui-before.json](ui-before.json) and [ui-after.json](ui-after.json).

## Screenshot provenance

Eight PNGs in `report/screenshots/` are embedded in the report. Seven are genuine captures of Folio during the live demonstration. The eighth is a clearly labelled, formatted HTML summary of actual recorded assertions and archive metadata; it is not an operating-system terminal screenshot. Its source is [recovery-verification.html](recovery-verification.html), backed by the full command log.

All data-loss operations used generated Compose projects. The normal local stack's database and backup volumes were retained. The older October logs remain as historical evidence and do not supply the current report's recovery figures.

## Verification boundaries

Remote GitHub Actions, host-loss recovery, production hardening, container vulnerability scanning and large-database performance were not tested. The dependency audit covers Node packages. PostgreSQL and MinIO still share one physical host. The institution branding and author details follow the existing report; no faculty approvals or signatures were invented.
