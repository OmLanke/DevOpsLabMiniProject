// Report-only tooling; the application does not depend on this package.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, TabStopType,
  LeaderType, Bookmark, InternalHyperlink, HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom, TextWrappingType,
} = require('docx');

const root = path.resolve(__dirname, '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'report-content.json')));
const pageMapPath = path.join(root, 'page-map.json');
const pages = fs.existsSync(pageMapPath) ? JSON.parse(fs.readFileSync(pageMapPath)) : {};
const WIDTH = 9026;
const figures = content.chapters.flatMap(c => c.blocks.filter(b => b.type === 'figure'));
const tables = content.chapters.flatMap(c => c.blocks.filter(b => b.type === 'table'));
const headings = content.chapters.flatMap(c => [c.title, ...c.blocks.filter(b => b.type === 'heading').map(b => b.text)]);
const anchors = new Map([...headings, ...figures.map(f => f.caption), ...tables.map(t => t.caption), 'References']
  .map((label, i) => [label, `report_${i}`]));

assert.equal(content.metadata.authors[0].student_id, '16010123216');
assert.equal(content.metadata.authors[1].student_id, '16010123294');
assert.equal(figures.length, 9);
assert.equal(new Set(figures.map(f => f.caption)).size, figures.length);
assert.equal(new Set(tables.map(t => t.caption)).size, tables.length);

function para(text, options = {}) {
  return new Paragraph({ keepLines: true, children: [new TextRun(text)], ...options });
}
function heading(text, level = 1, pageBreakBefore = false) {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    pageBreakBefore,
    children: [new Bookmark({ id: anchors.get(text), children: [new TextRun(text)] })],
  });
}
function caption(text, keepNext = false) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, keepNext,
    spacing: { before: 120, after: 140, line: 260 },
    children: [new Bookmark({ id: anchors.get(text), children: [new TextRun({ text, size: 22, italics: true })] })],
  });
}
function png(name, width, extra = {}) {
  const data = fs.readFileSync(path.join(root, name));
  assert.equal(data.subarray(1, 4).toString(), 'PNG');
  const height = width * data.readUInt32BE(20) / data.readUInt32BE(16);
  return new ImageRun({ type: 'png', data, transformation: { width, height },
    altText: { name, title: name, description: name }, ...extra });
}
function anchoredImage(name, width, height, xIn, yIn) {
  return png(name, width, {
    transformation: { width, height },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(xIn * 914400) },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(yIn * 914400) },
      wrap: { type: TextWrappingType.NONE }, behindDocument: true,
      allowOverlap: true, layoutInCell: false,
    },
  });
}
function header() {
  return new Header({ children: [new Paragraph({ spacing: { line: 20 }, children: [
    anchoredImage('assets/somaiya-logo.png', 219, 64, 0.36, 0.14),
    anchoredImage('assets/somaiya-trust.png', 94, 72, 7.15, 0.14),
    anchoredImage('assets/cover-accent.png', 52, 1018, 0, 1.1),
  ] })] });
}
function indexEntry(label, isSub = false) {
  assert(anchors.has(label), `Missing bookmark: ${label}`);
  return new Paragraph({
    indent: { left: isSub ? 200 : 0 },
    spacing: { after: 55, line: 260 },
    tabStops: [{ type: TabStopType.RIGHT, position: WIDTH, leader: LeaderType.DOT }],
    children: [new InternalHyperlink({ anchor: anchors.get(label), children: [
      new TextRun({ text: label, size: 22, bold: !isSub && /^\d+\./.test(label), color: '000000' }),
    ] }), new TextRun({ text: `\t${pages[label] || '—'}`, size: 22 })],
  });
}
function grid(block) {
  const widths = block.widths || block.columns.map((_, i) => i === 0 ? 2800 : Math.floor((WIDTH - 2800) / (block.columns.length - 1)));
  assert.equal(widths.reduce((a, b) => a + b, 0), WIDTH);
  const border = { style: BorderStyle.SINGLE, size: 4, color: '777777' };
  return new Table({ width: { size: WIDTH, type: WidthType.DXA }, columnWidths: widths,
    rows: [block.columns, ...block.rows].map((row, index) => {
      assert.equal(row.length, widths.length);
      return new TableRow({ cantSplit: true, tableHeader: index === 0,
        children: row.map((text, i) => new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          borders: { top: border, bottom: border, left: border, right: border },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 90, bottom: 90, left: 110, right: 110 },
          shading: { fill: index === 0 ? 'EEEEEE' : 'FFFFFF', type: ShadingType.CLEAR },
          children: [new Paragraph({ spacing: { after: 0, line: 265 },
            children: [new TextRun({ text, size: 22, bold: index === 0 })] })],
        })),
      });
    }),
  });
}

