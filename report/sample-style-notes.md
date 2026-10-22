# Sample report inventory and style notes

Reference: `report/Sample_Devops_Mini_Project_Report.docx`. The sample at the requested `Sample report/` path does not exist; the actual file is in `report/`. Original remains untouched. Its 12 embedded PNGs were extracted to `/tmp/devops-report-reference/` for visual inspection.

## Cover and metadata pattern

The cover uses a centered project/brand name, descriptive subtitle, “Detailed Project Report”, “Submitted by”, two author lines with student IDs, programme and institution, course name, month/year, and repository identifier. For the new report, use the supplied authors and IDs, DevOps Mini Project, B.Tech Computer Engineering, Final Year, K.J. Somaiya School of Engineering, Mumbai, and October 2026. Do not invent a guide/faculty name, approval, signature, or work split. Use the project directory name as repository metadata; no public URL is established by the repository.

## Exact heading inventory in the sample

The DOCX paragraph styles mark these headings:

- Abstract
- Table of contents
- List of figures
- List of tables
- 1. Introduction
  - 1.1 Background
  - 1.2 Problem statement
  - 1.3 Objectives
  - 1.4 Scope
- 2. Background and related concepts
  - 2.1 DevSecOps and shift-left security
  - 2.2 Static application security testing
  - 2.3 Container vulnerability scanning
  - 2.4 LLM-assisted remediation
  - 2.5 Human-in-the-loop control
- 3. Technology stack
  - 3.1 Components
  - 3.2 Python dependencies
- 4. System architecture
  - 4.1 Pipeline architecture
  - 4.2 Job dependencies
  - 4.3 Trigger conditions
  - 4.4 Repository structure
- 5. Application design
  - 5.1 Features
  - 5.2 Endpoints
  - 5.3 Data model
  - 5.4 Note lifecycle
- 6. DevSecOps CI/CD pipeline
  - 6.1 Stage 1: code quality and secret scan
  - 6.2 Stage 2: container build and vulnerability scan
  - 6.3 Stage 3: registry delivery
  - 6.4 Gate behaviour
- 7. Containerisation and demonstration profiles
  - 7.1 Dockerfile
  - 7.2 Demonstration profiles
  - 7.3 Reset tooling
- 8. Environment configuration
- 9. End-to-end workflow
- 10. Conclusion and future work
  - 10.1 Conclusion
  - 10.2 Future work
- References

## Page and text styles

- Paper: A4 portrait, 11,906 × 16,838 DXA.
- Margins: top 1,080 DXA (0.75 in); right, bottom, and left 1,440 DXA (1 in). Header and footer offsets: 288 DXA (0.2 in).
- Default body font: Times New Roman, 12 pt (24 half-points); language en-US.
- Heading 1: black, bold, 16 pt (32 half-points), 12 pt before and after, outline level 0. Main chapters begin on a new page.
- Heading 2: black, bold, 13 pt (26 half-points), 14 pt before and 6 pt after, outline level 1.
- Heading 3: black, bold italic, outline level 2. Body paragraphs are mostly justified. Numbered and bulleted items use Word list paragraph styles, not hand-inserted bullet glyphs.
- The cover has centered title lines. Abstract, Table of contents, List of figures, and List of tables each begin as front matter. Figure captions and table captions use explicit numbered labels. The sample has running headers/footers with first-page variants and page numbering.
- The sample has 10 numbered chapters, followed by References, with a numbered two-level contents list. Reproduce the hierarchy and formal tone; generate page numbers and contents against the final document layout instead of carrying over the sample's stale values.

## Tables and diagrams

The sample uses plain grid tables with header rows and concise cell text. Tables have 2–5 columns and are sized to the text area. Its diagrams are embedded raster graphics with a restrained grayscale palette, thin gray outlines, pale gray fills, black sans-serif labels, and simple directional arrows. They use grouped rectangular boxes to show system layers and flows; database/storage may use a cylinder. Captions are centered below each diagram. The extracted images are available at `/tmp/devops-report-reference/image1.png` through `image12.png`.

## Project grounding and reporting limits

README and source describe a Node.js 24 / Express 5 notes API, PostgreSQL 17, a Python/boto3 worker using `pg_dump` custom format, MinIO object storage with versioning, checksum-bearing manifests, a Python restore CLI, Compose services and volumes, shell wrappers, unit tests, an isolated recovery demonstration, and GitHub Actions CI plus a scheduled disposable demonstration. The repository defines automated checks but source inspection alone does not establish that they passed. The draft therefore describes coverage and intended checks without asserting execution results. The README explicitly limits the lab: MinIO shares the host with PostgreSQL; there is no WAL point-in-time recovery, off-host copy, encryption/signing, role/global-object backup, retention policy, or production auth.
