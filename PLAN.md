# Completion plan

## Goal

Finish the existing local DevOps backup/recovery lab, prove its recovery path, and produce an understandable student report matching the supplied sample. Authors: Om Lanke (16010123216) and Saish Korgaonkar (16010123294).

## Findings before implementation

- Core API, backup worker, versioned storage, validated transactional restore, wrappers, tests, and workflows already exist. Reuse these.
- Initial API tests: 4 passed. Initial Python tests: 8 passed.
- The API lockfile contains four dependency advisories; compatible updates are available.
- The configured MinIO Docker Hub image cannot be pulled. Official alternate image/archive endpoints were also unavailable. Build the same pinned upstream release from verified source instead.
- The recovery demo clears the schema but reuses the original PostgreSQL volume. Strengthen it to demonstrate actual loss of its isolated database volume, with ownership checks before deletion.
- The report is missing. The sample uses A4, Times New Roman, numbered chapters, simple tables, and grayscale diagrams.

## Execution order and acceptance

1. Update vulnerable locked API dependencies without changing the API contract; rerun tests and audit.
2. Build MinIO from checksum-pinned upstream source; retain its S3 interface, console, volume, and health check. Validate Compose and build the complete stack.
3. Exercise recovery in a separate Compose project. Prove two unique backups, complete object pairs, bucket versioning, checksum correctness, and exact restoration after deleting only that project's database volume. Confirm cleanup.
4. Retain local verification evidence and make recovery logs downloadable from CI and scheduled runs.
5. Produce an editable DOCX and rendered PDF with the sample's layout, nine diagrams, both authors, progressively explained concepts, actual results, and candid limits. Keep the original sample untouched.
6. Validate the DOCX, inspect rendered pages, update run/report instructions, and leave the normal stack ready for a lab demonstration.

## Boundaries

No production deployment, authentication system, paid cloud service, WAL replication, retention service, or invented faculty/test claims. Do not publish, push, or delete normal-stack data. The same-host backup limitation must be explicit.

All six steps are complete. The runtime is running, all 17 unit tests pass, the isolated database-volume recovery passes, and the 28-page DOCX/PDF report is validated. Completion details and measured results are recorded in `report/evidence/verification.md`.
