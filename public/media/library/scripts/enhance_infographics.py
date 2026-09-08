"""Composite reviewed Gemini material plates through the exact SVG primitives.

Every original SVG element survives unchanged. Added raster material and glow
live inside the original entity group and can be removed without changing meaning.
"""
import base64
import copy
import hashlib
import io
import json
from functools import lru_cache

import cairosvg
import numpy as np
import svgwrite
from lxml import etree
from PIL import Image, ImageDraw

from infographic_contract import ROOT, read, write, digest, validate
from compile_infographics import GRAMMAR, OUT, BG, INK, MUTED, shape, text, paragraph, font, measure_rendered_junctions

SVG = 'http://www.w3.org/2000/svg'
XLINK = 'http://www.w3.org/1999/xlink'
DEST = OUT / 'enhancements'
MANIFEST = ROOT / 'declarations/infographic-enhancement.v1.json'
REVIEW = ROOT / 'evaluations/component-enhancement-review.json'
PRIMITIVES = {'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line'}


def local(element):
    return etree.QName(element).localname


def asset_receipts(require_review=True):
    from generate_component_assets import component_request
    manifest = read(MANIFEST)
    if digest(ROOT / manifest['grammar']) != manifest['grammarSha256']:
        raise ValueError('STALE_ENHANCEMENT_GRAMMAR')
    expected = set(GRAMMAR['nodeTypes']) | set(GRAMMAR['junctionTypes'])
    if {a['id'] for a in manifest['assets']} != expected or len(manifest['assets']) != len(expected):
        raise ValueError('INCOMPLETE_ENHANCEMENT_ALPHABET')
    review = read(REVIEW) if require_review else None
    receipts = {}
    for asset in manifest['assets']:
        receipt = read(asset['receipt'])
        if receipt['status'] != 'GENERATED' or digest(ROOT / receipt['image']) != receipt['imageSha256']:
            raise ValueError('UNVERIFIED_ENHANCEMENT_ASSET:' + asset['id'])
        if any(receipt[key] != value for key, value in [
            ('grammarSha256', manifest['grammarSha256']), ('guideSha256', asset['guideSha256']),
            ('styleReferenceSha256', manifest['styleReferenceSha256'])]):
            raise ValueError('STALE_ENHANCEMENT_ASSET:' + asset['id'])
        if component_request(manifest, asset)[2] != receipt['requestSha256']:
            raise ValueError('STALE_COMPONENT_REQUEST:' + asset['id'])
        if review:
            accepted = review['assets'].get(asset['id'], {})
            if accepted.get('status') != 'ACCEPTED_MATERIAL' or accepted.get('imageSha256') != receipt['imageSha256']:
                raise ValueError('UNREVIEWED_ENHANCEMENT_ASSET:' + asset['id'])
        receipts[asset['id']] = receipt
    return receipts


@lru_cache(None)
def plate(path, expected):
    if digest(ROOT / path) != expected:
        raise ValueError('STALE_MATERIAL_BYTES')
    image = Image.open(ROOT / path).convert('RGB')
    rgb = np.asarray(image)
    # Source images remain untouched. Extract the black-matte material as a
    # derivative; the canonical SVG mask, never this bounding box, owns shape.
    foreground = Image.fromarray((rgb.max(axis=2) > 38).astype(np.uint8) * 255)
    bounds = foreground.getbbox()
    if not bounds:
        raise ValueError('EMPTY_MATERIAL_PLATE')
    return image.crop(bounds)


def text_guards(group, box, scale):
    x, y, _, _ = box
    guards = []
    for node in group:
        if local(node) != 'text':
            continue
        size = float(node.get('font-size', 16)); value = ''.join(node.itertext())
        width = font(round(size), node.get('font-weight') in ('700', 'bold')).getlength(value)
        tx, ty = float(node.get('x', 0)), float(node.get('y', 0))
        anchor = node.get('text-anchor', 'start')
        left = tx - (width / 2 if anchor == 'middle' else width if anchor == 'end' else 0)
        guards.append([round((left-x-5)*scale), round((ty-y-size-3)*scale),
                       round((left-x+width+5)*scale), round((ty-y+5)*scale)])
    return guards


