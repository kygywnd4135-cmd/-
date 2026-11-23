"""Convert saved Figma design+motion output for the four gacha banners into
React components (Tailwind classes + motion/react), with local assets.

Usage: python3 convert.py <raw_dir> <app_dir> <public_dir> <download_cache>
"""
import json, os, re, sys, urllib.request, io
from PIL import Image

RAW, APP, PUB, CACHE = sys.argv[1:5]
BANNERS = [('1044-96', 'ep02'), ('1055-96', 'ep03'), ('1077-46', 'ep04'), ('1082-46', 'ep05')]
FONT_CLASS = {
    'SUITE:Bold': 'font-bold', 'SUITE:ExtraBold': 'font-extrabold', 'SUITE:SemiBold': 'font-semibold', 'SUITE:Medium': 'font-medium',
    'Cinzel:Bold': 'office-font-cinzel', 'Heir_of_Light:Bold': 'office-font-heir', 'Press_Start_2P:Regular': 'office-font-press',
    'DNF_Bit_Bit_v2:Regular': 'office-font-dnf', 'Noto_Serif_KR:Bold': 'office-font-noto-serif',
}
MOTION_VARS = re.compile(r'\s*"--motion-(?:design-transform|design-transform-inverse|layout-transform)":\s*"[^"]*",?')


def balanced(s, i, open_ch='{', close_ch='}'):
    """Return index just past the brace that closes the one at s[i]."""
    assert s[i] == open_ch, (s[i:i + 30])
    depth = 0; q = None; j = i
    while j < len(s):
        c = s[j]
        if q:
            if c == '\\': j += 2; continue
            if c == q: q = None
        elif c in '"\'`': q = c
        elif c == open_ch: depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0: return j + 1
        j += 1
    raise ValueError('unbalanced')


def prop(snippet, name):
    m = re.search(r'\s' + name + r'=\{', snippet)
    if not m: return None
    start = m.end() - 1
    return snippet[start:balanced(snippet, start)]


def opening_tag_end(code, i):
    """i points at '<'; return index after the matching '>' of the opening tag."""
    j = i + 1; q = None; depth = 0
    while j < len(code):
        c = code[j]
        if q:
            if c == '\\': j += 2; continue
            if c == q: q = None
        elif c in '"\'`': q = c
        elif c == '{': depth += 1
        elif c == '}': depth -= 1
        elif c == '>' and depth == 0: return j + 1
        j += 1
    raise ValueError('tag end')


def closing_index(code, tag_end, tag, self_closing):
    if self_closing: return None
    j = tag_end; depth = 1
    pat = re.compile(r'<(/?)' + re.escape(tag) + r'(?=[\s>/])')
    while True:
        m = pat.search(code, j)
        if not m: raise ValueError('no close for ' + tag)
        if m.group(1):
            depth -= 1
            if depth == 0: return m.start()
            j = m.end()
        else:
            e = opening_tag_end(code, m.start())
            if not code[e - 2] == '/': depth += 1
            j = e


def download(url, dest):
    if not os.path.exists(dest):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        import subprocess
        subprocess.run(['curl', '-sSfL', '--retry', '3', '-o', dest, url], check=True)
        assert os.path.getsize(dest) > 0, url
    return dest


