#!/usr/bin/env python3
"""Build report figures as deterministic, dependency-free SVGs."""
from html import escape
from pathlib import Path
import shutil
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "report" / "diagrams"
ASSETS = ROOT / "report" / "assets"
RSVG_CONVERT = shutil.which("rsvg-convert")
BG = "#ffffff"
FILL = "#f2f2f2"
STROKE = "#777777"
INK = "#111111"

class SVG:
    def __init__(self, width=900, height=600, title=""):
        self.w, self.h, self.items, self.title = width, height, [], title
    def rect(self, x, y, w, h, label=None, *, fill=FILL, stroke=STROKE, rx=5, size=21, bold=False):
        self.items.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
        if label:
            lines = label.split("\n")
            line_h = size * 1.28
            start = y + h / 2 - (len(lines)-1)*line_h/2 + size*.34
            self.text(x+w/2, start, lines, size=size, bold=bold)
    def text(self, x, y, lines, *, size=20, bold=False, anchor="middle", color=INK, family="Arial, sans-serif"):
        if isinstance(lines, str): lines = [lines]
        spans = ''.join(f'<tspan x="{x}" dy="{0 if i == 0 else size*1.25}">{escape(line)}</tspan>' for i, line in enumerate(lines))
        weight = ' font-weight="700"' if bold else ''
        self.items.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{family}" font-size="{size}" fill="{color}"{weight}>{spans}</text>')
    def line(self, x1, y1, x2, y2, *, arrow=True, color=STROKE, width=2, dash=None):
        marker = ' marker-end="url(#arrow)"' if arrow else ''
        dashes = f' stroke-dasharray="{dash}"' if dash else ''
        self.items.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"{marker}{dashes}/>')
    def path(self, d, *, arrow=True, color=STROKE, width=2, dash=None):
        marker = ' marker-end="url(#arrow)"' if arrow else ''
        dashes = f' stroke-dasharray="{dash}"' if dash else ''
        self.items.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}"{marker}{dashes}/>')
    def diamond(self, cx, cy, w, h, label, *, size=19):
        pts=f'{cx},{cy-h/2} {cx+w/2},{cy} {cx},{cy+h/2} {cx-w/2},{cy}'
        self.items.append(f'<polygon points="{pts}" fill="{FILL}" stroke="{STROKE}" stroke-width="2"/>')
        lines=label.split('\n'); step=size*1.2; y=cy-(len(lines)-1)*step/2+size*.33
        self.text(cx,y,lines,size=size)
    def cylinder(self, x, y, w, h, label, *, size=20):
        ry=15
        self.items.append(f'<path d="M{x},{y+ry} C{x},{y} {x+w},{y} {x+w},{y+ry} L{x+w},{y+h-ry} C{x+w},{y+h} {x},{y+h} {x},{y+h-ry} Z" fill="{FILL}" stroke="{STROKE}" stroke-width="2"/>')
        self.items.append(f'<path d="M{x},{y+ry} C{x},{y+2*ry} {x+w},{y+2*ry} {x+w},{y+ry}" fill="none" stroke="{STROKE}" stroke-width="2"/>')
        self.text(x+w/2,y+h/2+size*.35,label.split('\n'),size=size)
    def boundary(self,x,y,w,h,label):
        self.items.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="none" stroke="#aaaaaa" stroke-width="2" stroke-dasharray="7 5"/>')
        self.text(x+14,y+23,label,size=16,bold=True,anchor="start",color="#555555")
    def finish(self):
        desc=escape(self.title)
        svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="title desc">
