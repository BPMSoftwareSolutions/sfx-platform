#!/usr/bin/env node
// Public-claim provenance checks (G9 tool half):
//   node live-circuit/circuit/verify-claims.mjs --fixtures
//   node live-circuit/circuit/verify-claims.mjs [--claims <dir>] [--rules <file>] [--schema <file>] [--now <iso>]
// Validates ui-claim.v1 documents against claim-rules.v1.json: closed vocabularies,
// basis and sourceRefs/observedAt requirements, classification/status admission,
// freshness windows, copy-must-equal-approved-statement and prohibited wording.
// File-only: publish, read and render enforcement are intentionally not wired in.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const defaultClaimsDir = path.join(repoRoot, 'docs', 'sfx-website-product-evolution', 'claims');

const args = process.argv.slice(2);
const options = { fixtures: false };
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--fixtures') {
    options.fixtures = true;
    continue;
  }
  if (!arg.startsWith('--')) {
    console.error(`unexpected argument: ${arg}`);
    process.exit(2);
  }
  const [name, inline] = arg.split('=');
  const value = inline ?? args[index + 1];
  if (!['--claims', '--rules', '--schema', '--now'].includes(name) || value === undefined) {
    console.error(`unknown or incomplete option: ${arg}`);
    console.error('usage: node verify-claims.mjs [--fixtures] [--claims <dir>] [--rules <file>] [--schema <file>] [--now <iso>]');
    process.exit(2);
  }
  if (inline === undefined) index += 1;
  options[name.slice(2)] = value;
}
const claimsDir = path.resolve(options.claims ?? defaultClaimsDir);
const fixtureDir = path.join(claimsDir, 'fixtures');
const rulesPath = path.resolve(options.rules ?? path.join(here, 'claim-rules.v1.json'));
const schemaPath = path.resolve(options.schema ?? path.join(claimsDir, 'ui-claim.v1.schema.json'));
const now = options.now ? new Date(options.now) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error(`invalid --now: ${options.now}`);
  process.exit(2);
}

const checks = [];
function record(name, pass, detail, refusals = []) {
  const entry = { name, pass: Boolean(pass), detail: detail ?? '' };
  if (refusals.length) entry.refusals = refusals;
  checks.push(entry);
  console.log(`${entry.pass ? 'PASS' : 'FAIL'} ${name}${entry.detail ? ` · ${entry.detail}` : ''}`);
  return entry.pass;
}
async function guard(name, work) {
  try {
    const result = await work();
    return record(name, result?.pass, result?.detail, result?.refusals ?? []);
  } catch (error) {
    return record(name, false, `unavailable · ${error?.message ?? error}`);
  }
}

const isoDate = value => typeof value === 'string' && value.trim() !== '' && !Number.isNaN(new Date(value).getTime());
const claimRefPattern = /^claim-[a-z0-9]+(-[a-z0-9]+)*@[1-9][0-9]*$/;
const isFresh = (observedAt, days, clock) => isoDate(observedAt) && clock.getTime() - new Date(observedAt).getTime() <= days * 86400000;
const freshnessDaysFor = (kind, rules) => rules.freshness.find(entry => entry.kind === kind)?.days ?? Infinity;

