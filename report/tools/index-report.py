#!/usr/bin/env python3
"""Record real PDF page numbers for the report's linked contents and lists."""
import json
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'report-content.json').read_text())
labels = ['References']
for chapter in source['chapters']:
    labels.append(chapter['title'])
    for block in chapter['blocks']:
        if block['type'] == 'heading':
            labels.append(block['text'])
        elif block['type'] in ('figure', 'table'):
            labels.append(block['caption'])

pages = {}
body_started = False
with pymupdf.open(ROOT / 'DevOps_Mini_Project_Report.pdf') as pdf:
    for number, page in enumerate(pdf, 1):
        lines = [' '.join(line.split()) for line in page.get_text().splitlines()]
        # Body starts after front matter; repeated TOC/caption-list entries are excluded.
        if '1. Introduction' in lines:
            if number < 5:
                continue
            body_started = True
        if number < 5 or not body_started:
            continue
        for label in labels:
            if label in lines:
                pages.setdefault(label, number)
    assert len(pages) == len(labels), f'Missing labels: {set(labels) - pages.keys()}'
    assert pages['1. Introduction'] < pages['References']
    assert len(pdf) == pages['References'], 'Unexpected page(s) after references'

(ROOT / 'page-map.json').write_text(json.dumps(pages, ensure_ascii=False, indent=2) + '\n')
print(f'Indexed {len(pages)} headings and captions across {pages["References"]} pages.')