<title id="title">{desc}</title><desc id="desc">{desc}</desc>
<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,4 L0,8 z" fill="{STROKE}"/></marker></defs>
<rect width="100%" height="100%" fill="{BG}"/>{''.join(self.items)}</svg>'''
        return svg

def make_stack():
    s=SVG(900,500,"Technology stack")
    s.text(450,50,"Technology stack",size=29,bold=True)
    cards=[(35,"Application","Node.js 24\nExpress 5 + pg"),(212,"Database","PostgreSQL 17\nnotes database"),(389,"Backup","Python + boto3\npg_dump / pg_restore"),(566,"Object storage","MinIO\nS3-compatible API"),(743,"Automation","Docker Compose\nGitHub Actions")]
    for x,title,body in cards:
        s.rect(x,145,150,190,fill="#ffffff")
        s.rect(x,145,150,47,title,fill=FILL,size=20,bold=True)
        s.text(x+75,235,body.split('\n'),size=18)
    s.text(450,405,"Local services use health checks and persistent Docker volumes.",size=19,color="#444444")
    s.text(450,441,"CI runs unit checks, image builds, and a disposable recovery exercise.",size=19,color="#444444")
    return s.finish()

def make_architecture():
    s=SVG(900,620,"High-level system architecture")
    s.text(450,40,"High-level system architecture",size=28,bold=True)
    s.boundary(22,65,230,220,"LOCAL HOST BOUNDARY")
    s.rect(48,115,170,58,"Client\nlocalhost",size=18)
    s.rect(48,205,170,58,"Express Notes API\n127.0.0.1:3000",size=18)
    s.line(133,173,133,205); s.text(151,193,"HTTP",size=15,anchor="start")
    s.rect(315,110,185,78,"PostgreSQL 17\nnotes",size=20)
    s.rect(315,260,185,78,"Backup worker\npg_dump + manifest",size=20)
    s.cylinder(625,105,205,90,"postgres_data\nvolume",size=18)
    s.cylinder(625,390,205,90,"minio_data\nvolume",size=18)
    s.cylinder(625,250,205,95,"MinIO\nversioned bucket",size=20)
    s.rect(315,420,185,76,"Restore CLI\nverify + pg_restore",size=19)
    s.line(218,234,315,149); s.text(255,184,"SQL",size=15)
    s.line(407,188,407,260); s.text(424,230,"logical dump",size=15,anchor="start")
    s.line(500,299,625,295); s.text(561,281,"dump + JSON",size=15)
    s.line(727,345,727,390)
    s.path("M625,298 L570,298 L570,458 L500,458"); s.text(565,440,"selected backup",size=15)
    s.path("M315,458 L278,458 L278,149 L315,149"); s.text(259,385,"restore",size=15,anchor="start")
    s.path("M500,149 L560,149 L560,150 L625,150",arrow=False)
    s.text(450,555,"Separate volumes preserve database files and backup objects across container recreation.",size=18,color="#444444")
    return s.finish()

def make_startup():
    s=SVG(900,550,"Compose startup dependencies")
    s.text(450,42,"Compose startup dependencies",size=29,bold=True)
    s.rect(100,120,230,85,"PostgreSQL\nhealthy",size=22)
    s.rect(570,120,230,85,"MinIO\nhealthy",size=22)
    s.rect(100,300,230,85,"Express API\nafter PostgreSQL",size=21)
    s.rect(570,300,230,85,"Backup worker\nafter PostgreSQL, MinIO,\nand API",size=20)
    s.line(215,205,215,300)
    s.line(685,205,685,300)
    s.line(330,342,570,342)
    s.path("M330,162 L450,162 L450,280 L570,280")
    s.text(450,475,["Compose health checks gate dependent services.","The API waits for PostgreSQL; the worker waits for all three services."],size=19,color="#444444")
    return s.finish()

def make_endpoints():
    s=SVG(900,600,"Notes API endpoints")
    s.text(450,43,"Notes API endpoints",size=29,bold=True)
    s.rect(350,78,200,58,"Express API",size=23,bold=True)
    boxes=[(35,250,"GET /health\nDB readiness"),(177,250,"GET /notes\nList notes"),(319,250,"POST /notes\nCreate note"),(461,250,"GET /notes/:id\nRead one"),(603,250,"PUT /notes/:id\nReplace fields"),(745,250,"DELETE\n/notes/:id\nRemove note")]
    s.line(450,136,450,195,arrow=False); s.line(110,195,820,195,arrow=False)
    for x,y,label in boxes:
        s.line(x+60,195,x+60,y)
        s.rect(x,y,120,100,label,size=17)
    s.text(450,423,"Database routes use parameterized SQL; invalid IDs and inputs receive client errors.",size=18,color="#444444")
    s.text(450,466,"JSON request bodies are limited to 32 KB.",size=18,color="#444444")
    return s.finish()

def make_data_model():
    s=SVG(900,550,"Notes database model")
    s.text(450,43,"Notes database model",size=29,bold=True)
    s.rect(110,92,680,400,fill="#ffffff")
    s.rect(110,92,680,65,"notes",fill=FILL,size=26,bold=True)
    rows=[("id","BIGSERIAL PRIMARY KEY"),("title","TEXT NOT NULL"),("content","TEXT NOT NULL"),("created_at","TIMESTAMPTZ NOT NULL DEFAULT NOW()"),("updated_at","TIMESTAMPTZ NOT NULL DEFAULT NOW()")]
    for i,(name,typ) in enumerate(rows):
        y=195+i*58
        if i: s.line(130,y-26,770,y-26,arrow=False,color="#cccccc",width=1)
        s.text(150,y,name,size=19,bold=(i==0),anchor="start")
        lines=[typ]
        if typ.startswith("TIMESTAMPTZ"):
            lines=["TIMESTAMPTZ NOT NULL", "DEFAULT NOW()"]
        s.text(350,y,lines,size=18,anchor="start")
    s.text(450,535,"PostgreSQL assigns the identifier and timestamps; updates refresh updated_at.",size=18,color="#444444")
    return s.finish()

def make_backup_flow():
    s=SVG(900,620,"Scheduled backup workflow")
    s.text(450,40,"Scheduled backup workflow",size=29,bold=True)
    items=[(25,"pg_dump","custom format\ncompressed"),(202,"SHA-256","hash archive\nrecord byte size"),(379,"Upload dump","unique UTC key\nwith UUID"),(556,"Upload manifest","key, database,\nchecksum, size"),(733,"Complete","dump and\nmanifest listed")]
    for x,label,body in items:
        s.rect(x,150,142,105,fill="#ffffff")
        s.rect(x,150,142,40,label,fill=FILL,size=18,bold=True)
        s.text(x+71,215,body.split('\n'),size=16)
    for x in [167,344,521,698]: s.line(x,202,x+35,202)
    s.rect(442,390,220,78,"Manifest upload fails",size=19)
    s.rect(692,390,178,78,"Delete incomplete\ndump object",size=18)
    s.path("M627,255 L627,325 L552,325 L552,390")
    s.line(662,429,692,429)
    s.text(450,525,"Worker attempts immediately, then waits the configured interval after each attempt.",size=18,color="#444444")
    return s.finish()

def make_restore_flow():
    s=SVG(900,900,"Safe database restore workflow")
    s.text(450,40,"Safe database restore workflow",size=29,bold=True)
    s.rect(300,75,300,62,"Select and validate backup key",size=20)
    s.rect(300,165,300,62,"Confirm restore (or pass --yes)",size=20)
    s.rect(300,255,300,62,"Remember prior app / worker state",size=18)
    s.rect(300,345,300,62,"Stop app and scheduled worker",size=20)
    s.diamond(450,510,360,150,"Verify manifest, database,\nsize and SHA-256",size=20)
    s.rect(300,650,300,75,"pg_restore in one transaction\n--exit-on-error",size=19)
    s.rect(620,430,230,68,"Reject backup; run no SQL",size=18)
    s.rect(300,790,300,65,"Restart originally running\nservices only",size=18)
    for y1,y2 in [(137,165),(227,255),(317,345),(407,435)]: s.line(450,y1,450,y2)
    s.line(450,585,450,650)
    s.path("M630,510 L870,510 L870,420 L735,420 L735,430",arrow=True)
    s.text(655,535,"invalid",size=16,anchor="start")
    s.path("M735,498 L735,822 L600,822")
    s.text(755,635,"restart",size=16,anchor="start")
    s.text(466,622,"valid",size=16,anchor="start")
    s.line(450,725,450,790)
    s.text(450,878,"Wrapper restores prior service state after success or failure.",size=18,color="#444444")
    return s.finish()

def make_ci():
    s=SVG(900,620,"Continuous integration and scheduled recovery")
    s.text(450,40,"Continuous integration and scheduled recovery",size=28,bold=True)
    s.rect(345,75,210,68,"Push / pull request",size=22,bold=True)
    s.line(450,143,450,185,arrow=False); s.line(210,185,690,185,arrow=False)
    s.line(210,185,210,220); s.line(690,185,690,220)
    s.rect(45,220,330,215,fill="#ffffff")
    s.rect(45,220,330,48,"Application job",size=21,bold=True)
    s.text(210,305,["Node syntax check", "Express API tests", "Python backup / wrapper", "unit tests"],size=18)
    s.rect(525,220,330,215,fill="#ffffff")
    s.rect(525,220,330,48,"Containers and recovery job",size=21,bold=True)
    s.text(690,305,["Compose validation", "Build app, backup, and MinIO", "Run isolated integration recovery", "Upload recovery logs artifact"],size=18)
    s.rect(145,485,610,90,fill=FILL)
    s.text(450,520,["Separate scheduled workflow: daily at 03:17 UTC or manual start.","Runs the disposable recovery demonstration in a temporary environment."],size=18)
    return s.finish()

def make_sequence():
    s=SVG(900,1150,"End-to-end recovery sequence")
    s.text(450,38,"End-to-end recovery sequence",size=28,bold=True)
    xs=[90,270,450,630,810]
    names=["Client","Express API","PostgreSQL","Backup worker","MinIO"]
    for x,name in zip(xs,names):
        s.rect(x-66,70,132,55,name,size=18,bold=True)
        s.line(x,125,x,1080,arrow=False,color="#aaaaaa",width=1,dash="6 6")
    def msg(i,j,y,label):
        if i == j:
            x=xs[i]
            s.path(f"M{x},{y} L{x+32},{y} L{x+32},{y+13} L{x},{y+13}")
            s.text(x+45,y+5,label,size=16,anchor="start")
        else:
            s.line(xs[i],y,xs[j],y)
            mid=(xs[i]+xs[j])/2
            s.text(mid,y-10,label,size=17)
    msg(0,1,175,"POST /notes")
    msg(1,2,220,"INSERT note")
    msg(2,1,265,"created row")
    msg(1,0,310,"201 response")
    msg(3,2,385,"pg_dump archive")
    msg(3,4,435,"upload dump")
    msg(3,4,485,"upload manifest")
    msg(0,3,550,"select backup key")
    msg(0,1,600,"stop app")
    msg(0,3,635,"stop worker")
    msg(0,2,670,"remove isolated PG volume")
    msg(0,2,705,"recreate PG volume")
    msg(3,4,750,"download objects")
    msg(3,3,785,"verify manifest")
    msg(3,3,810,"check size + SHA-256")
    msg(3,2,850,"transactional restore")
    msg(0,1,895,"restart app")
    msg(0,1,935,"GET /notes")
    msg(1,2,975,"SELECT notes")
    msg(2,1,1015,"recovered rows")
    msg(1,0,1055,"compare exact snapshot")
    s.text(450,1120,"MinIO volume remains; recovered rows are compared with the saved snapshot.",size=17,color="#444444")
    return s.finish()

FIGURES={
    "01-stack":make_stack,
    "02-architecture":make_architecture,
    "03-startup":make_startup,
    "04-endpoints":make_endpoints,
    "05-data-model":make_data_model,
    "06-backup-flow":make_backup_flow,
    "07-restore-flow":make_restore_flow,
    "08-ci":make_ci,
    "09-recovery-sequence":make_sequence,
}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    ASSETS.mkdir(parents=True,exist_ok=True)
    if not RSVG_CONVERT:
        raise FileNotFoundError("Install librsvg to provide the rsvg-convert command")
    for name, build in FIGURES.items():
        path=OUT/f"{name}.svg"
        source=build()
        parsed=ET.fromstring(source)
        assert parsed.tag.endswith("svg") and parsed.attrib.get("viewBox")
        width,height=map(int,parsed.attrib["viewBox"].split()[2:])
        for node in parsed.iter("{http://www.w3.org/2000/svg}text"):
            x,y=float(node.attrib["x"]),float(node.attrib["y"])
            assert 0 <= x <= width and 0 < y < height, (name,node.attrib)
        path.write_text(source+"\n",encoding="utf-8")
        png=path.with_suffix(".png")
        subprocess.run([str(RSVG_CONVERT),"--zoom","2",str(path),"--output",str(png)],check=True)
        data=png.read_bytes()
        assert data[:8]==b"\x89PNG\r\n\x1a\n"
        assert (int.from_bytes(data[16:20],"big"),int.from_bytes(data[20:24],"big"))==(width*2,height*2), name
    for name in ("somaiya-trust.png", "somaiya-logo.png", "cover-accent.png"):
        assert (ASSETS / name).read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(list(OUT.glob("*.svg")))==9 and len(list(OUT.glob("*.png")))==9
    print(f"Wrote {len(FIGURES)} SVG and 2x PNG diagrams to {OUT}")

if __name__=="__main__": main()
