"""Convert saved Figma design output for the event popup banners into React
components (Tailwind classes), with local assets and Figma shader modules.

Usage: python3 event-banners-from-figma.py <raw_dir> <app_dir> <public_dir> <download_cache>
Each <raw_dir>/<node>.design.txt is the text of get_design_context for that frame.
The frames include a lobby screenshot and a dim layer behind the popup; those are
removed because the real lobby sits behind the popup.
"""
import os, re, subprocess, sys
from PIL import Image

RAW, APP, PUB, CACHE = sys.argv[1:5]
BANNERS = [('1129-69', 'b1'), ('1141-208', 'b2')]
FONT_CLASS = {
    'SUITE:Heavy': 'font-black', 'SUITE:ExtraBold': 'font-extrabold', 'SUITE:Bold': 'font-bold',
    'SUITE:SemiBold': 'font-semibold', 'SUITE:Medium': 'font-medium',
    # Project rule: SUITE replaces Pretendard wherever a reference uses Pretendard.
    'Pretendard_Variable:Bold': 'font-bold',
    'Heir_of_Light:Bold': 'office-font-heir', 'Heir_of_Light:Regular': 'office-font-heir-regular',
    'DNF_Bit_Bit_v2:Regular': 'office-font-dnf',
}


def opening_tag_end(code, i):
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


def element_span(code, start):
    """[start, end) of the element whose opening tag begins at start."""
    tag = re.match(r'<([\w.]+)', code[start:]).group(1)
    end = opening_tag_end(code, start)
    if code[end - 2] == '/': return start, end
    depth = 1; j = end
    pat = re.compile(r'<(/?)' + re.escape(tag) + r'(?=[\s>/])')
    while True:
        m = pat.search(code, j)
        if m.group(1):
            depth -= 1
            if depth == 0: return start, code.index('>', m.end()) + 1
            j = m.end()
        else:
            e = opening_tag_end(code, m.start())
            if code[e - 2] != '/': depth += 1
            j = e


def remove_element(code, pattern):
    m = re.search(pattern, code)
    assert m, pattern
    start = code.rfind('<', 0, m.start())
    a, b = element_span(code, start)
    return code[:a] + code[b:]