def material_sprite(group, box, kind, receipt):
    x, y, w, h = box; scale = 2
    width, height = round(w*scale), round(h*scale)
    mask_root = etree.Element(f'{{{SVG}}}svg', nsmap={None: SVG},
                              width=str(width), height=str(height), viewBox=f'{x} {y} {w} {h}')
    outlines = [child for child in group if local(child) in PRIMITIVES]
    shell_count = 3 if kind == 'evidence' else len(outlines) if kind in ('branch', 'fan-out', 'convergence', 'termination') else 1
    outlines = outlines[:shell_count]
    for child in outlines:
        node = copy.deepcopy(child)
        # Material occupies a geometric rim, leaving one continuous quiet face.
        # Generated interior marks can never duplicate the vector icons or turn
        # labels into little cut-out plaques.
        node.set('fill', 'none'); node.set('stroke', '#ffffff')
        node.set('stroke-width', '10' if kind in ('branch', 'fan-out', 'convergence', 'termination') else '36')
        mask_root.append(node)
    mask = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=etree.tostring(mask_root)))).getchannel('A')
    bounds = mask.getbbox()
    if not bounds:
        raise ValueError('EMPTY_CANONICAL_MASK:' + kind)
    texture = plate(receipt['image'], receipt['imageSha256'])
    texture = texture.resize((bounds[2]-bounds[0], bounds[3]-bounds[1]), Image.Resampling.LANCZOS)
    color = Image.new('RGB', (width, height)); color.paste(texture, bounds[:2])
    guards = text_guards(group, box, scale)
    draw = ImageDraw.Draw(mask)
    for guard in guards:
        draw.rectangle(guard, fill=0)
    rgb = np.asarray(color)
    matte = np.clip((rgb.max(axis=2).astype(float)-6)/26, 0, 1)
    alpha = np.rint(np.asarray(mask).astype(float)*matte).astype(np.uint8)
    image = color.convert('RGBA'); image.putalpha(Image.fromarray(alpha))
    stream = io.BytesIO(); image.save(stream, format='WEBP', quality=92, method=4, exact=True)
    if not np.array_equal(np.asarray(Image.open(io.BytesIO(stream.getvalue())).getchannel('A')), alpha):
        raise ValueError('MATERIAL_ENCODING_CHANGED_ALPHA')
    return stream.getvalue(), {'guardCount': len(guards), 'guardLeakPixels': sum(
        int(np.count_nonzero(alpha[max(0,g[1]):min(height,g[3]+1),max(0,g[0]):min(width,g[2]+1)]))
        for g in guards if g[2] >= 0 and g[3] >= 0 and g[0] < width and g[1] < height),
        'materialPixels': int(np.count_nonzero(alpha))}


def add_material(group, box, kind, receipt):
    x, y, w, h = box
    data, proof = material_sprite(group, box, kind, receipt)
    layer = etree.Element(f'{{{SVG}}}g', {'data-enhancement': 'material', 'data-asset-id': kind,
                                          'data-asset-sha256': receipt['imageSha256'], 'aria-hidden': 'true',
                                          'pointer-events': 'none'})
    color = (GRAMMAR['nodeTypes'] | GRAMMAR['junctionTypes'])[kind]['color']
    if kind not in ('branch', 'fan-out', 'convergence', 'termination'):
        face = copy.deepcopy(next(child for child in group if local(child) in PRIMITIVES))
        face.set('fill', '#07131e'); face.set('stroke', 'none'); face.set('opacity', '.45'); layer.append(face)
    # These are copies of the semantic contours, not new enclosing shapes.
    for width, opacity in [(16, .045), (9, .09), (5, .16)]:
        for child in group:
            if local(child) not in PRIMITIVES:
                continue
            glow = copy.deepcopy(child); glow.attrib.pop('id', None)
            glow.set('fill', 'none'); glow.set('stroke', color)
            glow.set('stroke-width', str(width)); glow.set('opacity', str(opacity))
            layer.append(glow)
    etree.SubElement(layer, f'{{{SVG}}}image', {'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h),
        'preserveAspectRatio': 'none', f'{{{XLINK}}}href': 'data:image/webp;base64,' + base64.b64encode(data).decode()})
    # Reassert the precise thin contour over the generated material. Original
    # geometry remains directly in the entity group for the contact checker.
    for child in group:
        if local(child) in PRIMITIVES:
            contour = copy.deepcopy(child); contour.attrib.pop('id', None)
            contour.set('fill', 'none'); contour.set('opacity', '.55'); layer.append(contour)
    index = next((i for i, child in enumerate(group) if local(child) == 'text'), len(group))
    group.insert(index, layer)
    return proof


def strip_material(svg):
    root = etree.fromstring(svg.encode() if isinstance(svg, str) else svg)
    for layer in root.xpath('//*[@data-enhancement]'):
        layer.getparent().remove(layer)
    return etree.tostring(root, method='c14n')


def composite(svg, projection, receipts):
    root = etree.fromstring(svg.encode() if isinstance(svg, str) else svg)
    proofs = []
    for node in projection['nodes'] + projection['junctions']:
        group = root.xpath('//*[@id=$id]', id=node['id'])[0]
        proof = add_material(group, projection['layout']['boxes'][node['id']], node['type'], receipts[node['type']])
        proofs.append({'entityId': node['id'], 'assetId': node['type'], **proof})
    result = etree.tostring(root).decode()
    if strip_material(result) != strip_material(svg):
        raise ValueError('ENHANCEMENT_CHANGED_BASE_SVG')
    if any(p['guardLeakPixels'] or not p['materialPixels'] for p in proofs):
        raise ValueError('ENHANCEMENT_MASK_FAILURE')
    return result, proofs


