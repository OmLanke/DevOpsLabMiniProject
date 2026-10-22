# Project report

**Om Lanke — 16010123216**  
**Saish Korgaonkar — 16010123294**

Open `DevOps_Mini_Project_Report.docx` for editing or `DevOps_Mini_Project_Report.pdf` for printing/submission. The sample report is unchanged.

The report contains ten chapters, nine project-specific diagrams and twelve tables. It starts with the everyday problem of lost notes, introduces backup concepts, then explains the architecture, implementation, workflows, recovery experiment and limitations. The results come from the captured local runs in `evidence/`, rather than from an assumed CI result.

## Sources

- `report-content.json`: editable prose, tables, captions and metadata.
- `tools/build-report.cjs`: DOCX generator with links, page fields, headers and bookmarks.
- `tools/build-diagrams.py`: deterministic grayscale SVG/PNG diagram generator.
- `diagrams/`: all nine diagrams in editable SVG and embedded PNG formats.
- `assets/`: institution logos and sidebar extracted from the supplied sample for this academic report.
- `page-map.json`: page numbers measured from the final PDF for the contents and figure/table lists.
- `evidence/verification.md`: checks, actual recovery records and scope of verification.

Times New Roman, numbered headings, plain tables, captions and the institution header match the sample. A slightly larger top margin keeps continued text clear of the logos. Institution and programme wording follow the supplied sample; no faculty names, signatures, approvals or individual work allocation have been invented.

## Rebuild the DOCX

From this directory, with Node.js and npm installed:

```sh
npm ci
npm run build
```

The report dependencies are separate from the application. Rebuilding the diagrams is optional; the SVGs and PNGs are already included. It requires Python 3 and `rsvg-convert` from librsvg:

```sh
npm run diagrams
```

## Refresh the PDF and page references after editing

Export the DOCX to PDF in Word or with an installed LibreOffice executable:

```sh
soffice --headless --convert-to pdf --outdir . DevOps_Mini_Project_Report.docx
```

To update the linked contents and caption-list page numbers, use Python in a virtual environment:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python tools/index-report.py
npm run build
soffice --headless --convert-to pdf --outdir . DevOps_Mini_Project_Report.docx
.venv/bin/python tools/index-report.py
```

If edits change pagination, repeat the final build/export after indexing until page numbers agree. The supplied DOCX and PDF have already been checked together. Check layout in the intended editor before submission because Word and LibreOffice can paginate differently.

## Evidence and boundaries

`checks.log` and `checks.json` record the syntax, API, dependency, Python and Compose checks. `recovery-run.log` records the isolated exercise, actual manifest and identical before/after records. `local-startup.log` records startup, including the initial slow dependency-download failure; `backup-build.log` records the successful build after the timeout adjustment. `local-smoke.log` and `local-status.jsonl` confirm the normal stack and backup/list commands.

The API audit covers Node dependencies, not every container package. Remote Actions runs, host-loss recovery, production hardening and large-database performance were not claimed. Keep `.env` private and keep the normal MinIO volume when testing a restore.