function typeMatches(node, type) {
  if (type === 'null') return node === null;
  if (type === 'array') return Array.isArray(node);
  if (type === 'object') return node !== null && typeof node === 'object' && !Array.isArray(node);
  if (type === 'integer') return Number.isInteger(node);
  if (type === 'number') return typeof node === 'number' && Number.isFinite(node);
  return typeof node === type;
}
function checkSchema(node, schema, pointer = '$', errors = []) {
  if (!schema || typeof schema !== 'object') return errors;
  if (schema.const !== undefined && node !== schema.const) errors.push(`${pointer} must equal ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(node)) errors.push(`${pointer} is not an admitted value`);
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(type => typeMatches(node, type))) errors.push(`${pointer} has the wrong type`);
  }
  if (typeof node === 'string') {
    if (schema.minLength !== undefined && node.length < schema.minLength) errors.push(`${pointer} is shorter than ${schema.minLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(node)) errors.push(`${pointer} does not match ${schema.pattern}`);
  }
  if (typeof node === 'number' && schema.minimum !== undefined && node < schema.minimum) errors.push(`${pointer} is below ${schema.minimum}`);
  if (Array.isArray(node) && schema.minItems !== undefined && node.length < schema.minItems) errors.push(`${pointer} needs at least ${schema.minItems} items`);
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    for (const field of schema.required ?? []) if (!(field in node)) errors.push(`${pointer}.${field} is required`);
    for (const [key, value] of Object.entries(node)) {
      if (schema.properties?.[key]) checkSchema(value, schema.properties[key], `${pointer}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${pointer}.${key} is not allowed`);
    }
  }
  if (Array.isArray(node) && schema.items) node.forEach((item, index) => checkSchema(item, schema.items, `${pointer}[${index}]`, errors));
  for (const branch of schema.allOf ?? []) {
    if (branch.if) {
      const condition = [];
      checkSchema(node, branch.if, pointer, condition);
      if (condition.length === 0 && branch.then) checkSchema(node, branch.then, pointer, errors);
    } else {
      checkSchema(node, branch, pointer, errors);
    }
  }
  return errors;
}

function applicable(selector, claim) {
  if (!selector) return true;
  return selector.some(alternative =>
    (!alternative.classification || alternative.classification.includes(claim?.classification))
    && (!alternative.status || alternative.status.includes(claim?.status)));
}
function satisfied(condition, claim, ctx) {
  if (claim === null || typeof claim !== 'object') return false;
  if (condition.classification && !condition.classification.includes(claim.classification)) return false;
  if (condition.status && !condition.status.includes(claim.status)) return false;
  if (condition.requireEffectiveAt && !isoDate(claim.effectiveAt)) return false;
  if (condition.requireLimits) {
    if (typeof claim.limits !== 'string' || claim.limits.trim() === '') return false;
    if (Array.isArray(condition.limitsContainsAny)) {
      const limits = claim.limits.toLowerCase();
      if (!condition.limitsContainsAny.some(phrase => limits.includes(phrase.toLowerCase()))) return false;
    }
  }
  if (condition.requireLabel && !condition.requireLabel.includes(claim.label)) return false;
  if (condition.requireSource) {
    const source = (claim.sourceRefs ?? []).find(ref => ref?.kind === condition.requireSource.kind);
    if (!source) return false;
    if (condition.requireSource.sourceTag && source.sourceTag !== condition.requireSource.sourceTag) return false;
    if (condition.requireSource.requireLifecycle && !(ctx.rules.lifecycles ?? []).includes(source.lifecycle)) return false;
    if (condition.requireSource.freshDays !== undefined && !isFresh(source.observedAt, condition.requireSource.freshDays, ctx.now)) return false;
  }
  return true;
}
function admits(rule, claim, ctx) {
  const conditions = Array.isArray(rule.admitted) ? rule.admitted : rule.admitted ? [rule.admitted] : [];
  if (conditions.length === 0) return true;
  return conditions.some(condition => satisfied(condition, claim, ctx));
}
function staleSourceFor(rule, claim, ctx) {
  const required = Array.isArray(rule.admitted) ? null : rule.admitted?.requireSource;
  if (!required || claim === null || typeof claim !== 'object') return false;
  const source = (claim.sourceRefs ?? []).find(ref => ref?.kind === required.kind);
  const days = required.freshDays ?? freshnessDaysFor(required.kind, ctx.rules);
  return Boolean(source) && Number.isFinite(days) && !isFresh(source.observedAt, days, ctx.now);
}
function scanWording(text, claim, ctx) {
  const refusals = [];
  if (typeof text !== 'string' || text.trim() === '') return refusals;
  let scan = text.toLowerCase();
  for (const entry of ctx.rules.admittedWording ?? []) scan = scan.split(entry.phrase.toLowerCase()).join(' ');
  for (const rule of ctx.rules.wording) {
    if (!applicable(rule.appliesTo, claim)) continue;
    if (Array.isArray(rule.patterns) && rule.patterns.length > 0) {
      if (!rule.patterns.some(pattern => new RegExp(pattern, 'i').test(scan))) continue;
    } else if (!rule.appliesTo) {
      continue;
    }
    if (admits(rule, claim, ctx)) continue;
    const code = rule.staleCode && staleSourceFor(rule, claim, ctx) ? rule.staleCode : rule.code;
    refusals.push({ code, detail: rule.id });
  }
  return refusals;
}

