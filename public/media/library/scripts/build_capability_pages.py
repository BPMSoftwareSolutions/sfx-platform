"""Compile reusable capability pages. No provider calls and no source-estate writes."""
import argparse
import html
import json
import os
from pathlib import Path
from string import Template
from urllib.parse import quote

from capability_page_contract import Page, Inputs, validate_page, ROOT, read, digest

DEST = ROOT / 'samples/capability-pages'
KIND = {'CAPSULE_DECLARATION': ('declared', 'Current / declared'),
        'OBSERVED_LOCAL_DEMO': ('observed', 'Observed / local demo'),
        'TARGET_DESIGN': ('target', 'Target / intended'),
        'EDITORIAL_STAGING': ('staging', 'Human / illustrative')}
LABELS = {'video': 'Watch the film', 'short': 'Watch the short', 'thumbnail': 'Thumbnail',
          'article': 'Read the story', 'infographic': 'Infographic', 'training': 'Full lesson',
          'demo': 'Explore the demo', 'landing-page': 'Original package', 'evidence-story': 'Evidence story'}


def esc(value):
    return html.escape(str(value), quote=True)


def url(path, destination):
    return quote(Path(os.path.relpath(ROOT / path, destination)).as_posix(), safe='/')


def json_script(data):
    return 'window.CAPABILITY_PAGE = ' + json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029') + ';\n'