def convert(node, key, index):
    text = open(f'{RAW}/{node}.design.txt').read()
    code = text[text.index('const assetPathPrefix'):]
    code = code[:code.index('SUPER CRITICAL')].rstrip()
    prefix = re.search(r'const assetPathPrefix = "([^"]+)";', code).group(1)
    code = re.sub(r'const assetPathPrefix = "[^"]+";\n', '', code)

    # Shader modules: keep Figma's module source verbatim next to the component.
    imports = []
    for m in re.finditer(r'import \{ ShaderEffect \} from "@figma/expressive-components";\n', code):
        imports.append("import { ShaderEffect } from '@figma/expressive-components';")
    code = code.replace('import { ShaderEffect } from "@figma/expressive-components";\n', '')
    for m in re.finditer(r'(import \{[^}]+\} from )"\./lib/custom-effects/(\w+)";\n', code):
        imports.append(m.group(1) + f"'./lib/custom-effects/{m.group(2)}';")
        mod = re.search(r'// lib/custom-effects/' + m.group(2) + r'\.ts\n(.*?)(?=\n// lib/custom-effects/|\Z)', text, re.S)
        assert mod, m.group(2)
        os.makedirs(f'{APP}/event/lib/custom-effects', exist_ok=True)
        open(f'{APP}/event/lib/custom-effects/{m.group(2)}.ts', 'w').write(mod.group(1).rstrip() + '\n')
    code = re.sub(r'import \{[^}]+\} from "\./lib/custom-effects/\w+";\n', '', code)

    # The frame paints a lobby screenshot and a dim layer; the real lobby replaces them.
    code = remove_element(code, r'data-name="image 366"')
    code = remove_element(code, r'className="absolute backdrop-blur-\[2px\] bg-\[rgba\(0,0,0,0\.6\)\][^"]*"')
    code = code.replace('className="bg-[#050505] relative size-full"', 'className="relative size-full"', 1)

    # Drop asset constants nothing references any more (e.g. the removed lobby screenshot).
    for name in re.findall(r'const (\w+) = `\$\{assetPathPrefix\}/', code):
        if len(re.findall(r'\b' + name + r'\b', code)) == 1:
            code = re.sub(r'const ' + name + r' = `[^`]*`;\n', '', code)
    out_dir = f'{PUB}/assets/event/{key}'; os.makedirs(out_dir, exist_ok=True)
    sizes = {}
    def asset(m):
        name, file = m.group(1), m.group(2)
        raw = f'{CACHE}/{key}/{file}'
        if not os.path.exists(raw):
            os.makedirs(os.path.dirname(raw), exist_ok=True)
            subprocess.run(['curl', '-sSfL', '--retry', '3', '-o', raw, f'{prefix}/{file}'], check=True)
        base, ext = os.path.splitext(file)
        if ext == '.png':
            im = Image.open(raw); im.load()
            longest = max(im.size)
            if longest > 1800:
                r = 1800 / longest; im = im.resize((round(im.size[0] * r), round(im.size[1] * r)), Image.LANCZOS)
            if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGBA')
            out = f'{out_dir}/{base}.webp'; im.save(out, 'WEBP', quality=84, method=6)
            url = f'/assets/event/{key}/{base}.webp'
        else:
            out = f'{out_dir}/{file}'; open(out, 'wb').write(open(raw, 'rb').read())
            url = f'/assets/event/{key}/{file}'
        sizes[url] = os.path.getsize(out)
        return f'const {name} = "{url}";'
    code = re.sub(r'const (\w+) = `\$\{assetPathPrefix\}/([\w.]+)`;', asset, code)

    # ShaderEffect falls back to plain children when WebGPU/HTML-in-Canvas is missing, but
    # that fallback drops className, losing the layer position. Position a wrapper instead.
    code = re.sub(r'<ShaderEffect className="([^"]*)" data-node-id="([^"]*)"',
                  r'<div className="\1" data-node-id="\2"><ShaderEffect className="absolute inset-0"', code)
    code = code.replace('</ShaderEffect>', '</ShaderEffect></div>')
    # Figma's export measures these masks from the mask-group frame instead of the mask
    # image layer. Layer data (get_metadata) puts the image at x=845 / 876 against fills at
    # 211 / 242, so the mask offset is 634px, not 35px.
    MASK_FIX = {'1141:309': ('mask-position-[35px_15px]', 'mask-position-[634px_15px]'),
                '1141:354': ('mask-position-[35px_15px]', 'mask-position-[634px_15px]')}
    for nid, (bad, good) in MASK_FIX.items():
        m = re.search(r'<div className="([^"]*)" data-node-id="' + re.escape(nid) + '"', code)
        if m and bad in m.group(1):
            code = code[:m.start(1)] + m.group(1).replace(bad, good) + code[m.end(1):]
    for figma_font, cls in FONT_CLASS.items():
        code = code.replace(f"font-['{figma_font}']", cls)
    left = re.findall(r"font-\['[^']+'\]", code)
    assert not left, left

    # Figma shadows on unfilled layers follow the artwork; CSS needs drop-shadow there.
    def fix_shadow(m):
        cls = m.group(1)
        if 'inset_' in cls or re.search(r'(?:^|\s)(?:bg-|border)', cls): return m.group(0)
        def to_drop(sm):
            parts = sm.group(1).split('_')
            if len(parts) == 5 and parts[3] in ('0px', '0'):
                return f'drop-shadow-[{parts[0]}_{parts[1]}_{parts[2]}_{parts[4]}]'
            return sm.group(0)
        return 'className="' + re.sub(r'(?<![\w-])shadow-\[([^\]]+)\]', to_drop, cls) + '"'
    code = re.sub(r'className="([^"]*shadow-\[[^"]*)"', fix_shadow, code)

    code = re.sub(r'export default function \w+\(\)', f'export default function EventBanner{index}()', code)
    header = ("'use client';\n// Generated from Figma by scripts/event-banners-from-figma.py (node " + node.replace('-', ':') + ").\n"
              "import * as React from 'react';\n" + '\n'.join(imports) + ('\n' if imports else '') + '\n')
    os.makedirs(f'{APP}/event', exist_ok=True)
    open(f'{APP}/event/EventBanner{index}.tsx', 'w').write(header + code + '\n')
    print(key, 'assets', len(sizes), 'KB', sum(sizes.values()) // 1024, 'shader modules', len(imports) - (1 if any('ShaderEffect }' in i for i in imports) else 0))


for i, (node, key) in enumerate(BANNERS, 1):
    convert(node, key, i)