function sourceRequirementMet(requirement, claim, ctx) {
  return (claim.sourceRefs ?? []).some(ref => {
    if (!requirement.anyOfKinds.includes(ref?.kind)) return false;
    if (requirement.fresh && !isFresh(ref.observedAt, freshnessDaysFor(ref.kind, ctx.rules), ctx.now)) return false;
    return true;
  });
}
function validateClaim(claim, ctx) {
  const refusals = [];
  const add = (code, detail) => { if (!refusals.some(entry => entry.code === code)) refusals.push({ code, detail }); };
  if (claim === null || typeof claim !== 'object') {
    add('CLAIM_NOT_DECLARED', 'claim is not an object');
    return refusals;
  }
  const { rules, now: clock } = ctx;
  if (claim.document !== 'ui-claim.v1') add('CLAIM_CONTRACT_UNSUPPORTED', `document=${claim.document}`);
  if (claim.rulesVersion !== undefined && !rules.knownRulesVersions.includes(claim.rulesVersion)) add('CLAIM_RULES_VERSION_UNSUPPORTED', `rulesVersion=${claim.rulesVersion}`);
  if (typeof claim.claimId !== 'string' || !/^claim-[a-z0-9]+(-[a-z0-9]+)*$/.test(claim.claimId)) add('CLAIM_NOT_DECLARED', `claimId=${claim.claimId}`);
  if (!Number.isInteger(claim.revision) || claim.revision < 1) add('CLAIM_NOT_DECLARED', `revision=${claim.revision}`);

  const classificationOk = rules.classification.includes(claim.classification);
  if (!classificationOk) add('CLAIM_CLASSIFICATION_INVALID', `classification=${claim.classification}`);
  const statusOk = rules.status.includes(claim.status);
  if (!statusOk) add('CLAIM_STATUS_INVALID', `status=${claim.status}`);

  const basis = typeof claim.basis === 'string' ? claim.basis.trim() : '';
  const boilerplate = (rules.boilerplateBasis ?? []).map(value => value.toLowerCase());
  const statement = typeof claim.statement === 'string' ? claim.statement.trim() : '';
  if (basis.length < rules.basisMinimumCharacters || boilerplate.includes(basis.toLowerCase()) || basis === statement) {
    add('CLAIM_BASIS_MISSING', `basisLength=${basis.length} minimum=${rules.basisMinimumCharacters}`);
  }

  const refs = Array.isArray(claim.sourceRefs) ? claim.sourceRefs : [];
  if (refs.length === 0) add('CLAIM_SOURCE_REQUIRED', 'sourceRefs is empty');
  for (const ref of refs) {
    if (!rules.sourceKinds.includes(ref?.kind)) {
      add('CLAIM_SOURCE_KIND_UNSUPPORTED', `kind=${ref?.kind}`);
      continue;
    }
    if (typeof ref.locator !== 'string' || ref.locator.trim() === '') add('CLAIM_SOURCE_REQUIRED', `ref ${ref.kind} has no locator`);
    if (rules.digestRequiredKinds.includes(ref.kind) && !/^sha256:[a-f0-9]{64}$/.test(ref.digest ?? '')) add('CLAIM_SOURCE_REQUIRED', `ref ${ref.kind} needs digest sha256:<64 hex>`);
    if (rules.observedAtRequiredKinds.includes(ref.kind) && !isoDate(ref.observedAt)) add('CLAIM_DATE_MISSING', `ref ${ref.kind} needs observedAt`);
  }

  if (!isoDate(claim.observedAt)) add('CLAIM_DATE_MISSING', 'observedAt missing or malformed');
  else if (new Date(claim.observedAt).getTime() > clock.getTime() + 1000) add('CLAIM_OBSERVEDAT_FUTURE', `observedAt=${claim.observedAt}`);
  if (!isoDate(claim.effectiveAt)) add('CLAIM_DATE_MISSING', 'effectiveAt missing or malformed');
  else if (new Date(claim.effectiveAt).getTime() > clock.getTime() + 1000 && claim.status !== 'proposed') add('CLAIM_EFFECTIVE_FUTURE_STATUS', `effectiveAt=${claim.effectiveAt} status=${claim.status}`);

  if (classificationOk && statusOk) {
    const statusRule = rules.statusRules.find(entry => entry.classification === claim.classification);
    if (statusRule && !statusRule.admittedStatuses.includes(claim.status)) add('CLAIM_STATUS_INVALID', `${claim.classification} cannot be ${claim.status}`);
  }
  if (claim.status === 'current' && claim.supersededBy !== null && claim.supersededBy !== undefined) add('CLAIM_STATUS_INVALID', 'current claim carries supersededBy');
  if (claim.status === 'superseded' && !claimRefPattern.test(claim.supersededBy ?? '')) add('CLAIM_STATUS_INVALID', 'superseded claim needs supersededBy claimId@revision');
  if (claim.status === 'historical' && (!isoDate(claim.effectiveAt) || !isoDate(claim.supersededAt))) add('CLAIM_HISTORICAL_WITHOUT_WINDOW', 'historical claim needs effectiveAt and supersededAt');

  const requirement = rules.sourceRequirements.find(entry => entry.classification === claim.classification);
  if (classificationOk && requirement && !sourceRequirementMet(requirement, claim, ctx)) {
    add('CLAIM_SOURCE_REQUIRED', `${claim.classification} needs ${requirement.anyOfKinds.join('/')}${requirement.fresh ? ' (fresh)' : ''}`);
  }

  for (const ref of refs) {
    const window = rules.freshness.find(entry => entry.kind === ref?.kind);
    if (!window || !isoDate(ref?.observedAt)) continue;
    if (!isFresh(ref.observedAt, window.days, clock)) add(window.staleCode, `${ref.kind} observedAt=${ref.observedAt} older than ${window.days}d`);
  }

  for (const [index, variant] of (claim.copyVariants ?? []).entries()) {
    const variantBasis = typeof variant?.basis === 'string' ? variant.basis.trim() : '';
    if (typeof variant?.text !== 'string' || variant.text.trim() === '' || variantBasis.length < rules.basisMinimumCharacters) {
      add('CLAIM_BASIS_MISSING', `copyVariants[${index}] needs text and its own basis`);
    }
  }

  const units = [
    { where: 'statement', text: typeof claim.statement === 'string' ? claim.statement : '' },
    ...(Array.isArray(claim.copyVariants) ? claim.copyVariants.map((variant, index) => ({ where: `copyVariants[${index}]`, text: variant?.text ?? '' })) : []),
  ];
  for (const unit of units) for (const refusal of scanWording(unit.text, claim, ctx)) add(refusal.code, `${unit.where} triggers ${refusal.detail}`);

  return refusals;
}

