"""Check the publication boundary without printing matched secret values."""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'github-token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b'),
    'api-key': re.compile(r'\b(?:sk-proj-[A-Za-z0-9_-]{30,}|AIza[0-9A-Za-z_-]{30,}|AKIA[A-Z0-9]{16})\b'),
    'publication-contact': re.compile(r'Mandy\.Lu1@dentsu\.com',re.I),
}

def check():
    problems=[]
    if (ROOT/'public/public').exists():
        problems.append(('public/public','stale-generated-directory'))
    pdf_count=0
    for path in (ROOT/'public').rglob('*'):
        if not path.is_file():
            continue
        if path.suffix.lower() in {'.xlsx','.idml','.indd','.otf','.ttf','.env'}:
            problems.append((str(path.relative_to(ROOT)),'work-file'))
            continue
        if path.suffix.lower()=='.pdf':
            pdf_count+=1
            reader=PdfReader(path)
            text='\n'.join(page.extract_text() for page in reader.pages)
        elif path.suffix.lower() in {'.json','.html','.js','.ts','.css','.svg','.txt'}:
            text=path.read_text(encoding='utf-8')
        else:
            continue
        for name,pattern in PATTERNS.items():
            if pattern.search(text):
                problems.append((str(path.relative_to(ROOT)),name))
    catalog=json.loads((ROOT/'public/data/catalog.json').read_text())
    article_count=0
    for entry in catalog['years']:
        data=json.loads((ROOT/'public'/entry['dataUrl']).read_text())
        assert len(data['articles'])==entry['articleCount']
        for article in data['articles']:
            article_count+=1
            for field in ['sourcePdf','htmlUrl']:
                target=(ROOT/'public'/article[field]).resolve()
                assert target.is_relative_to((ROOT/'public').resolve()) and target.is_file(),(article['id'],field)
    result={'articleCount':article_count,'pdfCount':pdf_count,'findings':problems}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 1 if problems else 0

if __name__=='__main__':
    sys.exit(check())
