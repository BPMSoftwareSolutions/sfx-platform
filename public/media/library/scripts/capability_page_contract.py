"""Versioned composition boundary for existing, reviewed content and circuit artifacts."""
from typing import Literal

import jsonschema
from pydantic import Field

from infographic_contract import ROOT, Strict, read, digest, validate as validate_projection
from compile_infographics import render, inspect_geometry, measure_rendered_junctions
from enhance_infographics import strip_material, asset_receipts


class Artifact(Strict):
    path: str = Field(min_length=1)
    sha256: str = Field(pattern=r'^[a-f0-9]{64}$')


class Film(Strict):
    media: Artifact
    receipt: Artifact
    poster: Artifact
    captions: Artifact | None = None
    claimIds: list[str] = Field(min_length=1)


class Circuit(Strict):
    projectionId: str = Field(pattern=r'^[a-z0-9-]+$')
    relationship: Literal['scenario', 'related-scenario', 'capability-overview']
    context: str = Field(min_length=1)
    compiled: Artifact
    enhancementReceipt: Artifact
    motionReceipt: Artifact | None = None


class OpenCircuit(Strict):
    requirement: str = Field(min_length=1)
    evidenceIds: list[str] = Field(min_length=1)


class Page(Strict):
    contractVersion: Literal['capability-page.v1']
    capabilityId: str = Field(pattern=r'^[a-z0-9-]+$')
    content: Artifact
    film: Film
    surfaces: dict[str, Artifact]
    circuits: list[Circuit]
    openCircuit: OpenCircuit | None = None


class Inputs:
    """Capture the exact closure consumed by a build; reject paths outside the lab."""
    def __init__(self):
        self.hashes = {}

    def file(self, path, expected=None):
        result = (ROOT / path).resolve()
        if not result.is_relative_to(ROOT) or not result.is_file():
            raise ValueError('ARTIFACT_PATH:' + str(path))
        actual = digest(result)
        if expected is not None and actual != expected:
            raise ValueError('STALE_ARTIFACT:' + str(path))
        self.hashes[result.relative_to(ROOT).as_posix()] = actual
        return result

    def artifact(self, ref):
        return self.file(ref.path, ref.sha256)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_circuit(binding, capability_id, inputs):
    compiled = read(inputs.artifact(binding.compiled))
    require(compiled['id'] == binding.projectionId, 'PROJECTION_ID_MISMATCH')
    contract_path = inputs.file('declarations/infographics/' + binding.projectionId + '.json', compiled['contractSha256'])
    contract = validate_projection(read(contract_path))
    require(capability_id in {c.id for c in contract.capabilities}, 'CIRCUIT_CAPABILITY_MISMATCH')
    # A capability page cannot quietly pull in an unrelated estate circuit.
    require({n.capabilityId for n in contract.nodes + contract.junctions} == {capability_id}, 'CIRCUIT_SCOPE_MISMATCH')
    require((binding.relationship == 'capability-overview') == (contract.altitude == 'capability'), 'CIRCUIT_ALTITUDE_MISMATCH')
    for key, value in contract.model_dump().items():
        require(compiled.get(key) == value, 'COMPILED_SEMANTIC_DRIFT:' + key)
    for source in contract.sources:
        inputs.file(source.path, source.sha256)
    directory = inputs.artifact(binding.compiled).parent
    base = inputs.file(directory / 'infographic.svg').read_bytes()
    require(not inspect_geometry(contract, compiled['layout']), 'CIRCUIT_GEOMETRY')
    # Re-render with the frozen layout: no Graphviz invocation, no new placement.
    require(strip_material(render(contract, compiled['layout'])) == strip_material(base), 'BASE_PROJECTION_DRIFT')
    enhanced_path = inputs.file(directory / 'infographic-enhanced.svg')
    enhanced = enhanced_path.read_bytes()
    receipt = read(inputs.artifact(binding.enhancementReceipt))
    for key, path in [('baseSvgSha256', directory / 'infographic.svg'),
                      ('enhancedSvgSha256', enhanced_path),
                      ('manifestSha256', ROOT / 'declarations/infographic-enhancement.v1.json'),
                      ('reviewSha256', ROOT / 'evaluations/component-enhancement-review.json')]:
        inputs.file(path, receipt[key])
    require(receipt['contractSha256'] == compiled['contractSha256'], 'MATERIAL_CONTRACT_MISMATCH')
    require(strip_material(base) == strip_material(enhanced), 'MATERIAL_SEMANTIC_DRIFT')
    require(not measure_rendered_junctions(contract, enhanced.decode())['findings'], 'MATERIAL_CONTACT_FAILURE')
    require(receipt['baseRecoveredExactly'] and all(m['guardLeakPixels'] == 0 and m['materialPixels'] > 0 for m in receipt['maskProofs']), 'MATERIAL_MASK_FAILURE')
    motion = None
    if binding.motionReceipt:
        motion_receipt = read(inputs.artifact(binding.motionReceipt))
        require(motion_receipt['contractSha256'] == compiled['contractSha256'], 'MOTION_CONTRACT_MISMATCH')
        require(motion_receipt['staticSvgSha256'] == digest(enhanced_path), 'MOTION_MATERIAL_MISMATCH')
        inputs.file(directory / 'circuit-motion-enhanced.mp4', motion_receipt['videoSha256'])
        inputs.file(directory / 'motion-timeline-enhanced.json', motion_receipt['timelineSha256'])
        motion = (directory / 'circuit-motion-enhanced.mp4').relative_to(ROOT).as_posix()
    return {'binding': binding.model_dump(), 'projection': compiled,
            'baseSvg': base.decode(), 'enhancedSvg': enhanced.decode(), 'motion': motion,
            'directory': directory.relative_to(ROOT).as_posix()}