const normalizeText = value => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
function textEqualsApproved(text, claim, ctx) {
  const target = normalizeText(text);
  if (target === normalizeText(claim.statement)) return true;
  return (Array.isArray(claim.copyVariants) ? claim.copyVariants : []).some(variant =>
    normalizeText(variant?.text) === target
    && typeof variant?.basis === 'string'
    && variant.basis.trim().length >= ctx.rules.basisMinimumCharacters);
}
function validatePlacements(document, claimsIndex, ctx) {
  const results = new Map();
  for (const placement of document?.placements ?? []) {
    const refusals = [];
    const add = (code, detail) => { if (!refusals.some(entry => entry.code === code)) refusals.push({ code, detail }); };
    const text = typeof placement?.text === 'string' ? placement.text : '';
    const claimed = Array.isArray(placement?.claims) ? placement.claims : [];
    if (claimed.length === 0) {
      for (const trigger of scanWording(text, null, ctx)) add('CLAIM_REQUIRED', `${trigger.detail} wording needs a claim attachment`);
    } else {
      for (const claimRef of claimed) {
        const claim = claimsIndex.get(claimRef);
        if (!claim) {
          add('CLAIM_NOT_DECLARED', `claimRef ${claimRef} has no declared fixture revision`);
          continue;
        }
        if (!textEqualsApproved(text, claim, ctx)) add('CLAIM_TEXT_MISMATCH', `copy differs from ${claimRef} statement or copyVariant`);
      }
    }
    results.set(placement?.sectionId ?? `placement-${results.size}`, { refusals });
  }
  return results;
}