def symbol(kind, receipts):
    spec = (GRAMMAR['nodeTypes'] | GRAMMAR['junctionTypes'])[kind]
    d = svgwrite.Drawing(size=(340, 228), viewBox='0 0 340 228', debug=False)
    d.add(d.rect((0, 0), (340, 228), fill=BG))
    group = d.g(id='material-symbol-' + kind)
    shape(d, group, kind, 20, 25, 300, 170, spec['color']); d.add(group)
    root = etree.fromstring(d.tostring().encode())
    add_material(root.xpath('//*[@id=$id]', id='material-symbol-' + kind)[0], [20, 25, 300, 170], kind, receipts[kind])
    root.set('role', 'img'); root.set('aria-label', spec['label'] + ' enhanced material')
    return etree.tostring(root).decode()


def atlas(receipts):
    specs = GRAMMAR['nodeTypes'] | GRAMMAR['junctionTypes']
    w, h = 1800, 2190
    d = svgwrite.Drawing(size=(w, h), viewBox=f'0 0 {w} {h}', debug=False)
    d.add(d.rect((0, 0), (w, h), fill=BG))
    text(d, d, 'SIDEFX / MATERIAL EDITION 01', 50, 56, 18, '#79ddeb', True)
    text(d, d, 'Same meaning. More presence.', 50, 128, 62, INK, True)
    text(d, d, '15 canonical primitives · Nano Banana material plates · Exact vector geometry', 50, 175, 24, MUTED)
    samples = {}
    for i, (kind, spec) in enumerate(specs.items()):
        x, y = 50 + i % 3 * 575, 226 + i // 3 * 373
        d.add(d.line((x, y), (x+545, y), stroke=spec['color'], stroke_opacity=.6))
        text(d, d, f'{i+1:02d}', x, y+36, 14, MUTED)
        text(d, d, spec['label'], x+36, y+36, 26, spec['color'], True)
        shape(d, d, kind, x+8, y+90, 125, 80, spec['color'])
        text(d, d, 'BASE', x+69, y+211, 11, MUTED, True, 'middle')
        text(d, d, '→', x+153, y+142, 25, MUTED)
        enhanced = symbol(kind, receipts); samples[kind] = enhanced
        d.add(d.image('data:image/svg+xml;base64,' + base64.b64encode(enhanced.encode()).decode(),
                      insert=(x+195, y+52), size=(340, 228)))
        text(d, d, 'ENHANCED MATERIAL', x+364, y+292, 11, spec['color'], True, 'middle')
        paragraph(d, d, spec['meaning'], x, y+320, 536, 15, MUTED)
    text(d, d, 'GEOMETRY IS AUTHORED. MATERIAL IS GENERATED. EVIDENCE STATUS STAYS EXPLICIT.', 50, h-40, 17, '#79ddeb', True)
    path = OUT / 'symbol-atlas-enhanced.svg'; path.write_text(d.tostring(), encoding='utf-8')
    cairosvg.svg2png(url=str(path), write_to=str(path.with_suffix('.png')), output_width=1800)
    for kind, svg in samples.items():
        path = DEST / (kind + '.svg'); path.write_text(svg, encoding='utf-8')
        cairosvg.svg2png(url=str(path), write_to=str(path.with_suffix('.png')), output_width=680)


def main():
    receipts = asset_receipts()
    DEST.mkdir(parents=True, exist_ok=True)
    atlas(receipts)
    products = []
    for path in sorted(OUT.glob('*/projection.json')):
        projection = read(path)
        contract = validate(read('declarations/infographics/' + projection['id'] + '.json'))
        for source in [path.parent / 'infographic.svg', *sorted(path.parent.glob('frame-[1-5].svg'))]:
            svg, masks = composite(source.read_text(encoding='utf-8'), projection, receipts)
            target = source.with_stem(source.stem + '-enhanced'); target.write_text(svg, encoding='utf-8')
            if source.name == 'infographic.svg':
                contacts = measure_rendered_junctions(contract, svg)
                if contacts['findings']: raise ValueError('ENHANCED_CONTACT_FAILURE')
                cairosvg.svg2png(url=str(target), write_to=str(target.with_suffix('.png')), output_width=2400)
                proof = {'id': projection['id'], 'baseSvgSha256': digest(source),
                         'enhancedSvgSha256': digest(target), 'contractSha256': projection['contractSha256'],
                         'manifestSha256': digest(MANIFEST), 'reviewSha256': digest(REVIEW),
                         'baseRecoveredExactly': True, 'maskProofs': masks, 'junctionGeometryProof': contacts}
                write(path.parent / 'enhancement-receipt.json', proof); products.append(proof)
        print('ENHANCED', projection['id'], flush=True)
    write('evaluations/infographic-enhancement-report.json', {'status': 'COMPOSITED_AND_VERIFIED',
        'manifestSha256': digest(MANIFEST), 'reviewSha256': digest(REVIEW),
        'assetCount': len(receipts), 'products': products,
        'scope': 'Rendering and mask proof only. Generated appearance never certifies capability execution.'})


if __name__ == '__main__':
    main()