def validate_page(data, inputs=None):
    inputs = inputs or Inputs()
    page = Page.model_validate(data)
    content = read(inputs.artifact(page.content))
    schema = inputs.file('schemas/capability-content-contract.schema.json')
    jsonschema.validate(content, read(schema))
    require(content['capabilityId'] == page.capabilityId, 'CONTENT_CAPABILITY_MISMATCH')
    require(content['status'] == 'EDITORIALLY_REVIEWED', 'CONTENT_NEEDS_DIRECTION')
    require('landing-page' in content['permittedSurfaces'], 'PAGE_NOT_PERMITTED')
    require(bool(content.get('storyTitle')), 'STORY_TITLE_REQUIRED')
    evidence = {e['id']: e for e in content['evidence']}
    claims = {c['id']: c for c in content['claims']}
    require(len(evidence) == len(content['evidence']) and len(claims) == len(content['claims']), 'DUPLICATE_CONTENT_ID')
    for e in evidence.values():
        inputs.file(e['path'], e['sha256'])
    for claim in claims.values():
        require(set(claim['evidenceIds']) <= set(evidence), 'UNKNOWN_CLAIM_EVIDENCE')
    for mechanic in content['mechanics']:
        require(set(mechanic['evidenceIds']) <= set(evidence), 'UNKNOWN_MECHANIC_EVIDENCE')
    require(set(page.surfaces) == set(content['permittedSurfaces']) == set(content['surfaceContracts']), 'SURFACE_COVERAGE_MISMATCH')
    for name, surface in content['surfaceContracts'].items():
        require(set(surface['claimIds']) <= set(claims) and set(surface['evidenceIds']) <= set(evidence), 'SURFACE_REFERENCE_MISMATCH:' + name)
    # This composite presents the complete package, so the landing contract must admit it.
    require(set(content['surfaceContracts']['landing-page']['claimIds']) == set(claims), 'LANDING_CLAIM_SCOPE')
    require(set(page.film.claimIds) <= set(content['surfaceContracts']['video']['claimIds']), 'FILM_CLAIM_SCOPE')
    for ref in page.surfaces.values():
        inputs.artifact(ref)
    inputs.artifact(page.film.media)
    film_receipt = read(inputs.artifact(page.film.receipt))
    require(film_receipt.get('filmDigest') == page.film.media.sha256, 'FILM_RECEIPT_MISMATCH')
    require(page.surfaces['video'] == page.film.media and page.surfaces['thumbnail'] == page.film.poster, 'FILM_SURFACE_MISMATCH')
    inputs.artifact(page.film.poster)
    if page.film.captions:
        inputs.artifact(page.film.captions)
    require(bool(page.circuits) != bool(page.openCircuit), 'CIRCUIT_OR_EXPLICIT_GAP_REQUIRED')
    require(len({c.projectionId for c in page.circuits}) == len(page.circuits), 'DUPLICATE_CIRCUIT')
    if page.openCircuit:
        require(set(page.openCircuit.evidenceIds) <= set(evidence), 'UNKNOWN_GAP_EVIDENCE')
    training = content.get('training')
    require(training and training.get('objective') and training.get('exercise') and training.get('questions'), 'TRAINING_REQUIRED')
    for question in training['questions']:
        require(type(question.get('correct')) is int and 0 <= question['correct'] < len(question['options']), 'INVALID_ASSESSMENT')
    circuits = [load_circuit(c, page.capabilityId, inputs) for c in page.circuits]
    if circuits:
        # Existing reviewed material is reused; this boundary never generates media.
        for asset in asset_receipts().values():
            inputs.file(asset['image'], asset['imageSha256'])
        manifest = read('declarations/infographic-enhancement.v1.json')
        inputs.file(manifest['styleReference'], manifest['styleReferenceSha256'])
        for asset in manifest['assets']:
            inputs.file(asset['receipt'])
            inputs.file(asset['guide'], asset['guideSha256'])
    return page, content, circuits, inputs