let rules = null;
let schema = null;
let rulesDigest = null;
await guard('rules-load', async () => {
  const text = await readFile(rulesPath, 'utf8');
  rulesDigest = createHash('sha256').update(text).digest('hex');
  rules = JSON.parse(text);
  const pass = rules?.contractId === 'claim-rules.v1' && Number.isInteger(rules?.rulesVersion)
    && Array.isArray(rules?.classification) && Array.isArray(rules?.status)
    && Array.isArray(rules?.sourceKinds) && Array.isArray(rules?.wording);
  return { pass, detail: `path=${path.relative(repoRoot, rulesPath)} digest=sha256:${rulesDigest.slice(0, 12)}… rulesVersion=${rules?.rulesVersion}` };
});

if (rules) {
  await guard('rules-refusal-catalogue', async () => {
    const codes = new Set(Object.keys(rules.refusalCodes ?? {}));
    const referenced = [];
    for (const rule of rules.wording) {
      referenced.push(rule.code);
      if (rule.staleCode) referenced.push(rule.staleCode);
    }
    const missing = referenced.filter(code => !codes.has(code));
    const statusOk = rules.statusRules.every(entry => rules.classification.includes(entry.classification) && entry.admittedStatuses.every(status => rules.status.includes(status)));
    const sourceOk = rules.sourceRequirements.every(entry => rules.classification.includes(entry.classification) && entry.anyOfKinds.every(kind => rules.sourceKinds.includes(kind)));
    const freshOk = rules.freshness.every(entry => rules.sourceKinds.includes(entry.kind));
    const pass = missing.length === 0 && statusOk && sourceOk && freshOk
      && rules.basisMinimumCharacters >= 40 && rules.knownRulesVersions.includes(rules.rulesVersion);
    return { pass, detail: `codes=${codes.size} wordingRules=${rules.wording.length} missing=${missing.join(',') || 'none'}` };
  });

  await guard('schema-load', async () => {
    schema = JSON.parse(await readFile(schemaPath, 'utf8'));
    const pass = schema?.title === 'ui-claim.v1' && schema?.properties?.document?.const === 'ui-claim.v1' && Array.isArray(schema?.required);
    return { pass, detail: `path=${path.relative(repoRoot, schemaPath)} requires=${schema?.required?.length ?? 0}` };
  });

  await guard('schema-vocabulary-alignment', async () => {
    if (!schema) return { pass: false, detail: 'schema not loaded' };
    const same = (left, right) => Array.isArray(left) && Array.isArray(right)
      && left.length === right.length && [...left].sort().join() === [...right].sort().join();
    const aligned = {
      classification: same(schema.properties.classification?.enum, rules.classification),
      status: same(schema.properties.status?.enum, rules.status),
      sourceKinds: same(schema.properties.sourceRefs?.items?.properties?.kind?.enum, rules.sourceKinds),
      required: ['claimId', 'revision', 'statement', 'classification', 'status', 'basis', 'sourceRefs', 'observedAt', 'effectiveAt'].every(field => schema.required.includes(field)),
    };
    const failing = Object.entries(aligned).filter(([, ok]) => !ok).map(([key]) => key);
    return { pass: failing.length === 0, detail: `aligned=${Object.keys(aligned).filter(key => aligned[key]).join(',')}${failing.length ? ` failing=${failing.join(',')}` : ''}` };
  });
}