const body = [];
const center = (text, size = 24, options = {}) => new Paragraph({ alignment: AlignmentType.CENTER,
  spacing: { after: 80, line: 280 }, children: [new TextRun({ text, size, ...options })] });
body.push(para('', { spacing: { before: 1800, after: 0 } }),
  center('DATABASE BACKUP', 44, { bold: true }),
  center('AND DISASTER RECOVERY', 44, { bold: true }),
  center('Versioned PostgreSQL Backups for a Dockerized', 30),
  center('Notes Application with Automated DevOps Workflows', 30),
  para('', { spacing: { before: 240, after: 0 } }),
  center('Detailed Project Report', 28, { italics: true }),
  para('', { spacing: { before: 420, after: 0 } }),
  center('Submitted by', 24, { italics: true }),
  ...content.metadata.authors.map(a => center(`${a.name} — ${a.student_id}`, 30, { bold: true })),
  center(content.metadata.programme, 24), center(content.metadata.institution, 24),
  para('', { spacing: { before: 260, after: 0 } }),
  center(content.metadata.course, 24), center(content.metadata.date, 24),
  para('', { spacing: { before: 220, after: 0 } }),
  center(`Project repository: ${content.metadata.repository}`, 22));

function frontTitle(text) {
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true,
    alignment: AlignmentType.CENTER, children: [new TextRun(text)] }));
}
frontTitle('Abstract');
body.push(...content.abstract.map(text => para(text)),
  new Paragraph({ children: [new TextRun({ text: 'Keywords: ', bold: true }), new TextRun(content.keywords)] }));
frontTitle('Table of contents');
for (const chapter of content.chapters) {
  if (chapter.title.startsWith('6.')) body.push(new Paragraph({
    heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER,
    children: [new TextRun('Table of contents (continued)')],
  }));
  body.push(indexEntry(chapter.title));
  body.push(...chapter.blocks.filter(b => b.type === 'heading').map(b => indexEntry(b.text, true)));
}
body.push(indexEntry('References'));
frontTitle('List of figures');
body.push(...figures.map(f => indexEntry(f.caption)));
frontTitle('List of tables');
body.push(...tables.map(t => indexEntry(t.caption)));

for (const chapter of content.chapters) {
  body.push(heading(chapter.title, 1, true));
  for (const block of chapter.blocks) {
    switch (block.type) {
      case 'heading': body.push(heading(block.text, 2)); break;
      case 'paragraph': body.push(para(block.text)); break;
      case 'list': body.push(...block.items.map(text => para(text, { numbering: { reference: 'bullets', level: 0 }, spacing: { line: 300, after: 60 } }))); break;
      case 'code': body.push(...block.lines.map((text, i) => new Paragraph({ keepNext: i < block.lines.length - 1,
        shading: { fill: 'F5F5F5', type: ShadingType.CLEAR }, spacing: { line: 230, after: 0, before: i === 0 ? 80 : 0 },
        children: [new TextRun({ text, font: 'Courier New', size: 18 })] })), para('', { spacing: { after: 30, line: 40 } })); break;
      case 'figure': body.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true,
        spacing: { before: 120, after: 0 }, children: [png(`diagrams/${block.file}.png`, block.width || 570)] }), caption(block.caption)); break;
      case 'table': body.push(caption(block.caption, true), grid(block), para('', { spacing: { after: 40, line: 40 } })); break;
      default: throw new Error(`Unknown report block: ${block.type}`);
    }
  }
}
body.push(heading('References', 1, true), ...content.references.map(text => para(text, {
  alignment: AlignmentType.LEFT, spacing: { after: 160, line: 300 },
})));

const doc = new Document({
  creator: 'Om Lanke and Saish Korgaonkar', title: content.metadata.title,
  subject: 'DevOps Mini Project', description: 'Verified local PostgreSQL backup and recovery lab.',
  styles: {
    default: { document: {
      run: { font: 'Times New Roman', size: 24, color: '000000' },
      paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 320 }, widowControl: true },
    } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Times New Roman', size: 32, bold: true, color: '000000' },
        paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 240, after: 240, line: 300 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Times New Roman', size: 26, bold: true, color: '000000' },
        paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 280, after: 120, line: 280 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET,
    text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 220 } } } }] }] },
  sections: [{ properties: {
    titlePage: true,
    page: { size: { width: 11906, height: 16838 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 288, footer: 288 } },
  }, headers: { default: header(), first: header() },
  footers: {
    default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }),
    first: new Footer({ children: [para('')] }),
  }, children: body }],
});
Packer.toBuffer(doc).then(buffer => {
  const output = path.join(root, 'DevOps_Mini_Project_Report.docx');
  fs.writeFileSync(output, buffer);
  console.log(`Created ${output} (${figures.length} figures, ${tables.length} tables)`);
});
