#!/usr/bin/env python3
"""Convert the CONTAINER price list (xlsx) into catalog-data-container.js.
Re-run whenever that price list changes:
    python3 scripts/convert_container.py
Container plants (ЗКС / closed root system) are a separate segment from the open-ground
("грунтовые") trees in catalog-data.js. Same output schema so the same card/modal code
renders both: species -> varieties -> variants[{height, caliper, form, price}].
Slugs are prefixed 'c-' so they never collide with the grunt catalog.

Source layout (one worksheet):
    <group header row>  name | 'Параметры' | 'Стоимость'
    <data rows>         "Рус. название 'Cultivar' (Latin ...)" | "H, caliper, ЗКС" | price
Groups seen: 'Лиственные деревья' and 'БЖИ' (быстрорастущая живая изгородь / hedge)."""
import zipfile, xml.etree.ElementTree as ET, re, json, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, 'Контейнерные растения Аллея РнД.xlsx')
OUT = os.path.join(HERE, 'catalog-data-container.js')
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

# group header -> (category label shown on the card, short blurb for the modal)
GROUPS = {
    'Лиственные деревья': (
        'Лиственное дерево',
        'Крупномерное лиственное дерево в контейнере (ЗКС). Закрытая корневая система даёт '
        'высокую приживаемость и позволяет высаживать растение практически в любой сезон.'),
    'БЖИ': (
        'Живая изгородь',
        'Растение для быстрорастущей живой изгороди, поставляется в контейнере (ЗКС). '
        'Готовый модуль для плотной зелёной стены, хорошо переносит стрижку.'),
}

YO = {'Клен': 'Клён', 'Дерен': 'Дёрен', 'Береза': 'Берёза'}  # restore ё in display names

# transliteration for slugs
TR = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya', ' ': '-',
}


def slugify(name):
    s = ''.join(TR.get(ch, '' if not ch.isalnum() else ch) for ch in name.lower())
    s = re.sub(r'-+', '-', s).strip('-')
    return 'c-' + s


def read_rows():
    z = zipfile.ZipFile(SRC)
    ss = []
    for si in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(NS + 'si'):
        ss.append(''.join(t.text or '' for t in si.iter(NS + 't')))
    sh = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))

    def colnum(ref):
        c = ''.join(ch for ch in ref if ch.isalpha()); n = 0
        for ch in c:
            n = n * 26 + (ord(ch) - 64)
        return n

    rows = []
    for r in sh.find(NS + 'sheetData').findall(NS + 'row'):
        cells = {}
        for c in r.findall(NS + 'c'):
            v = c.find(NS + 'v'); val = ''
            if v is not None:
                val = v.text
                if c.get('t') == 's':
                    val = ss[int(val)]
            cells[colnum(c.get('r'))] = val
        rows.append([cells.get(i, '') for i in range(1, (max(cells) if cells else 0) + 1)])
    return rows


QUOTES = "'\"‘’„“”`"
CULT = re.compile(r"[%s]\s*([^%s]+?)\s*[%s]" % (QUOTES, QUOTES, QUOTES))


def split_name(raw):
    """-> (base Russian species, cultivar or '') from a messy cell like
       "Клен остролистный 'Crimson King' (Acer platanoides 'Crimson King')"."""
    txt = raw.replace('\n', ' ').replace('\t', ' ')
    txt = re.sub(r'\s+', ' ', txt).strip()
    # cultivar = first quoted token (before the Latin parenthetical)
    head = txt.split('(')[0]
    m = CULT.search(head)
    cultivar = m.group(1).strip() if m else ''
    base = head[:m.start()] if m else head
    base = re.sub(r'\([^)]*\)', '', base)          # strip any stray parenthetical
    base = base.strip(' ,.-')
    base = re.sub(r'\s+', ' ', base)
    for k, v in YO.items():
        if base.startswith(k):
            base = v + base[len(k):]
    return base, cultivar