def compile_page(path, check=False):
    inputs = Inputs()
    page, content, circuits, inputs = validate_page(read(inputs.file(path)), inputs)
    inputs.file('scripts/capability_page_contract.py')
    inputs.file('scripts/build_capability_pages.py')
    inputs.file('scripts/compile_infographics.py')
    inputs.file('scripts/enhance_infographics.py')
    grammar = read(inputs.file('declarations/infographic-grammar.v1.json'))
    template = Template(inputs.file('templates/capability-page.html').read_text(encoding='utf-8'))
    css = inputs.file('templates/capability-page.css').read_bytes()
    js = inputs.file('templates/capability-page.js').read_bytes()
    flow_js = inputs.file('templates/circuit-flow.js').read_bytes()
    destination = DEST / page.capabilityId
    link = lambda path: url(path, destination)
    evidence = {e['id']: e for e in content['evidence']}

    def refs(ids):
        return ' '.join(f'<a href="{link(evidence[id]["path"])}">{esc(id)} ↗</a>' for id in ids)

    claims = ''.join(f'<article class="claim {KIND[c["kind"]][0]}" data-claim="{esc(c["id"])}"><p class="eyebrow">{KIND[c["kind"]][1]}</p><p>{esc(c["text"])}</p><div class="sources">{refs(c["evidenceIds"])}</div></article>' for c in content['claims'])
    experience = ''.join(f'<article><span class="eyebrow">0{i+1} / {key}</span><p>{esc(content["experience"][key])}</p></article>' for i, key in enumerate(['input', 'event', 'outcome']))
    mechanics = ''.join(f'<article><span class="eyebrow">{i+1:02d} / {esc(m["id"])}</span><p>{esc(m["meaning"])}</p><div class="sources">{refs(m["evidenceIds"])}</div></article>' for i, m in enumerate(content['mechanics']))
    surfaces = ''.join(f'<a href="{link(ref.path)}"><span>{esc(LABELS[name])}</span><span aria-hidden="true">↗</span></a>' for name, ref in page.surfaces.items())
    training = content['training']
    questions = ''
    for i, q in enumerate(training['questions']):
        options = ''.join(f'<label><input type="radio" name="q{i}" value="{j}" required> <span>{esc(option)}</span></label>' for j, option in enumerate(q['options']))
        questions += f'<fieldset><legend>{i+1:02d}. {esc(q["question"])}</legend>{options}<p class="feedback" id="feedback-{i}"></p></fieldset>'
    evidence_rows = ''.join(f'<details><summary>{esc(e["id"])} <span>{esc(e["kind"].replace("_", " ").lower())}</span></summary><a href="{link(e["path"])}">{esc(e["path"])}</a><code>SHA-256 {e["sha256"]}</code></details>' for e in content['evidence'])
    caption = f'<track kind="captions" src="{link(page.film.captions.path)}" srclang="en" label="English">' if page.film.captions else ''
    if circuits:
        gap = ''
    else:
        gap = f'<div class="open-circuit"><p class="eyebrow">Visual production gap</p><h3>The next circuit needs its own direction.</h3><p>{esc(page.openCircuit.requirement)}</p><div class="sources">{refs(page.openCircuit.evidenceIds)}</div><a href="{link(page.surfaces["infographic"].path)}">Open the existing story infographic ↗</a></div>'
    data = {'capabilityId': page.capabilityId, 'grammar': grammar, 'circuits': circuits,
            'root': link('.').rstrip('/') + '/', 'training': training,
            'contentDigest': page.content.sha256, 'manifestDigest': digest(ROOT / path)}
    page_html = template.substitute(title=esc(content['storyTitle']), capability=esc(content['title']),
        capability_id=esc(page.capabilityId), problem=esc(content['humanProblem']), audience=esc(content['audience']),
        scope=esc(content['scope']), film=link(page.film.media.path), poster=link(page.film.poster.path), captions=caption,
        film_receipt=link(page.film.receipt.path), experience=experience, mechanics=mechanics, claims=claims,
        surfaces=surfaces, objective=esc(training['objective']), exercise=esc(training['exercise']), questions=questions,
        evidence=evidence_rows, circuit_gap=gap, circuit_hidden='' if circuits else 'hidden',
        contract=link(page.content.path), manifest=link(Path(path).relative_to(ROOT) if Path(path).is_absolute() else path),
        studio=link('samples/infographic-grammar/index.html'), catalog=link('samples/content-catalog/index.html'))
    result = {'capabilityId': page.capabilityId, 'storyTitle': content['storyTitle'],
              'circuitCount': len(circuits), 'surfaceCount': len(page.surfaces),
              'status': 'COMPOSED' if circuits else 'COMPOSED_WITH_OPEN_CIRCUIT',
              'inputs': dict(sorted(inputs.hashes.items())),
              'meaning': 'Content composition and artifact integrity only; no capability execution or platform admission.'}
    if not check:
        destination.mkdir(parents=True, exist_ok=True)
        outputs = {'index.html': page_html.encode(), 'page-data.js': json_script(data).encode(),
                   'page.css': css, 'page.js': js, 'circuit-flow.js': flow_js}
        for name, payload in outputs.items():
            (destination / name).write_bytes(payload)
        result['outputs'] = {name: digest(destination / name) for name in outputs}
        (destination / 'build-receipt.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, help='One capability-page manifest, relative to this repository')
    parser.add_argument('--check', action='store_true', help='Validate inputs without writing outputs')
    parser.add_argument('--schema', action='store_true', help='Export the strict page schema')
    args = parser.parse_args()
    if args.schema:
        (ROOT / 'schemas/capability-page.schema.json').write_text(json.dumps({'$schema': 'https://json-schema.org/draft/2020-12/schema', **Page.model_json_schema()}, indent=2) + '\n', encoding='utf-8')
        return
    paths = [ROOT / args.manifest] if args.manifest else sorted((ROOT / 'declarations/capability-pages').glob('*.json'))
    if not paths:
        raise ValueError('NO_PAGE_MANIFESTS')
    # Validate the whole requested batch before producing any page.
    for path in paths:
        compile_page(path, check=True)
    results = [compile_page(path, check=args.check) for path in paths]
    if not args.check and not args.manifest:
        cards = ''.join(f'<a class="edition" href="{r["capabilityId"]}/index.html"><span class="eyebrow">{r["surfaceCount"]} content surfaces · {r["circuitCount"]} living circuits</span><h2>{esc(r["storyTitle"])}</h2><span>Explore the capability →</span></a>' for r in results)
        (DEST / 'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SideFX · Capability editions</title><link rel="stylesheet" href="'+results[0]['capabilityId']+'/page.css"><body><header class="top"><a class="wordmark" href="../content-catalog/index.html">SideFX <span>Capability editions</span></a></header><main><section class="edition-heading"><p class="eyebrow">The future of agentic engineering</p><h1>One capability.<br>A world of meaning.</h1><p>Watch the human story. Open the mechanics. Inspect the evidence.</p></section><div class="edition-grid">'+cards+'</div></main></body></html>', encoding='utf-8')
        (ROOT / 'evaluations/capability-page-build.json').write_text(json.dumps({'contractVersion': 'capability-page.v1', 'pages': results}, indent=2) + '\n', encoding='utf-8')
    for result in results:
        print(result['status'], result['capabilityId'], f"{result['circuitCount']} circuits / {result['surfaceCount']} surfaces")


if __name__ == '__main__':
    main()
