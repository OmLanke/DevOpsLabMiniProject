# Completion and verification

Verified locally on **14 October 2026**, using **Node.js 24.21.0**, **Docker 29.4.0**, **Compose 5.1.2**, and OrbStack on an Apple Silicon Mac.

## Completed work

- Preserved the existing Notes API and backup/restore architecture.
- Updated the API lockfile within its existing dependency ranges, resolving the four initially reported advisories.
- Replaced the unavailable MinIO public image with a locally built, checksum-verified copy of the same upstream release.
- Strengthened the disaster demonstration to delete only its owner-checked isolated PostgreSQL volume, retain MinIO backups, and verify the recreated database is empty.
- Fixed rediscovery of the API's ephemeral host port after restart.
- Increased the backup image's pip download timeout after a slow PyPI transfer failed, then rebuilt the image and verified its scheduled worker.
- Added focused backup failure-path tests and GitHub Actions recovery log artifacts.
- Created the project report with both authors, ten chapters, nine diagrams and twelve tables. Supplied editable DOCX, PDF, report sources and rebuild instructions.

## Focused checks

| Check | Result | Evidence |
| --- | --- | --- |
| JavaScript syntax | Passed | [checks.log](checks.log) |
| API behaviour | 4 tests passed | [checks.log](checks.log) |
| Backup/restore and wrapper safety | 13 tests passed | [checks.log](checks.log) |
| API dependency audit | Zero reported advisories | [checks.log](checks.log) |
| Compose configuration | Passed | [checks.json](checks.json) |
| Shell script syntax | Passed | [checks.json](checks.json) |
| All project Docker images | Built successfully | [recovery-run.log](recovery-run.log) |
| Actual isolated database-volume loss and recovery | Passed | [recovery-run.log](recovery-run.log) |
| Temporary recovery resources | Removed on successful exit | Local Docker resource check |
| Normal-stack API and MinIO console | Healthy; HTTP 200 | [local-smoke.log](local-smoke.log) |
| Normal-stack backup/list wrappers | Passed | [local-smoke.log](local-smoke.log) |
| Updated backup image and scheduled worker | Rebuilt; initial dump uploaded | [backup-build.log](backup-build.log) |
| DOCX XML/schema validation | Passed | Office document validator |
| SVG generation and PNG dimension checks | Nine diagrams passed | Diagram builder assertions |
| PDF layout and page references | Inspected and indexed | [page-map.json](../page-map.json) |

The final report is 28 pages. All 70 contents/figure/table references were compared with their actual PDF page locations and with the DOCX hyperlinks. The PDF uses Times New Roman and Courier fonts; visible text fits the page margins. The reference result is saved in [report-validation.json](report-validation.json).

The normal local stack remains running at <http://localhost:3000/health> and <http://localhost:9001>. An initial repeated backup-image build encountered a slow PyPI download, so startup temporarily reused the already tested image. Increasing pip's download timeout to 120 seconds allowed a fresh build to succeed. Only the backup worker was refreshed afterward, and its first scheduled archive was uploaded successfully. All volumes were preserved.

## Actual recovery outcome

The exercise saved two records, created two uniquely named manual backups, checked complete listings, enabled bucket versioning, and verified the chosen object's manifest, size and SHA-256. It changed/deleted notes and added a post-backup note, stopped writers, deleted the isolated PostgreSQL volume, and confirmed zero public application tables in the fresh database. It then restored the selected archive and compared the whole API response with the saved snapshot.

| ID | Title | Content | Original and recovered timestamps |
| --- | --- | --- | --- |
| 1 | Recover me | original-one | 2026-10-14T05:49:36.660Z |
| 2 | Also recover me | original-two | 2026-10-14T05:49:36.668Z |

Both `created_at` and `updated_at` matched those timestamps. The final assertion confirmed equality of all returned fields; the changed and post-backup state was replaced by the selected snapshot.

Selected key:

```text
backups/2026-10-14/20261014T054937Z-542fb81ff9024e768cc0162596452a3d.dump
```

The actual manifest and byte count are recorded in the recovery log and shown in the report. No resources whose names begin with the generated `notes-dr-` prefix remained after the exercise. Unrelated Docker volumes were retained.

## Verification boundaries

Remote GitHub Actions jobs were not launched; the workflow definitions and their local commands were checked. The repository was not pushed or published. Container vulnerability scans, production deployment, host-loss recovery and large-database performance were not tested. The Node audit covers the API dependency tree only. MinIO retains the lab's pinned upstream release, and PostgreSQL and backup storage still share one host.

The institution, programme and visual branding follow the supplied report sample. No faculty, approval, signature or individual contribution claims were invented.