if (rules && options.fixtures) {
  const state = { claims: [], expectations: null, placementDocument: null };
  await guard('fixtures-load', async () => {
    const files = (await readdir(fixtureDir)).filter(name => name.endsWith('.json') && name !== 'expectations.json' && name !== 'placements.json').sort();
    state.claims = [];
    for (const file of files) state.claims.push({ file, document: JSON.parse(await readFile(path.join(fixtureDir, file), 'utf8')) });
    state.expectations = JSON.parse(await readFile(path.join(fixtureDir, 'expectations.json'), 'utf8'));
    state.placementDocument = JSON.parse(await readFile(path.join(fixtureDir, 'placements.json'), 'utf8'));
    const pass = state.claims.length >= 3 && state.expectations?.claims && Array.isArray(state.placementDocument?.placements) && state.placementDocument.placements.length >= 3;
    return { pass, detail: `dir=${path.relative(repoRoot, fixtureDir)} claims=${state.claims.length} placements=${state.placementDocument?.placements?.length ?? 0}` };
  });

  if (state.claims.length) {
    const byClaimId = new Map(state.claims.map(entry => [entry.document?.claimId, entry]));
    const expectedClaims = state.expectations?.claims ?? {};
    for (const [claimId, expected] of Object.entries(expectedClaims)) {
      await guard(`claim:${claimId}`, async () => {
        const entry = byClaimId.get(claimId);
        if (!entry) return { pass: false, detail: `fixture missing for ${claimId}`, refusals: [{ code: 'CLAIM_NOT_DECLARED', detail: 'fixture missing' }] };
        const schemaErrors = schema ? checkSchema(entry.document, schema) : ['schema not loaded'];
        const refusals = validateClaim(entry.document, { rules, now });
        const actual = [...new Set(refusals.map(refusal => refusal.code))].sort();
        const wanted = [...new Set(expected.refusals ?? [])].sort();
        const pass = schemaErrors.length === 0 && actual.join() === wanted.join();
        return { pass, detail: `file=${entry.file} schema=${schemaErrors.length ? schemaErrors.join('; ') : 'ok'} refusals=${actual.join(',') || 'none'} expected=${wanted.join(',') || 'none'}`, refusals };
      });
    }
    for (const entry of state.claims) {
      if (!expectedClaims[entry.document?.claimId]) record(`claim:${entry.document?.claimId ?? entry.file}`, false, 'fixture has no expectation entry');
    }

    const claimsIndex = new Map(state.claims.map(entry => [`${entry.document?.claimId}@${entry.document?.revision}`, entry.document]));
    const placementResults = validatePlacements(state.placementDocument, claimsIndex, { rules, now });
    for (const [sectionId, expected] of Object.entries(state.expectations?.placements ?? {})) {
      await guard(`placement:${sectionId}`, async () => {
        const result = placementResults.get(sectionId);
        if (!result) return { pass: false, detail: 'placement missing' };
        const actual = [...new Set(result.refusals.map(refusal => refusal.code))].sort();
        const wanted = [...new Set(expected.refusals ?? [])].sort();
        return { pass: actual.join() === wanted.join(), detail: `refusals=${actual.join(',') || 'none'} expected=${wanted.join(',') || 'none'}`, refusals: result.refusals };
      });
    }
  }
}

const limitations = [
  'Tool half only: publisher, read-time validation and rendering enforcement are not wired in (analysis §3.4 items 2–4).',
  'The wording scan is a rules-driven allowlist gate, not a semantic judge; novel phrasing can evade it (risk R1).',
];
if (options.fixtures) limitations.push(
  'Copy checks run over fixture placements and claim statements/copyVariants; page sections, claimsPosture and pins are not read.',
  'Cross-claim resolution and digest matching against published estate revisions are fixture-local; claim tables and the reader are not implemented.',
);

const summary = {
  tool: 'verify-claims.mjs',
  mode: options.fixtures ? 'fixtures' : 'rules',
  rules: rules ? { path: path.relative(repoRoot, rulesPath), contractId: rules.contractId, rulesVersion: rules.rulesVersion, digest: `sha256:${rulesDigest}` } : null,
  schema: { path: path.relative(repoRoot, schemaPath) },
  fixtures: options.fixtures ? { dir: path.relative(repoRoot, fixtureDir) } : null,
  checkedAt: new Date().toISOString(),
  now: now.toISOString(),
  passed: checks.filter(check => check.pass).length,
  failed: checks.filter(check => !check.pass).length,
  checks,
  limitations,
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed > 0 ? 1 : 0;
