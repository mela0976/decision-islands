import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import unicodedata
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


def asset_name_matches_content(path):
    match = re.search(r'-([0-9a-f]{10})\.woff2$', path.name)
    return bool(match and match.group(1) == sha256(path.read_bytes()).hexdigest()[:10])


def build(source_dir, root):
    output = root / 'public/fonts'
    output.mkdir(parents=True, exist_ok=True)
    source_names = ['SourceHanSansTW-VF.otf', 'SourceHanSansTC-Light.otf', 'Montserrat.ttf']
    source_info = {
        name: {'sha256': sha256((source_dir / name).read_bytes()).hexdigest(),
               'bytes': (source_dir / name).stat().st_size}
        for name in source_names
    }
    previous_manifest_path = output / 'manifest.json'
    previous_manifest = json.loads(previous_manifest_path.read_text()) if previous_manifest_path.exists() else {}
    previous_css_path = output / 'publication.css'
    previous_css = previous_css_path.read_text() if previous_css_path.exists() else ''
    previous_faces = {}
    for body in re.findall(r'@font-face\{([^}]+)\}', previous_css):
        family = re.search(r'font-family:"([^"]+)"', body)
        weight = re.search(r'font-weight:([^;]+)', body)
        source = re.search(r'url\("([^"]+)"\)', body)
        ranges = re.search(r'unicode-range:([^}]+)', body)
        if family and weight and source and ranges:
            codepoints = set()
            for code in ranges.group(1).split(','):
                start, separator, end = code.strip().removeprefix('U+').partition('-')
                low = int(start, 16)
                high = int(end, 16) if separator else low
                codepoints.update(range(low, high + 1))
            previous_faces[source.group(1)] = (family.group(1), weight.group(1).strip(), codepoints)
    reusable_files = {}
    expected_families = {'chinese': 'Source Han Sans TW', 'latin': 'Montserrat'}
    if (previous_manifest.get('sources') == source_info
            and previous_manifest.get('families') == expected_families
            and previous_manifest.get('renamedForSubsetting') is True):
        for entry in previous_manifest.get('files', []):
            path = output / entry['file']
            codepoints = entry.get('codepoints', [])
            weight = str(entry['weight'])
            face = previous_faces.get(entry['file'])
            expected_font_family = 'Decision Publication Sans TC' if weight == '300' else 'Decision Publication Sans TW'
            if (not path.is_file() or not face or face[:2] != ('Publication Sans TW', weight)
                    or face[2] != set(codepoints) or entry.get('bytes') != path.stat().st_size
                    or not asset_name_matches_content(path)):
                continue
            font = TTFont(path)
            axes = {axis.axisTag: (axis.minValue, axis.maxValue) for axis in font['fvar'].axes} if 'fvar' in font else {}
            expected_axes = {'wght': (250.0, 900.0)} if weight == '250 900' else {}
            if (font.flavor == 'woff2' and font['name'].getDebugName(1) == expected_font_family
                    and set(codepoints) <= set(font.getBestCmap()) and axes == expected_axes):
                reusable_files[(weight, tuple(codepoints))] = entry['file']
    referenced_files = set()
    main = (root / 'src/main.ts').read_text()
    editions = [json.loads(path.read_text()) for path in (root / 'public/data').glob('*.json')
                if path.name != 'catalog.json']
    editions = [e for e in editions if isinstance(e, dict) and isinstance(e.get('articles'), list)]
    titles = ''.join(a['title'] + a['authors'] for e in editions for a in e['articles'])
    early = main + (root / 'index.html').read_text() + (root / 'src/library.ts').read_text() + (root / 'src/season.ts').read_text() + ''.join(e['title'] for e in editions) + titles
    source_text = ''.join(path.read_text() for path in (root / 'src').glob('*.ts'))
    article_text = ''.join(json.dumps(e, ensure_ascii=False) for e in editions)
    ui_files = sorted(path for path in (root / 'public/immersive').rglob('*')
                      if path.suffix in {'.js', '.html'})
    ui_text = ''.join(path.read_text() for path in ui_files)
    ui_codepoints = {ord(c) for c in ui_text
                     if unicodedata.name(c, '').startswith((
                         'CJK UNIFIED IDEOGRAPH-', 'CJK COMPATIBILITY IDEOGRAPH-', 'HANGUL '))}
    initial = {ord(c) for c in early if ord(c) > 127}
    counts = Counter(ord(c) for c in source_text + article_text if ord(c) > 127)
    requested = set(counts) | initial
    face_rules, files = [], []
    inputs = [('Variable', '250 900', source_dir / 'SourceHanSansTW-VF.otf')]
    previous_ui_codes = set(previous_manifest.get('corpora', {}).get('immersive', {}).get('supplementalCodepoints', []))
    previous_ui_file = previous_manifest.get('corpora', {}).get('immersive', {}).get('supplementalFile')
    reused_publication_chunks = False
    for style, weight, source in inputs:
        available = set(TTFont(source).getBestCmap())
        core = sorted(initial & available)
        remaining = [c for c, _ in counts.most_common() if c in available and c not in initial]
        chunks = [core] + [remaining[i:i + 220] for i in range(0, len(remaining), 220)]
        previous_tw_entries = [entry for entry in previous_manifest.get('files', [])
                               if str(entry.get('weight')) == str(weight)
                               and entry.get('file') != previous_ui_file]
        previous_chunks = [entry['codepoints'] for entry in previous_tw_entries]
        previous_coverage = {code for chunk in previous_chunks for code in chunk}
        previous_base_codes = set(previous_manifest.get('publicationCodepoints', previous_manifest.get('requestedCodepoints', [])))
        can_reuse_chunks = (
            previous_manifest.get('sources') == source_info
            and previous_base_codes <= requested
            and requested - previous_base_codes <= ui_codepoints
            and previous_chunks
            and sum(map(len, previous_chunks)) == len(previous_coverage)
            and previous_coverage.isdisjoint(previous_ui_codes)
            and previous_coverage | (previous_ui_codes & previous_base_codes) == previous_base_codes & available
            and all((str(weight), tuple(chunk)) in reusable_files for chunk in previous_chunks)
        )
        if can_reuse_chunks:
            chunks = previous_chunks
            reused_publication_chunks = True
        for index, codes in enumerate(chunks):
            if not codes:
                continue
            name = reusable_files.get((str(weight), tuple(codes)))
            if name is None:
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
            referenced_files.add(name)
            files.append({'file': name, 'weight': weight, 'codepoints': codes, 'bytes': (output / name).stat().st_size})
    supplemental_source = source_dir / 'SourceHanSansTC-Light.otf'
    covered = set(TTFont(source_dir / 'SourceHanSansTW-VF.otf').getBestCmap())
    supplemental_codes = sorted((requested - covered) & set(TTFont(supplemental_source).getBestCmap()))
    if supplemental_codes:
        name = reusable_files.get(('300', tuple(supplemental_codes)))
        if name is None:
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
        referenced_files.add(name)
        files.append({'file': name, 'weight': 300, 'codepoints': supplemental_codes, 'bytes': (output / name).stat().st_size})
        covered.update(supplemental_codes)
    if reused_publication_chunks:
        previous_coverage = {code for entry in previous_manifest.get('files', [])
                             if entry.get('file') != previous_ui_file for code in entry.get('codepoints', [])}
        ui_requested = ui_codepoints - previous_coverage
    else:
        ui_requested = ui_codepoints - requested
    ui_supplemental_codes = sorted(ui_requested & set(TTFont(inputs[0][2]).getBestCmap()))
    ui_shard_name = None
    if ui_supplemental_codes:
        name = reusable_files.get(('250 900', tuple(ui_supplemental_codes)))
        if name is None:
            font = TTFont(inputs[0][2])
            options = subset.Options()
            options.flavor = 'woff2'
            options.name_IDs = ['*']
            options.name_legacy = True
            options.name_languages = ['*']
            sub = subset.Subsetter(options=options)
            sub.populate(unicodes=ui_supplemental_codes)
            sub.subset(font)
            rename(font, 'Decision Publication Sans TW', 'Variable')
            font.flavor = 'woff2'
            name = 'publication-tw-ui.woff2'
            font.save(output / name)
            hashed_name = name.replace('.woff2', '-' + sha256((output / name).read_bytes()).hexdigest()[:10] + '.woff2')
            (output / name).rename(output / hashed_name)
            name = hashed_name
        ui_shard_name = name
        ranges = ','.join(f'U+{c:X}' for c in ui_supplemental_codes)
        face_rules.append(f'@font-face{{font-family:"Publication Sans TW";font-style:normal;font-weight:250 900;font-display:swap;src:url("{name}") format("woff2");unicode-range:{ranges}}}')
        referenced_files.add(name)
        files.append({'file': name, 'weight': '250 900', 'codepoints': ui_supplemental_codes, 'bytes': (output / name).stat().st_size})
        covered.update(ui_supplemental_codes)
    source = source_dir / 'Montserrat.ttf'
    latin_source_font = TTFont(source)
    latin_codepoints = sorted(set(latin_source_font.getBestCmap()) & set(range(0x20, 0x100)))
    latin_source_axes = {axis.axisTag: (axis.minValue, axis.maxValue) for axis in latin_source_font['fvar'].axes} if 'fvar' in latin_source_font else {}
    latin_face = re.search(r'@font-face\{([^}]*font-family:"Publication Latin"[^}]+)\}', previous_css)
    latin_url = re.search(r'url\("([^"]+)"\)', latin_face.group(1)) if latin_face else None
    latin_weight = re.search(r'font-weight:([^;]+)', latin_face.group(1)) if latin_face else None
    latin_range = re.search(r'unicode-range:([^}]+)', latin_face.group(1)) if latin_face else None
    latin_name = latin_url.group(1) if latin_url else None
    reusable_latin = (source_info == previous_manifest.get('sources')
                      and previous_manifest.get('families') == expected_families
                      and previous_manifest.get('renamedForSubsetting') is True
                      and latin_name and latin_weight and latin_range
                      and latin_face and 'Publication Latin' in latin_face.group(1)
                      and latin_weight.group(1).strip() == '100 900'
                      and latin_range.group(1).strip() == 'U+20-FF'
                      and (output / latin_name).is_file()
                      and asset_name_matches_content(output / latin_name))
    if reusable_latin:
        font = TTFont(output / latin_name)
        latin_axes = {axis.axisTag: (axis.minValue, axis.maxValue) for axis in font['fvar'].axes} if 'fvar' in font else {}
        reusable_latin = (font.flavor == 'woff2'
                          and font['name'].getDebugName(1) == 'Decision Publication Latin'
                          and latin_axes == latin_source_axes
                          and set(latin_codepoints) <= set(font.getBestCmap()))
    if not reusable_latin:
        font = latin_source_font
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
    latin_codepoints = sorted(set(TTFont(output / latin_name).getBestCmap()))
    referenced_files.add(latin_name)
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
        name: source_info[name] for name in source_names},
        'families': {'chinese': 'Source Han Sans TW', 'latin': 'Montserrat'},
        'latinCodepoints': latin_codepoints,
        'renamedForSubsetting': True, 'publicationCodepoints': sorted(requested),
        'requestedCodepoints': sorted(requested | ui_codepoints),
        'corpora': {'immersive': {
            'files': [str(path.relative_to(root)) for path in ui_files],
            'codepoints': sorted(ui_codepoints),
            'supplementalFile': ui_shard_name,
            'supplementalCodepoints': ui_supplemental_codes}},
        'files': files, 'missingCodepoints': sorted((requested | ui_codepoints) - covered)}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    for old in output.glob('publication-*.woff2'):
        if old.name not in referenced_files:
            old.unlink()
    print(json.dumps({'fontFiles': len(files) + 1, 'bytes': sum(f['bytes'] for f in files),
                      'coreBytesPerWeight': {f['weight']: f['bytes'] for f in files if '-0-' in f['file']},
                      'missing': ''.join(chr(c) for c in manifest['missingCodepoints'])}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', required=True, type=Path)
    parser.add_argument('--root', default=Path(__file__).resolve().parents[1], type=Path)
    args = parser.parse_args()
    build(args.source_dir, args.root)