def parse_params(p):
    """-> dict(height, caliper, form) from strings like
       '400-450, 14-16, ЗКС' | 'St.220, 16-18, ЗКС' | '250, С20' | '100*40*100 см'."""
    p = re.sub(r'\s+', ' ', str(p).replace('\t', ' ')).strip()
    height = caliper = form = ''
    # hedge block dimensions, e.g. 100*40*100 см -> keep whole as the "size"
    if '*' in p or '×' in p:
        dims = re.sub(r'\s*[*×]\s*', '×', p)
        return {'height': dims, 'caliper': '', 'form': ''}
    for tok in [t.strip() for t in p.split(',') if t.strip()]:
        low = tok.lower()
        if low in ('зкс', 'зкс.'):
            continue  # whole segment is ЗКС; no need to repeat it on every size
        if tok.startswith(('St.', 'st.', 'St ', 'Ст')):
            n = re.findall(r'\d+', tok)
            form = ('штамб ' + n[0] + ' см') if n else 'штамб'
            continue
        if re.match(r'^[СCсc]\s*\d+', tok):  # container volume, e.g. С20
            vol = re.sub(r'[СCсc]\s*', '', tok)
            form = 'контейнер C' + vol
            continue
        nums = [int(x) for x in re.findall(r'\d+', tok)]
        if not nums:
            continue
        unit = 'см'
        val = tok.replace('см', '').strip()
        if max(nums) >= 100:          # height range or single height
            height = val + ' ' + unit
        else:                          # trunk caliper
            caliper = val + ' ' + unit
    return {'height': height.strip(), 'caliper': caliper.strip(), 'form': form}


def main():
    rows = read_rows()
    species = {}   # slug -> {slug, name, cat, description, varieties{key->{name,variants[]}}}
    order = []
    group = None
    for row in rows:
        c0 = (row[0] if row else '').strip()
        c1 = (row[1] if len(row) > 1 else '').strip()
        c2 = (row[2] if len(row) > 2 else '').strip()
        if not c0:
            continue
        if c0 in GROUPS and c1 == 'Параметры':
            group = c0
            continue
        if not (c2 and c2.replace('.', '').isdigit()):
            continue  # header / discount / note row
        if group is None:
            continue
        base, cultivar = split_name(c0)
        if not base:
            continue
        slug = slugify(base)
        if slug not in species:
            cat, desc = GROUPS[group]
            species[slug] = {'slug': slug, 'name': base, 'cat': cat,
                             'description': desc, 'varieties': {}}
            order.append(slug)
        params = parse_params(c1)
        variety = cultivar or 'базовый'
        key = variety.lower()
        vmap = species[slug]['varieties']
        if key not in vmap:
            vmap[key] = {'name': variety, 'variants': []}
        vmap[key]['variants'].append({
            'height': params['height'], 'caliper': params['caliper'],
            'form': params['form'], 'price': int(float(c2)),
        })

    out = []
    for slug in order:
        sp = species[slug]
        varieties = []
        allprices = []
        for entry in sp['varieties'].values():
            vlist = sorted(entry['variants'], key=lambda x: x['price'])
            allprices += [v['price'] for v in vlist]
            varieties.append({'name': entry['name'], 'variants': vlist})
        varieties.sort(key=lambda vv: vv['variants'][0]['price'] if vv['variants'] else 0)
        img = 'assets/trees/%s.jpg' % slug
        out.append({
            'slug': slug, 'name': sp['name'], 'cat': sp['cat'],
            'description': sp['description'],
            'segment': 'container',
            'image': img if os.path.exists(img) else None,
            'minPrice': min(allprices) if allprices else 0,
            'varietyCount': len(varieties),
            'variantCount': sum(len(v['variants']) for v in varieties),
            'varieties': varieties,
        })

    js = '/* AUTO-GENERATED from the container price list by scripts/convert_container.py. Do not edit by hand. */\n'
    js += 'window.ALLEYA_CATALOG_CONTAINER = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n'
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)

    print('WROTE %s' % OUT)
    print('species: %d | total variants: %d' % (len(out), sum(s['variantCount'] for s in out)))
    print()
    for s in out:
        flag = '' if s['image'] else '  [NO IMAGE -> placeholder]'
        print('%-22s %-20s %-16s varieties:%2d variants:%2d от %d ₽%s' % (
            s['slug'], s['name'], s['cat'], s['varietyCount'], s['variantCount'],
            s['minPrice'], flag))


if __name__ == '__main__':
    main()