def convert(node, key, index):
    design = open(f'{RAW}/{node}.design.txt').read()
    motion = json.load(open(f'{RAW}/{node}.motion.txt'))
    code = design[design.index('const assetPathPrefix'):]
    code = code[:code.index('SUPER CRITICAL')].rstrip()
    prefix = re.search(r'const assetPathPrefix = "([^"]+)";', code).group(1)
    code = re.sub(r'const assetPathPrefix = "[^"]+";\n', '', code)
    code = code.replace('import { motion } from "motion/react";\n', '')

    # Assets: download, convert PNG to WebP, point to /assets/office/<key>/...
    out_dir = f'{PUB}/assets/office/{key}'; os.makedirs(out_dir, exist_ok=True)
    sizes = {}
    def asset(m):
        name, file = m.group(1), m.group(2)
        raw = download(f'{prefix}/{file}', f'{CACHE}/{key}/{file}')
        base, ext = os.path.splitext(file)
        if ext == '.png':
            im = Image.open(raw); im.load()
            longest = max(im.size)
            if longest > 1800:
                r = 1800 / longest; im = im.resize((round(im.size[0] * r), round(im.size[1] * r)), Image.LANCZOS)
            if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGBA')
            out = f'{out_dir}/{base}.webp'; im.save(out, 'WEBP', quality=82, method=6)
            url = f'/assets/office/{key}/{base}.webp'
        else:
            out = f'{out_dir}/{file}'; open(out, 'wb').write(open(raw, 'rb').read())
            url = f'/assets/office/{key}/{file}'
        sizes[url] = os.path.getsize(out)
        return f'const {name} = "{url}";'
    code = re.sub(r'const (\w+) = `\$\{assetPathPrefix\}/([\w.]+)`;', asset, code)

    # Fonts
    for figma_font, cls in FONT_CLASS.items():
        code = code.replace(f"font-['{figma_font}']", cls)
    left = re.findall(r"font-\['[^']+'\]", code)
    assert not left, left

    # Motion: one snippet per node; "Identical ..." entries reuse another node's snippet.
    snippets = {n['nodeId']: n['codeSnippets']['motionDev'] for n in motion['nodes']}
    for nid, sn in list(snippets.items()):
        m = re.search(r'Identical motion\.dev animation to node .*\((\d+:\d+)\)', sn)
        if m: snippets[nid] = snippets[m.group(1)]
    applied = 0
    for nid, sn in snippets.items():
        anchor = re.search(r'data-(?:node-id|motion-for)="' + re.escape(nid) + '"', code)
        if not anchor: print('  ! no element for', nid); continue
        start = code.rfind('<', 0, anchor.start())
        tag = re.match(r'<([\w.]+)', code[start:]).group(1)
        tag_end = opening_tag_end(code, start)
        self_closing = code[tag_end - 2] == '/'
        close_at = closing_index(code, tag_end, tag, self_closing)
        opening = code[start:tag_end]
        new_tag = tag if tag.startswith('motion.') else 'motion.' + tag
        attrs = []
        for p in ('transformTemplate', 'initial', 'animate', 'transition'):
            v = prop(sn, p)
            if v is None: continue
            if p == 'transition':
                v = re.sub(r',?\s*repeat:\s*Infinity\s*,?', lambda mm: ',' if mm.group(0).strip().startswith(',') and mm.group(0).strip().endswith(',') else '', v)
            attrs.append(f'{p}={v}')
        snippet_style = prop(sn, 'style')
        body = opening[len('<' + tag):]
        style_m = re.search(r'\sstyle=\{\{', body)
        if style_m:
            s0 = style_m.start() + len(' style=')
            s1 = balanced(body, s0)
            style_expr = body[s0:s1]
            obj_start = style_expr.index('{', 1)
            obj_end = balanced(style_expr, obj_start)
            inner = MOTION_VARS.sub('', style_expr[obj_start + 1:obj_end - 1]).strip().rstrip(',')
            if snippet_style:
                extra = snippet_style[2:-2].strip().rstrip(',')
                inner = (inner + ', ' if inner else '') + extra
            tail = style_expr[obj_end:-1]
            new_style = '{{ ' + inner + ' }' + tail + '}' if inner else ''
            body = body[:style_m.start()] + ((' style=' + new_style) if new_style else '') + body[s1:]
        elif snippet_style:
            body = ' style=' + snippet_style + body
        new_opening = '<' + new_tag + ' ' + ' '.join(attrs) + body
        if close_at is not None:
            closing_len = len('</' + tag + '>')
            assert code[close_at:close_at + closing_len] == '</' + tag + '>', code[close_at:close_at + 40]
            code = code[:close_at] + '</' + new_tag + '>' + code[close_at + closing_len:]
        code = code[:start] + new_opening + code[tag_end:]
        applied += 1
    assert 'repeat: Infinity' not in code
    code = re.sub(r'export default function \w+\(\)', f'export default function OfficeBanner{index}()', code)
    header = ("'use client';\n// Generated from Figma by the office banner converter (node " + node.replace('-', ':') + ").\n"
              "// Animations play once on mount; remount (change key) to replay.\n"
              "import * as React from 'react';\nimport { motion } from 'motion/react';\n\n")
    os.makedirs(f'{APP}/office', exist_ok=True)
    open(f'{APP}/office/OfficeBanner{index}.tsx', 'w').write(header + code + '\n')
    print(key, 'motion applied', applied, '/', len(snippets), 'assets', len(sizes), 'KB', sum(sizes.values()) // 1024)


for i, (node, key) in enumerate(BANNERS, 1):
    convert(node, key, i)
