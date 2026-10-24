import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import shutil
from fontTools import subset
from fontTools.ttLib import TTFont



def rename(font, family, style):
    names = {1: family, 2: style, 3: f'{family}-{style}', 4: f'{family} {style}',
             6: f'{family.replace(" ", "")}-{style}', 16: family, 17: style}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding(), errors='replace')
    if 'CFF ' in font:
        cff = font['CFF '].cff
        cff.fontNames = [names[6]]
        for top in cff.topDictIndex:
            top.FamilyName, top.FullName = family, names[4]


def build(source_dir, root):
    output = root / 'public/fonts'
    output.mkdir(parents=True, exist_ok=True)
    main = (root / 'src/main.ts').read_text()
    editions = [json.loads(path.read_text()) for path in (root / 'public/data').glob('*.json')
                if path.name != 'catalog.json']
    editions = [e for e in editions if isinstance(e, dict) and isinstance(e.get('articles'), list)]
    titles = ''.join(a['title'] + a['authors'] for e in editions for a in e['articles'])
    early = main + (root / 'index.html').read_text() + (root / 'src/library.ts').read_text() + (root / 'src/season.ts').read_text() + ''.join(e['title'] for e in editions) + titles
    source_text = ''.join(path.read_text() for path in (root / 'src').glob('*.ts'))
    article_text = ''.join(json.dumps(e, ensure_ascii=False) for e in editions)
    initial = {ord(c) for c in early if ord(c) > 127}
    counts = Counter(ord(c) for c in source_text + article_text if ord(c) > 127)
    requested = set(counts) | initial
    face_rules, files = [], []
    for old in output.glob('publication-*.woff2'):
        old.unlink()
    inputs = [('Variable', '250 900', source_dir / 'SourceHanSansTW-VF.otf')]
    for style, weight, source in inputs:
        available = set(TTFont(source).getBestCmap())
        core = sorted(initial & available)
        remaining = [c for c, _ in counts.most_common() if c in available and c not in initial]
        chunks = [core] + [remaining[i:i + 220] for i in range(0, len(remaining), 220)]
        for index, codes in enumerate(chunks):
            if not codes:
                continue
            font = TTFont(source)
            options = subset.Options()
            options.flavor = 'woff2'
            options.name_IDs = ['*']
            options.name_legacy = True
            options.name_languages = ['*']
            sub = subset.Subsetter(options=options)
            sub.populate(unicodes=codes)
            sub.subset(font)
            rename(font, 'Decision Publication Sans TW', style)
            font.flavor = 'woff2'
            name = f'publication-tw-variable-{index}.woff2'
            font.save(output / name)
            hashed_name = name.replace('.woff2', '-' + sha256((output / name).read_bytes()).hexdigest()[:10] + '.woff2')
            (output / name).rename(output / hashed_name)
            name = hashed_name
            ranges = ','.join(f'U+{c:X}' for c in codes)
            face_rules.append(f'@font-face{{font-family:"Publication Sans TW";font-style:normal;font-weight:{weight};font-display:swap;src:url("{name}") format("woff2");unicode-range:{ranges}}}')
            files.append({'file': name, 'weight': weight, 'codepoints': codes, 'bytes': (output / name).stat().st_size})
    supplemental_source = source_dir / 'SourceHanSansTC-Light.otf'
    covered = set(TTFont(source_dir / 'SourceHanSansTW-VF.otf').getBestCmap())
    supplemental_codes = sorted((requested - covered) & set(TTFont(supplemental_source).getBestCmap()))
    if supplemental_codes:
        font = TTFont(supplemental_source)
        options = subset.Options()
        options.name_IDs = ['*']
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=supplemental_codes)
        sub.subset(font)
        rename(font, 'Decision Publication Sans TC', 'Light')
        font.flavor = 'woff2'
        name = 'publication-tc-supplement.woff2'
        font.save(output / name)
        hashed_name = name.replace('.woff2', '-' + sha256((output / name).read_bytes()).hexdigest()[:10] + '.woff2')
        (output / name).rename(output / hashed_name)
        name = hashed_name
        ranges = ','.join(f'U+{c:X}' for c in supplemental_codes)
        face_rules.append(f'@font-face{{font-family:"Publication Sans TW";font-style:normal;font-weight:300;font-display:swap;src:url("{name}") format("woff2");unicode-range:{ranges}}}')
        files.append({'file': name, 'weight': 300, 'codepoints': supplemental_codes, 'bytes': (output / name).stat().st_size})
        covered.update(supplemental_codes)
    source = source_dir / 'Montserrat.ttf'
    font = TTFont(source)
    options = subset.Options()
    options.name_IDs = ['*']
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=list(range(0x20, 0x100)))
    sub.subset(font)
    rename(font, 'Decision Publication Latin', 'Regular')
    font.flavor = 'woff2'
    font.save(output / 'publication-latin.woff2')
    latin_name = 'publication-latin-' + sha256((output / 'publication-latin.woff2').read_bytes()).hexdigest()[:10] + '.woff2'
    (output / 'publication-latin.woff2').rename(output / latin_name)
    face_rules.insert(0, '@font-face{font-family:"Publication Latin";font-style:normal;font-weight:100 900;font-display:swap;src:url("publication-latin.woff2") format("woff2");unicode-range:U+20-FF}'.replace('publication-latin.woff2', latin_name))
    overrides = '''
:root{--publication-font:"Publication Latin","Publication Sans TW","PingFang TC",sans-serif}
body,body *{font-family:var(--publication-font)!important}
body{font-weight:300}
h1,h2,h3,h4,h5,h6{font-weight:500}
strong,b{font-weight:700}
'''
    (output / 'publication.css').write_text('\n'.join(face_rules) + overrides)
    (root / 'src/publication-fonts.css').write_text(overrides)
    for name in ['SourceHanSans-LICENSE.txt', 'Montserrat-OFL.txt']:
        shutil.copy2(source_dir / name, output / name)
    manifest = {'sources': {
        name: {'sha256': sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
        for name in ['SourceHanSansTW-VF.otf', 'SourceHanSansTC-Light.otf', 'Montserrat.ttf']
        for path in [source_dir / name]},
        'families': {'chinese': 'Source Han Sans TW', 'latin': 'Montserrat'},
        'renamedForSubsetting': True, 'requestedCodepoints': sorted(requested), 'files': files,
        'missingCodepoints': sorted(requested - covered)}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(json.dumps({'fontFiles': len(files) + 1, 'bytes': sum(f['bytes'] for f in files),
                      'coreBytesPerWeight': {f['weight']: f['bytes'] for f in files if '-0-' in f['file']},
                      'missing': ''.join(chr(c) for c in manifest['missingCodepoints'])}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', required=True, type=Path)
    parser.add_argument('--root', default=Path(__file__).resolve().parents[1], type=Path)
    args = parser.parse_args()
    build(args.source_dir, args.root)
